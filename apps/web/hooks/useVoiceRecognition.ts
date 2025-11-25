import { useCallback, useRef, useState } from "react";
import { getSpeechRecognition, BrowserSpeechRecognition } from "@/lib/speech";
import { SPEECH_RECOGNITION_LANG, TRANSCRIPT_DEDUP_TIMEOUT } from "@/lib/constants";

interface TranscriptDedup {
  text: string;
  time: number;
}

export interface UseVoiceRecognitionOptions {
  onTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
  autoRestart?: boolean;
  onAutoRestart?: () => void;
}

/**
 * Hook for browser speech recognition
 */
export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}) {
  const { onTranscript, onError, autoRestart = false, onAutoRestart } = options;
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const lastTranscriptRef = useRef<TranscriptDedup | null>(null);
  const shouldAutoRestartRef = useRef(autoRestart);

  const stopListening = useCallback(() => {
    shouldAutoRestartRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null as any;
        recognitionRef.current.onerror = null as any;
        recognitionRef.current.onend = null as any;
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch {
        // Ignore stop errors
      }
      recognitionRef.current = null;
    }
    lastTranscriptRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback(
    (config?: { continuous?: boolean; interimResults?: boolean; lang?: string }) => {
      // Stop any existing recognition first
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore errors when stopping
        }
        recognitionRef.current = null;
      }

      const recognition = getSpeechRecognition();
      if (!recognition) {
        const errorMsg = "Speech recognition is not supported in your browser. Please use Chrome or Edge.";
        onError?.(errorMsg);
        return false;
      }

      recognition.continuous = config?.continuous ?? false;
      recognition.interimResults = config?.interimResults ?? false;
      recognition.lang = config?.lang ?? SPEECH_RECOGNITION_LANG;

      recognition.onresult = (event) => {
        try {
          const transcript = event.results[0][0].transcript;
          if (transcript && transcript.trim()) {
            const now = Date.now();
            const last = lastTranscriptRef.current;
            // Deduplicate transcripts within timeout window
            if (!last || last.text !== transcript || now - last.time > TRANSCRIPT_DEDUP_TIMEOUT) {
              lastTranscriptRef.current = { text: transcript, time: now };
              onTranscript?.(transcript);
            }
          }
        } catch (error) {
          console.error("Error processing speech result:", error);
          onError?.("Error processing speech result");
        } finally {
          setIsListening(false);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        recognitionRef.current = null;

        if (event.error === "not-allowed") {
          onError?.("Microphone permission denied. Please enable microphone access in your browser settings.");
        } else if (event.error === "no-speech") {
          // Don't show alert for no-speech, just stop listening
          // But still call onError if provided
          onError?.("No speech detected");
        } else if (event.error === "network") {
          onError?.("Network error. Please check your connection.");
        } else {
          onError?.(`Speech recognition error: ${event.error}. Please try again.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
        // Auto-restart if enabled
        if (shouldAutoRestartRef.current && onAutoRestart) {
          setTimeout(() => {
            if (shouldAutoRestartRef.current) {
              onAutoRestart();
            }
          }, 100);
        }
      };

      try {
        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        return true;
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        setIsListening(false);
        onError?.("Failed to start speech recognition. Please try again.");
        return false;
      }
    },
    [onTranscript, onError, onAutoRestart]
  );

  const enableAutoRestart = useCallback(() => {
    shouldAutoRestartRef.current = true;
  }, []);

  const disableAutoRestart = useCallback(() => {
    shouldAutoRestartRef.current = false;
  }, []);

  return {
    isListening,
    startListening,
    stopListening,
    enableAutoRestart,
    disableAutoRestart,
  };
}


