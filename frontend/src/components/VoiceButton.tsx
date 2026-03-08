/**
 * VoiceButton — animated microphone button that starts/stops the live voice
 * session. Shows a pulsing ring when active.
 */

"use client";

interface VoiceButtonProps {
  isActive: boolean;
  isConnecting: boolean;
  onClick: () => void;
  className?: string;
}

export default function VoiceButton({
  isActive,
  isConnecting,
  onClick,
  className = "",
}: VoiceButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isConnecting}
      className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${
        isActive
          ? "bg-red-500 hover:bg-red-600 text-white w-12 h-12"
          : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 w-12 h-12"
      } ${isConnecting ? "opacity-50 cursor-wait" : ""} ${className}`}
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

      {/* Mic icon */}
      {isConnecting ? (
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
        // Stop icon (square)
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        // Mic icon
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
  );
}
