import { useEffect, useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from './ui/button';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const WS_TTS_URL = `wss://${projectId}.supabase.co/functions/v1/make-server-3c4885b3/ws/tts`;

interface VoiceAssistantProps {
  onTranscript: (text: string) => void;
  lastResponse: string;
  isProcessing: boolean;
}

export function VoiceAssistant({ onTranscript, lastResponse, isProcessing }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);

  const recognitionRef = useRef<any>(null);
  const usedVoiceRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        usedVoiceRef.current = true;
        setAutoSpeak(true);
        onTranscript(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
    }

    return () => {
      recognitionRef.current?.stop();
      stopSpeaking();
    };
  }, [onTranscript]);

  // Play queued audio buffers sequentially
  const playNextInQueue = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      // Only mark speaking done if WS is also closed/done
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        setIsSpeaking(false);
        usedVoiceRef.current = false;
      }
      return;
    }
    isPlayingRef.current = true;
    const ctx = audioContextRef.current!;
    const buffer = audioQueueRef.current.shift()!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    currentSourceRef.current = source;
    source.onended = playNextInQueue;
    source.start();
  }, []);

  // Decode a base64 PCM 24kHz chunk into an AudioBuffer
  const decodeChunk = useCallback((base64: string): AudioBuffer | null => {
    try {
      const ctx = audioContextRef.current!;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      // PCM is 16-bit signed little-endian at 24kHz mono
      const samples = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) float32[i] = samples[i] / 32768.0;

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);
      return audioBuffer;
    } catch {
      return null;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    // Close WS if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsRef.current = null;
    // Stop audio
    currentSourceRef.current?.stop();
    currentSourceRef.current = null;
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
    usedVoiceRef.current = false;
  }, []);

  // Speak text using Gemini Live API via WebSocket, with browser TTS fallback
  const speakWithGemini = useCallback(
    (text: string) => {
      if (!text) return;

      // Ensure AudioContext exists (must be created after user gesture)
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      // Close any existing WS
      if (wsRef.current) {
        wsRef.current.onmessage = null;
        wsRef.current.close();
      }
      audioQueueRef.current = [];
      isPlayingRef.current = false;

      setIsSpeaking(true);

      const ws = new WebSocket(WS_TTS_URL);
      wsRef.current = ws;

      let audioReceived = false;

      // Fallback if WS doesn't deliver audio within 5s
      const fallbackTimer = setTimeout(() => {
        if (!audioReceived) {
          console.warn('WS TTS timeout — falling back to browser TTS');
          ws.close();
          setIsSpeaking(false);
          fallbackTTS(text);
        }
      }, 5000);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            text: text.length > 600 ? text.substring(0, 600) + '...' : text,
            voice: 'Aoede',
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.audio) {
            audioReceived = true;
            clearTimeout(fallbackTimer);
            const buffer = decodeChunk(msg.audio);
            if (buffer) {
              audioQueueRef.current.push(buffer);
              if (!isPlayingRef.current) {
                playNextInQueue();
              }
            }
          }

          if (msg.done) {
            clearTimeout(fallbackTimer);
            wsRef.current = null;
            if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
              setIsSpeaking(false);
              usedVoiceRef.current = false;
            }
          }

          if (msg.error) {
            clearTimeout(fallbackTimer);
            wsRef.current = null;
            setIsSpeaking(false);
            if (!audioReceived) {
              console.warn('Gemini Live TTS error — falling back to browser TTS');
              fallbackTTS(text);
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        clearTimeout(fallbackTimer);
        console.warn('Gemini Live TTS WS error — falling back to browser TTS');
        wsRef.current = null;
        setIsSpeaking(false);
        if (!audioReceived) fallbackTTS(text);
      };

      ws.onclose = () => {
        clearTimeout(fallbackTimer);
        if (wsRef.current === ws) wsRef.current = null;
      };
    },
    [decodeChunk, playNextInQueue]
  );

  const fallbackTTS = (text: string) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(
      text.length > 500 ? text.substring(0, 500) + '...' : text
    );
    utterance.rate = 1.05;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      usedVoiceRef.current = false;
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      usedVoiceRef.current = false;
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // Auto-speak when a new response arrives (only if user used voice input)
  useEffect(() => {
    if (lastResponse && autoSpeak && usedVoiceRef.current) {
      speakWithGemini(lastResponse);
    }
  }, [lastResponse, autoSpeak, speakWithGemini]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error('Failed to start recognition:', e);
      }
    }
  };

  const toggleSpeaking = () => {
    if (isSpeaking) {
      stopSpeaking();
      window.speechSynthesis?.cancel();
    } else if (lastResponse) {
      speakWithGemini(lastResponse);
    }
  };

  if (!speechSupported) return null;

  return (
    <div className="flex items-center gap-1">
      <Button
        onClick={toggleListening}
        disabled={isProcessing}
        size="icon"
        variant="outline"
        className="rounded-full w-10 h-10 flex-shrink-0 transition-all border-0"
        style={isListening
          ? { background: '#22c55e', color: 'white', boxShadow: '0 0 0 3px rgba(34,197,94,0.35)' }
          : { background: '#ef4444', color: 'white' }
        }
        title={isListening ? 'Stop listening' : 'Speak to GEOL'}
      >
        {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
      </Button>

      <Button
        onClick={toggleSpeaking}
        disabled={!lastResponse}
        size="icon"
        variant="outline"
        className="rounded-full w-10 h-10 flex-shrink-0"
        title={isSpeaking ? 'Stop speaking' : 'Read last response aloud (Gemini voice)'}
      >
        {isSpeaking ? <Volume2 className="w-4 h-4 animate-pulse" /> : <VolumeX className="w-4 h-4" />}
      </Button>

      {isListening && (
        <span className="text-xs text-destructive animate-pulse ml-1 whitespace-nowrap">
          🎤 Listening...
        </span>
      )}
    </div>
  );
}
