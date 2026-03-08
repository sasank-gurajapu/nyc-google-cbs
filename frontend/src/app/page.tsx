"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { checkHealth } from "@/lib/api";
import ChatMessage from "@/components/ChatMessage";
import ToolsUsed from "@/components/ToolsUsed";
import AudioWaveform from "@/components/AudioWaveform";
import { useAudioStream } from "@/hooks/useAudioStream";
import { useLiveSession } from "@/hooks/useLiveSession";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: { name: string; args: Record<string, unknown> }[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [apiStatus, setApiStatus] = useState<string>("checking...");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── Voice session hooks ───────────────────────────────────────
  const audio = useAudioStream();
  const live = useLiveSession();

  // ─── Get user location on mount ────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(loc);
        console.log("[Page] User location:", loc);
      },
      (error) => {
        console.error("[Page] Geolocation error:", error);
        setLocationError("Location access denied");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Wire audio playback to live session
  useEffect(() => {
    console.log("[Page] Wiring audio.playAudio to live.onAudioReceived");
    live.onAudioReceived.current = audio.playAudio;
  }, [audio.playAudio, live.onAudioReceived]);

  // Sync mic muting with Gemini speaking state to prevent echo interruption
  useEffect(() => {
    audio.micMutedRef.current = live.isSpeaking;
  }, [live.isSpeaking, audio.micMutedRef]);

  // Send user location to Gemini once connected
  const locationSentRef = useRef(false);
  useEffect(() => {
    if (live.status === "connected" && userLocation && !locationSentRef.current) {
      locationSentRef.current = true;
      live.sendLocation(userLocation.latitude, userLocation.longitude);
    }
    if (live.status === "disconnected") {
      locationSentRef.current = false;
    }
  }, [live.status, userLocation, live]);

  // Auto-start mic once live session is connected
  const micStartedRef = useRef(false);
  useEffect(() => {
    if (live.status === "connected" && !micStartedRef.current) {
      micStartedRef.current = true;
      audio
        .startMic((base64Pcm) => {
          // Also check the ref synchronously in case React state hasn't caught up
          if (live.isSpeakingRef.current) return;
          live.sendAudio(base64Pcm);
        })
        .catch((err) => {
          console.error("Failed to start mic:", err);
        });
    }
    if (live.status === "disconnected") {
      micStartedRef.current = false;
    }
  }, [live.status, audio, live]);

  // ─── Promote live transcripts into the messages list ───────────
  const lastProcessedRef = useRef(0);
  useEffect(() => {
    if (live.transcripts.length <= lastProcessedRef.current) return;

    const newTranscripts = live.transcripts.slice(lastProcessedRef.current);
    lastProcessedRef.current = live.transcripts.length;

    setMessages((prev) => {
      const updated = [...prev];
      for (const t of newTranscripts) {
        // Merge consecutive assistant transcripts (streaming text)
        const last = updated[updated.length - 1];
        if (
          t.role === "assistant" &&
          last?.role === "assistant"
        ) {
          updated[updated.length - 1] = {
            ...last,
            content: last.content + t.text,
          };
        } else {
          updated.push({ role: t.role, content: t.text });
        }
      }
      return updated;
    });
  }, [live.transcripts]);

  // ─── Promote tool calls into the last assistant message ────────
  const lastToolCountRef = useRef(0);
  useEffect(() => {
    if (live.toolCalls.length <= lastToolCountRef.current) return;

    const newTools = live.toolCalls.slice(lastToolCountRef.current);
    lastToolCountRef.current = live.toolCalls.length;

    setMessages((prev) => {
      const updated = [...prev];
      let lastAssistantIdx = -1;
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].role === "assistant") {
          lastAssistantIdx = i;
          break;
        }
      }
      if (lastAssistantIdx >= 0) {
        updated[lastAssistantIdx] = {
          ...updated[lastAssistantIdx],
          toolsUsed: [
            ...(updated[lastAssistantIdx].toolsUsed || []),
            ...newTools,
          ],
        };
      }
      return updated;
    });
  }, [live.toolCalls]);

  // Reset counters when session disconnects
  useEffect(() => {
    if (live.status === "disconnected") {
      lastProcessedRef.current = 0;
      lastToolCountRef.current = 0;
    }
  }, [live.status]);

  // ─── Start / stop voice ────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    if (live.status === "connected") {
      audio.stopMic();
      audio.stopPlayback();
      live.disconnect();
    } else if (live.status === "disconnected" || live.status === "error") {
      // CRITICAL: Create + resume the playback AudioContext RIGHT HERE
      // in the click handler so the browser allows audio output.
      audio.initPlaybackContext();
      micStartedRef.current = false;
      live.connect();
    }
  }, [live, audio]);

  // Check backend health on mount
  useEffect(() => {
    checkHealth().then(setApiStatus);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isActive = live.status === "connected";

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <Image
            src="/title.png"
            alt="Explorer"
            width={140}
            height={36}
            priority
            className="h-9 w-auto"
          />
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            Powered by Gemini + Google Maps
          </span>
        </div>
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              ✨ New Chat
            </button>
          )}
          {/* Location indicator */}
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                userLocation ? "bg-green-500" : locationError ? "bg-red-500" : "bg-yellow-500 animate-pulse"
              }`}
            />
            <span className="text-zinc-500 dark:text-zinc-400">
              {userLocation ? "Location ready" : locationError || "Getting location..."}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                apiStatus === "ok" ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-zinc-500 dark:text-zinc-400">
              {apiStatus === "ok" ? "Connected" : apiStatus}
            </span>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 && !isActive && (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
              <div className="text-5xl mb-4">📍</div>
              <h2 className="text-xl font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
                Ask anything about places near you
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mb-6">
                Tap the microphone and speak — find restaurants, get directions,
                explore your area with your voice.
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
                <span className="px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                  &quot;Best pizza near me?&quot;
                </span>
                <span className="px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                  &quot;How do I get to the nearest park?&quot;
                </span>
                <span className="px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                  &quot;Coffee shops nearby&quot;
                </span>
              </div>
            </div>
          )}

          {/* Listening indicator when no messages yet */}
          {messages.length === 0 && isActive && (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
              <div className="text-5xl mb-4">🎙️</div>
              <p className="text-zinc-400 dark:text-zinc-500 text-sm animate-pulse">
                Listening... ask me anything!
              </p>
            </div>
          )}

          {messages.filter(m => m.role === "assistant").map((msg, idx) => (
            <div key={idx}>
              {msg.content && <ChatMessage role={msg.role} content={msg.content} />}
              {msg.role === "assistant" &&
                msg.toolsUsed &&
                msg.toolsUsed.length > 0 && (
                  <div className="mb-2 ml-0">
                    <ToolsUsed tools={msg.toolsUsed} />
                  </div>
                )}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Footer — Waveform + Mic button */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {/* Waveform fills the space where text input used to be */}
          <div className="flex-1 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-1 min-h-[48px] overflow-hidden">
            {isActive || live.status === "connecting" ? (
              <AudioWaveform
                status={live.status}
                isSpeaking={live.isSpeaking}
                micAmplitude={audio.micAmplitude}
              />
            ) : (
              <span className="text-sm text-zinc-400 dark:text-zinc-500">
                Tap the mic to start talking
              </span>
            )}
          </div>

          {/* Mic button */}
          <button
            onClick={toggleVoice}
            disabled={live.status === "connecting"}
            className={`relative flex-shrink-0 flex items-center justify-center rounded-full w-12 h-12 transition-all duration-300 ${
              isActive
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            } ${live.status === "connecting" ? "opacity-50 cursor-wait" : ""}`}
            title={isActive ? "Stop voice chat" : "Start voice chat"}
            aria-label={isActive ? "Stop voice chat" : "Start voice chat"}
          >
            {/* Pulsing ring when active */}
            {isActive && (
              <>
                <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-25" />
                <span className="absolute inset-[-4px] rounded-full border-2 border-red-400 animate-pulse opacity-50" />
              </>
            )}

            {live.status === "connecting" ? (
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : isActive ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 10v2a7 7 0 01-14 0v-2"
                />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
