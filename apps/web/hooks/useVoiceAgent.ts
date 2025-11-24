import { useEffect, useRef, useState, useCallback } from "react";
import { VoiceAgentClient, VoiceAgentMessage } from "@/lib/voiceAgent";
import { formatAgentResponseText, ToolResult } from "@/lib/formatters";
import { speak } from "@/lib/speech";
import { AUTO_RESTART_DELAY, TRANSCRIPT_DEDUP_TIMEOUT } from "@/lib/constants";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface UseVoiceAgentOptions {
  enabled: boolean;
  isMuted: boolean;
  onUserMessage?: (message: string) => void;
  onAssistantMessage?: (message: ChatMessage) => void;
  onError?: (error: string) => void;
  onStatusChange?: (connected: boolean) => void;
  autoRestartListening?: () => void;
  isListening?: boolean;
}

/**
 * Hook for managing voice agent WebSocket connection and messages
 */
export function useVoiceAgent(options: UseVoiceAgentOptions) {
  const {
    enabled,
    isMuted,
    onUserMessage,
    onAssistantMessage,
    onError,
    onStatusChange,
    autoRestartListening,
    isListening = false,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [whisperAvailable, setWhisperAvailable] = useState(false);
  const voiceAgentRef = useRef<VoiceAgentClient | null>(null);
  const isMutedRef = useRef(isMuted);
  const lastTranscriptRef = useRef<{ text: string; time: number } | null>(null);

  // Keep muted ref in sync
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (!enabled) {
      if (voiceAgentRef.current) {
        voiceAgentRef.current.disconnect();
        voiceAgentRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const client = new VoiceAgentClient();
    voiceAgentRef.current = client;

    const handleTranscript = (data: VoiceAgentMessage) => {
      if (data.is_final && data.text) {
        const transcript = data.text.trim();
        if (!transcript) {
          return;
        }
        const now = Date.now();
        const last = lastTranscriptRef.current;
        // Deduplicate transcripts
        if (!last || last.text !== transcript || now - last.time > TRANSCRIPT_DEDUP_TIMEOUT) {
          lastTranscriptRef.current = { text: transcript, time: now };
          onUserMessage?.(transcript);
        }
      }
    };

    const handleResponse = async (data: VoiceAgentMessage) => {
      const toolResult: ToolResult | undefined = data.tool_result;
      const formatted = formatAgentResponseText(data.text, toolResult);
      if (!formatted) {
        return;
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: formatted,
        timestamp: new Date(),
      };
      onAssistantMessage?.(assistantMessage);

      if (!isMutedRef.current) {
        await speak(formatted);
        // Auto-restart listening if enabled and not using live voice agent
        if (autoRestartListening && !isListening) {
          setTimeout(() => {
            autoRestartListening();
          }, AUTO_RESTART_DELAY);
        }
      }
    };

    const handleError = (payload: VoiceAgentMessage) => {
      const errorMessage = payload?.message || payload?.text || "Voice agent error.";
      console.error("[useVoiceAgent] Voice agent error:", payload);

      // If it's a Whisper error, we'll use browser STT instead
      if (errorMessage.toLowerCase().includes("whisper")) {
        console.log("[useVoiceAgent] Whisper unavailable, switching to browser STT mode");
        setWhisperAvailable(false);
        // Don't show error message or disconnect - just use browser STT
        return;
      }

      onError?.(errorMessage);
    };

    const handleStatus = (payload: VoiceAgentMessage) => {
      if (payload?.message) {
        console.log("[useVoiceAgent] Voice agent status:", payload.message);
      }
    };

    const handleOpen = () => {
      console.log("[useVoiceAgent] Voice agent WebSocket opened");
      setIsConnected(true);
      onStatusChange?.(true);
    };

    const handleClose = () => {
      console.log("[useVoiceAgent] Voice agent WebSocket closed");
      setIsConnected(false);
      onStatusChange?.(false);
    };

    client.on("transcript", handleTranscript);
    client.on("response", handleResponse);
    client.on("error", handleError);
    client.on("status", handleStatus);
    client.on("open", handleOpen);
    client.on("close", handleClose);

    console.log("[useVoiceAgent] Attempting to connect to voice agent...");
    client
      .checkCapabilities()
      .then((capabilities) => {
        setWhisperAvailable(capabilities.whisper_available);
        console.log("[useVoiceAgent] Voice agent capabilities:", capabilities);
        if (!capabilities.whisper_available) {
          console.log("[useVoiceAgent] Whisper not available, will use browser STT with text messages");
        }
        return client.connect();
      })
      .then(() => {
        console.log("[useVoiceAgent] Successfully connected to voice agent");
      })
      .catch((error) => {
        console.error("[useVoiceAgent] Failed to connect to voice agent:", error);
        setIsConnected(false);
        onStatusChange?.(false);
        onError?.("Failed to connect to voice agent");
      });

    return () => {
      client.off("transcript", handleTranscript);
      client.off("response", handleResponse);
      client.off("error", handleError);
      client.off("status", handleStatus);
      client.off("open", handleOpen);
      client.off("close", handleClose);
      client.disconnect();
      if (voiceAgentRef.current === client) {
        voiceAgentRef.current = null;
      }
      setIsConnected(false);
      onStatusChange?.(false);
    };
  }, [enabled, onUserMessage, onAssistantMessage, onError, onStatusChange, autoRestartListening, isListening]);

  const sendText = useCallback(
    (message: string, location?: { lat: number; lng: number }) => {
      if (voiceAgentRef.current?.isConnected) {
        voiceAgentRef.current.sendText(message, location);
      } else {
        console.error("[useVoiceAgent] Voice agent not connected");
      }
    },
    []
  );

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (voiceAgentRef.current?.isConnected) {
      voiceAgentRef.current.sendAudio(audioData);
    } else {
      console.error("[useVoiceAgent] Voice agent not connected");
    }
  }, []);

  const connect = useCallback(async () => {
    if (voiceAgentRef.current) {
      if (!voiceAgentRef.current.isConnected) {
        await voiceAgentRef.current.connect();
      }
      return voiceAgentRef.current;
    }
    return null;
  }, []);

  return {
    isConnected,
    whisperAvailable,
    client: voiceAgentRef.current,
    sendText,
    sendAudio,
    connect,
  };
}

