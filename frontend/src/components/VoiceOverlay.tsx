/**
 * VoiceOverlay — full-screen overlay for the real-time voice session.
 * Shows animated orb, live transcripts, tool calls, and structured data.
 */

"use client";

import { useEffect, useRef } from "react";
import type { LiveTranscript } from "@/hooks/useLiveSession";
import type { StructuredDataItem, ToolUsed } from "@/lib/api";
import StructuredDataRenderer from "@/components/StructuredDataRenderer";
import ToolsUsed from "@/components/ToolsUsed";

interface VoiceOverlayProps {
  isActive: boolean;
  status: string;
  transcripts: LiveTranscript[];
  toolCalls: ToolUsed[];
  structuredData: StructuredDataItem[];
  onClose: () => void;
}

export default function VoiceOverlay({
  isActive,
  status,
  transcripts,
  toolCalls,
  structuredData,
  onClose,
}: VoiceOverlayProps) {
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">🎙️ Voice Mode</h2>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              status === "connected"
                ? "bg-green-500/20 text-green-400"
                : status === "connecting"
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {status}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-zinc-800"
          title="End voice session"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center overflow-hidden">
        {/* Animated orb */}
        <div className="flex items-center justify-center py-8">
          <div className="relative">
            {/* Outer pulse */}
            <div
              className={`absolute inset-[-20px] rounded-full transition-all duration-500 ${
                status === "connected"
                  ? "bg-blue-500/10 animate-pulse"
                  : "bg-zinc-500/10"
              }`}
            />
            {/* Middle ring */}
            <div
              className={`absolute inset-[-10px] rounded-full transition-all duration-500 ${
                status === "connected"
                  ? "bg-blue-500/20 animate-ping"
                  : "bg-zinc-500/20"
              }`}
              style={{ animationDuration: "2s" }}
            />
            {/* Core orb */}
            <div
              className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                status === "connected"
                  ? "bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30"
                  : status === "connecting"
                  ? "bg-gradient-to-br from-yellow-500 to-orange-600"
                  : "bg-zinc-700"
              }`}
            >
              {status === "connecting" ? (
                <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {status === "connected" && transcripts.length === 0 && (
          <p className="text-zinc-400 text-sm mb-4 animate-pulse">
            Listening... ask me anything about NYC!
          </p>
        )}

        {/* Transcripts + Data */}
        <div className="flex-1 w-full max-w-2xl overflow-y-auto px-6 pb-6">
          {/* Tool calls section */}
          {toolCalls.length > 0 && (
            <div className="mb-4">
              <ToolsUsed tools={toolCalls} />
            </div>
          )}

          {/* Live transcripts */}
          <div className="space-y-3 mb-4">
            {transcripts.map((t, i) => (
              <div
                key={i}
                className={`flex ${
                  t.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    t.role === "user"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-zinc-800 text-zinc-200 rounded-bl-md"
                  }`}
                >
                  {t.text}
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>

          {/* Structured data (maps, place cards, routes) */}
          {structuredData.length > 0 && (
            <div className="mt-4">
              <StructuredDataRenderer data={structuredData} />
            </div>
          )}
        </div>
      </div>

      {/* Footer with hint */}
      <div className="px-6 py-4 text-center">
        <p className="text-xs text-zinc-500">
          Just speak naturally — say &quot;stop&quot; or press the X to end the session
        </p>
      </div>
    </div>
  );
}
