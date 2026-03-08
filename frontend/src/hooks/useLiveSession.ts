/**
 * useLiveSession — manages the WebSocket connection to the /ws/live endpoint
 * for real-time voice interaction with Gemini Live.
 *
 * Coordinates with useAudioStream for mic/speaker and exposes session state.
 */

import { useCallback, useRef, useState } from "react";
import type { StructuredDataItem, ToolUsed } from "@/lib/api";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/live";

export type LiveSessionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface LiveTranscript {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export interface UseLiveSessionReturn {
  status: LiveSessionStatus;
  isSpeaking: boolean;
  /** Ref version of isSpeaking for synchronous reading in audio callbacks */
  isSpeakingRef: React.MutableRefObject<boolean>;
  transcripts: LiveTranscript[];
  toolCalls: ToolUsed[];
  structuredData: StructuredDataItem[];
  connect: (userLocation?: { latitude: number; longitude: number }) => void;
  disconnect: () => void;
  sendAudio: (base64Pcm: string) => void;
  sendText: (text: string) => void;
  sendLocation: (latitude: number, longitude: number) => void;
  onAudioReceived: React.MutableRefObject<((base64Pcm: string) => void) | null>;
}

export function useLiveSession(): UseLiveSessionReturn {
  const [status, setStatus] = useState<LiveSessionStatus>("disconnected");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);
  const [transcripts, setTranscripts] = useState<LiveTranscript[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolUsed[]>([]);
  const [structuredData, setStructuredData] = useState<StructuredDataItem[]>([]);
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const onAudioReceived = useRef<((base64Pcm: string) => void) | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current) return;

    setStatus("connecting");
    setTranscripts([]);
    setToolCalls([]);
    setStructuredData([]);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Live] WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (err) {
        console.error("[Live] Parse error:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("[Live] WebSocket error:", err);
      setStatus("error");
    };

    ws.onclose = () => {
      console.log("[Live] WebSocket closed");
      wsRef.current = null;
      setStatus("disconnected");
    };
  }, []);

  const handleMessage = useCallback((msg: Record<string, unknown>) => {
    switch (msg.type) {
      case "session_started":
        setStatus("connected");
        break;

      case "audio":
        // Forward audio to the playback hook
        console.log(`[Live] Audio received: ${(msg.data as string)?.length || 0} chars`);
        if (onAudioReceived.current) {
          onAudioReceived.current(msg.data as string);
        } else {
          console.warn("[Live] onAudioReceived callback not set!");
        }
        // Track speaking state with debounce
        setIsSpeaking(true);
        isSpeakingRef.current = true;
        if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
        speakingTimeoutRef.current = setTimeout(() => {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
        }, 500);
        break;

      case "transcript":
        setTranscripts((prev) => {
          // Append or merge with last assistant transcript
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant") {
            return [
              ...prev.slice(0, -1),
              { ...last, text: last.text + (msg.text as string) },
            ];
          }
          return [
            ...prev,
            {
              role: "assistant" as const,
              text: msg.text as string,
              timestamp: Date.now(),
            },
          ];
        });
        break;

      case "user_transcript":
        // User speech transcript — intentionally not displayed in the chat.
        // The voice-only UI does not show what the user said.
        console.log("[Live] User said:", msg.text);
        break;

      case "tool_call":
        setToolCalls((prev) => [
          ...prev,
          {
            name: msg.name as string,
            args: (msg.args as Record<string, unknown>) || {},
          },
        ]);
        break;

      case "structured_data":
        setStructuredData((prev) => [
          ...prev,
          {
            tool: msg.tool as string,
            args: (msg.args as Record<string, unknown>) || {},
            result: (msg.result as Record<string, unknown>) || {},
          },
        ]);
        break;

      case "turn_complete":
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
        break;

      case "error":
        console.error("[Live] Server error:", msg.message);
        setStatus("error");
        break;

      case "session_ended":
        setStatus("disconnected");
        break;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      // Send close message to the server
      try {
        wsRef.current.send(JSON.stringify({ type: "close" }));
      } catch {
        // ignore
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  const sendAudio = useCallback((base64Pcm: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "audio", data: base64Pcm }));
    }
  }, []);

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "text", text }));
    }
  }, []);

  const sendLocation = useCallback((latitude: number, longitude: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "location", latitude, longitude }));
      console.log(`[Live] Sent user location: ${latitude}, ${longitude}`);
    }
  }, []);

  return {
    status,
    isSpeaking,
    isSpeakingRef,
    transcripts,
    toolCalls,
    structuredData,
    connect,
    disconnect,
    sendAudio,
    sendText,
    sendLocation,
    onAudioReceived,
  };
}
