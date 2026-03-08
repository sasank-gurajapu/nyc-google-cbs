"use client";

/**
 * AudioWaveform — animated waveform visualization driven by real mic amplitude.
 *
 * Bar heights respond to:
 * - micAmplitude (0–1): real-time RMS from the mic AudioWorklet
 * - isSpeaking: whether Gemini is outputting audio (taller, faster bars)
 * - status: session state for idle/connecting animations
 */

import { useEffect, useRef } from "react";

interface AudioWaveformProps {
  status: "disconnected" | "connecting" | "connected" | "error";
  isSpeaking?: boolean;
  /** Real-time mic amplitude 0–1 */
  micAmplitude?: number;
}

const BAR_COUNT = 48;

export default function AudioWaveform({
  status,
  isSpeaking = false,
  micAmplitude = 0,
}: AudioWaveformProps) {
  const barsRef = useRef<HTMLDivElement>(null);
  const offsetsRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);

  // Generate random phase offsets once on mount
  useEffect(() => {
    offsetsRef.current = Array.from({ length: BAR_COUNT }, () => Math.random() * Math.PI * 2);
  }, []);

  // Animate bars via requestAnimationFrame for smooth, amplitude-driven motion
  useEffect(() => {
    const container = barsRef.current;
    if (!container) return;

    const isActive = status === "connected";
    const isConnecting = status === "connecting";

    const animate = () => {
      const bars = container.children;
      const time = performance.now() / 1000;
      const offsets = offsetsRef.current;

      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i] as HTMLElement;
        const offset = offsets[i] || 0;
        let height: number;

        if (isActive && isSpeaking) {
          // Gemini is speaking — tall, energetic bars with a wave pattern
          const wave = Math.sin(time * 6 + offset) * 0.5 + 0.5;
          height = 6 + wave * 34;
        } else if (isActive) {
          // Listening — bars react to mic amplitude
          const wave = Math.sin(time * 4 + offset) * 0.5 + 0.5;
          const amp = micAmplitude;
          // Base idle motion (small) + amplitude-driven motion (large)
          height = 4 + wave * 4 + amp * 36 * (0.5 + wave * 0.5);
        } else if (isConnecting) {
          // Connecting — pulsing wave
          const wave = Math.sin(time * 3 + offset) * 0.5 + 0.5;
          height = 4 + wave * 16;
        } else {
          // Idle — subtle breathing
          const wave = Math.sin(time * 1.5 + offset) * 0.5 + 0.5;
          height = 3 + wave * 4;
        }

        bar.style.height = `${height}px`;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [status, isSpeaking, micAmplitude]);

  const isActive = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <div ref={barsRef} className="flex items-center justify-center w-full h-12 gap-[2px]">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-colors duration-300 ${
            isActive && isSpeaking
              ? "bg-blue-500"
              : isActive
              ? "bg-blue-400"
              : isConnecting
              ? "bg-yellow-400"
              : "bg-zinc-300 dark:bg-zinc-700"
          }`}
          style={{
            width: "3px",
            height: "4px",
          }}
        />
      ))}
    </div>
  );
}
