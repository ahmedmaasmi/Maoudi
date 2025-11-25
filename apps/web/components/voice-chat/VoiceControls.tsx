"use client";

import { Volume2, VolumeX } from "lucide-react";
import { AIVoiceInput } from "@/components/ui/ai-voice-input";

interface VoiceControlsProps {
  isListening: boolean;
  isMuted: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onToggleMute: () => void;
  isLoading?: boolean;
}

export function VoiceControls({
  isListening,
  isMuted,
  onStartListening,
  onStopListening,
  onToggleMute,
  isLoading = false,
}: VoiceControlsProps) {
  return (
    <div className="relative z-20 flex flex-col items-center gap-4 pb-4">
      <AIVoiceInput
        submitted={isListening}
        onSubmittedChange={(submitted) => {
          if (submitted) {
            onStartListening();
          } else {
            onStopListening();
          }
        }}
        disabled={isLoading}
      />
      <button
        onClick={onToggleMute}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 transition-colors"
        title={isMuted ? "Unmute audio" : "Mute audio"}
        aria-label={isMuted ? "Unmute audio" : "Mute audio"}
        disabled={isLoading}
      >
        {isMuted ? (
          <>
            <VolumeX className="w-4 h-4" />
            <span className="text-sm">Unmute</span>
          </>
        ) : (
          <>
            <Volume2 className="w-4 h-4" />
            <span className="text-sm">Mute</span>
          </>
        )}
      </button>
    </div>
  );
}


