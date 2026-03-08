import { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from './ui/button';

interface VoiceAssistantProps {
  onTranscript: (text: string) => void;
  lastResponse: string;
  isProcessing: boolean;
}

export function VoiceAssistant({ onTranscript, lastResponse, isProcessing }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [muted, setMuted] = useState(false);

  const recognitionRef = useRef<any>(null);
  const lastSpokenRef = useRef('');

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
        onTranscript(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
    }

    // Only stop recognition on cleanup — do NOT cancel speech here.
    // This effect re-runs whenever onTranscript changes (every parent render),
    // so calling cancel() here would cut off speech mid-sentence.
    return () => {
      recognitionRef.current?.stop();
    };
  }, [onTranscript]);

  // Cancel speech only on true unmount
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  // Speak every new response unless muted
  useEffect(() => {
    if (!lastResponse || muted) return;
    if (lastResponse === lastSpokenRef.current) return;
    lastSpokenRef.current = lastResponse;
    speak(lastResponse);
  }, [lastResponse, muted]);

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;

    // Cancel any ongoing speech first, then wait a tick (Chrome bug workaround)
    window.speechSynthesis.cancel();

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(
        text.length > 500 ? text.substring(0, 500) + '…' : text
      );
      utterance.rate = 1.05;
      utterance.pitch = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }, 50);
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

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

  const toggleMute = () => {
    if (isSpeaking) stopSpeaking();
    setMuted((prev) => !prev);
  };

  if (!speechSupported) return null;

  return (
    <div className="flex items-center gap-1">
      {/* Mic button — green when listening, red when idle */}
      <Button
        onClick={toggleListening}
        disabled={isProcessing}
        size="icon"
        variant="outline"
        className="rounded-full w-10 h-10 flex-shrink-0 transition-all border-0"
        style={
          isListening
            ? { background: '#22c55e', color: 'white', boxShadow: '0 0 0 3px rgba(34,197,94,0.35)' }
            : { background: '#ef4444', color: 'white' }
        }
        title={isListening ? 'Stop listening' : 'Speak to GEOL'}
      >
        {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
      </Button>

      {/* Speaker / mute toggle */}
      <Button
        onClick={toggleMute}
        size="icon"
        variant="outline"
        className="rounded-full w-10 h-10 flex-shrink-0 transition-all border-0"
        style={
          muted
            ? { background: '#374151', color: '#9ca3af' }
            : isSpeaking
            ? { background: '#3b82f6', color: 'white' }
            : { background: '#6b7280', color: 'white' }
        }
        title={muted ? 'Unmute responses' : isSpeaking ? 'Speaking… click to mute' : 'Auto-speak on — click to mute'}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse' : ''}`} />}
      </Button>

      {isListening && (
        <span className="text-xs text-green-500 animate-pulse ml-1 whitespace-nowrap">
          🎤 Listening…
        </span>
      )}
    </div>
  );
}
