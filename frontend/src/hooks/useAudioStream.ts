/**
 * useAudioStream — manages microphone capture and audio playback for the
 * Gemini Live real-time voice session.
 *
 * Mic: records 16-bit PCM at 16 kHz mono via AudioWorklet → base64 chunks
 * Speaker: plays 16-bit PCM at 24 kHz mono received from the server
 */

import { useCallback, useRef, useState } from "react";

const MIC_SAMPLE_RATE = 16000;
const SPEAKER_SAMPLE_RATE = 24000;

/** AudioWorklet processor code injected as a Blob URL */
const WORKLET_CODE = `
class PcmRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
  }
  process(inputs) {
    const input = inputs[0];
    if (input.length > 0) {
      const samples = input[0]; // Float32 mono
      // Compute RMS amplitude
      let sumSq = 0;
      for (let i = 0; i < samples.length; i++) {
        sumSq += samples[i] * samples[i];
      }
      const rms = Math.sqrt(sumSq / samples.length);
      // Convert Float32 → Int16
      const pcm16 = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.port.postMessage({ pcm: pcm16.buffer, rms }, [pcm16.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-recorder-processor', PcmRecorderProcessor);
`;

export interface UseAudioStreamReturn {
  isRecording: boolean;
  micAmplitude: number;
  /** Call this DIRECTLY inside a click handler to create the AudioContext
   *  while the browser still considers it a user gesture. */
  initPlaybackContext: () => void;
  startMic: (onChunk: (base64Pcm: string) => void) => Promise<void>;
  stopMic: () => void;
  playAudio: (base64Pcm: string) => void;
  stopPlayback: () => void;
  /** Set to true to suppress sending mic audio (but keep recording for amplitude). */
  micMutedRef: React.MutableRefObject<boolean>;
}

export function useAudioStream(): UseAudioStreamReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [micAmplitude, setMicAmplitude] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  // Playback state
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const pendingChunksRef = useRef<string[]>([]);
  const processingRef = useRef(false);

  // Mic muting flag — read synchronously in the worklet callback
  const micMutedRef = useRef(false);

  // ─── Playback AudioContext management ─────────────────────────

  // Promise to track pending resume operation
  const resumePromiseRef = useRef<Promise<void> | null>(null);

  /**
   * Create + resume the playback AudioContext **synchronously** from a click
   * handler so the browser allows audio output. Must be called inside
   * a direct user gesture (button onClick).
   */
  const initPlaybackContext = useCallback(() => {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === "closed") {
      playbackCtxRef.current = new AudioContext({ sampleRate: SPEAKER_SAMPLE_RATE });
      nextPlayTimeRef.current = 0;
      console.log("[Audio] Created playback AudioContext in user gesture, state:", playbackCtxRef.current.state);
    }
    // resume() returns a promise but calling it inside the gesture is enough
    // for Chrome/Safari to transition to 'running'
    if (playbackCtxRef.current.state === "suspended") {
      resumePromiseRef.current = playbackCtxRef.current.resume().then(() => {
        console.log("[Audio] Playback AudioContext resumed → state:", playbackCtxRef.current?.state);
        resumePromiseRef.current = null;
      });
    }
  }, []);

  /** Async helper to ensure context is running before scheduling audio. */
  const ensurePlaybackCtx = useCallback(async (): Promise<AudioContext> => {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === "closed") {
      playbackCtxRef.current = new AudioContext({ sampleRate: SPEAKER_SAMPLE_RATE });
      nextPlayTimeRef.current = 0;
    }
    // Wait for any pending resume() from initPlaybackContext
    if (resumePromiseRef.current) {
      await resumePromiseRef.current;
    }
    // If still suspended, try to resume (may fail without user gesture)
    if (playbackCtxRef.current.state === "suspended") {
      try {
        await playbackCtxRef.current.resume();
        console.log("[Audio] ensurePlaybackCtx resumed context");
      } catch (e) {
        console.warn("[Audio] Could not resume AudioContext:", e);
      }
    }
    return playbackCtxRef.current;
  }, []);

  // ─── Mic capture ─────────────────────────────────────────────────

  const startMic = useCallback(async (onChunk: (base64Pcm: string) => void) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: MIC_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: MIC_SAMPLE_RATE });
      audioCtxRef.current = audioCtx;

      // Create worklet from blob
      const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
      const workletUrl = URL.createObjectURL(blob);
      await audioCtx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      const source = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtx, "pcm-recorder-processor");
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; rms: number }>) => {
        const { pcm, rms } = e.data;
        // Always update amplitude for waveform visualization
        setMicAmplitude(Math.min(1, rms * 5));

        // Only send audio data if mic is not muted
        if (micMutedRef.current) return;

        const bytes = new Uint8Array(pcm);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        onChunk(base64);
      };

      source.connect(workletNode);
      workletNode.connect(audioCtx.destination); // needed to keep the worklet alive

      setIsRecording(true);
      console.log("[Audio] Mic started");
    } catch (err) {
      console.error("Mic start failed:", err);
      throw err;
    }
  }, []);

  const stopMic = useCallback(() => {
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;

    audioCtxRef.current?.close();
    audioCtxRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setIsRecording(false);
    setMicAmplitude(0);
  }, []);

  // ─── Playback scheduling ────────────────────────────────────────

  /** Decode and schedule a single base64 PCM chunk for playback. */
  const scheduleChunk = useCallback(
    (ctx: AudioContext, base64Pcm: string) => {
      try {
        // Verify context is running
        if (ctx.state !== "running") {
          console.warn(`[Audio] Cannot schedule — AudioContext state is "${ctx.state}"`);
          return;
        }

        // Decode base64 → Int16 → Float32
        const binary = atob(base64Pcm);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768;
        }

        const audioBuffer = ctx.createBuffer(1, float32.length, SPEAKER_SAMPLE_RATE);
        audioBuffer.getChannelData(0).set(float32);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        // Schedule seamlessly — reset if we've fallen behind
        const now = ctx.currentTime;
        if (nextPlayTimeRef.current < now) {
          // We've fallen behind or this is the first chunk — start soon
          nextPlayTimeRef.current = now + 0.02;
        }
        const startTime = nextPlayTimeRef.current;
        source.start(startTime);
        nextPlayTimeRef.current = startTime + audioBuffer.duration;
        
        console.log(`[Audio] Scheduled chunk: ${float32.length} samples, start=${startTime.toFixed(3)}, dur=${audioBuffer.duration.toFixed(3)}, ctxState=${ctx.state}`);
      } catch (err) {
        console.error("[Audio] scheduleChunk error:", err);
      }
    },
    []
  );

  /** Process queued audio chunks sequentially. */
  const processQueue = useCallback(async () => {
    if (processingRef.current) {
      console.log("[Audio] processQueue skipped — already processing");
      return;
    }
    processingRef.current = true;
    console.log(`[Audio] processQueue starting, ${pendingChunksRef.current.length} chunks queued`);
    try {
      const ctx = await ensurePlaybackCtx();
      console.log(`[Audio] AudioContext ready, state=${ctx.state}, sampleRate=${ctx.sampleRate}`);
      
      while (pendingChunksRef.current.length > 0) {
        const chunk = pendingChunksRef.current.shift()!;
        scheduleChunk(ctx, chunk);
      }
    } catch (err) {
      console.error("[Audio] Playback error:", err);
    } finally {
      processingRef.current = false;
    }
  }, [ensurePlaybackCtx, scheduleChunk]);

  const playAudio = useCallback(
    (base64Pcm: string) => {
      console.log(`[Audio] Received chunk: ${base64Pcm.length} b64 chars`);
      pendingChunksRef.current.push(base64Pcm);
      processQueue();
    },
    [processQueue]
  );

  const stopPlayback = useCallback(() => {
    pendingChunksRef.current = [];
    processingRef.current = false;
    resumePromiseRef.current = null;
    if (playbackCtxRef.current && playbackCtxRef.current.state !== "closed") {
      playbackCtxRef.current.close();
      playbackCtxRef.current = null;
      nextPlayTimeRef.current = 0;
    }
  }, []);

  return {
    isRecording,
    micAmplitude,
    initPlaybackContext,
    startMic,
    stopMic,
    playAudio,
    stopPlayback,
    micMutedRef,
  };
}
