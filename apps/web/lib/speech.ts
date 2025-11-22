"use client";

import { speakWithElevenLabs, isElevenLabsAvailable, stopAudio } from "./elevenlabs";

export interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onstart: () => void;
}

export interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): BrowserSpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): BrowserSpeechRecognition;
    };
  }
}

export function getSpeechRecognition(): BrowserSpeechRecognition | null {
  if (typeof window === "undefined") {
    return null;
  }

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return null;
  }

  return new SpeechRecognition();
}

export async function speak(text: string, lang: string = "en-US"): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  // Stop any currently playing audio
  stopSpeaking();

  // Try Eleven Labs first if available
  if (isElevenLabsAvailable()) {
    try {
      await speakWithElevenLabs(text);
      return;
    } catch (error) {
      console.warn("Eleven Labs TTS failed, falling back to browser TTS:", error);
      // Fall through to browser TTS
    }
  }

  // Fallback to browser speechSynthesis
  if (!window.speechSynthesis) {
    console.warn("Speech synthesis not available");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;

  // Try to use a pleasant voice
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice =
    voices.find((v) => v.lang.startsWith(lang) && v.name.includes("Female")) ||
    voices.find((v) => v.lang.startsWith(lang)) ||
    voices[0];

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  // Return a promise that resolves when speech finishes
  return new Promise<void>((resolve, reject) => {
    utterance.onend = () => {
      resolve();
    };
    utterance.onerror = (error) => {
      reject(error);
    };
    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking() {
  // Stop Eleven Labs audio if playing
  stopAudio();

  // Stop browser speechSynthesis
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

