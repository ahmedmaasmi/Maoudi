import * as Speech from "expo-speech";
import Voice from "@react-native-voice/voice";
import { Platform } from "react-native";

export class VoiceService {
  private isListening = false;
  private onResultCallback?: (text: string) => void;
  private onErrorCallback?: (error: Error) => void;

  constructor() {
    if (Platform.OS === "android") {
      Voice.onSpeechStart = () => {
        this.isListening = true;
      };
      Voice.onSpeechEnd = () => {
        this.isListening = false;
      };
      Voice.onSpeechResults = (e) => {
        if (e.value && e.value.length > 0 && this.onResultCallback) {
          this.onResultCallback(e.value[0]);
        }
        this.isListening = false;
      };
      Voice.onSpeechError = (e) => {
        if (this.onErrorCallback) {
          this.onErrorCallback(new Error(e.error?.message || "Speech recognition error"));
        }
        this.isListening = false;
      };
    }
  }

  async startListening(
    onResult: (text: string) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    this.onResultCallback = onResult;
    this.onErrorCallback = onError;

    try {
      if (Platform.OS === "android") {
        await Voice.start("en-US");
      } else {
        // iOS uses native speech recognition
        // For now, show a message that voice input is not yet implemented on iOS
        if (onError) {
          onError(new Error("Voice input not yet implemented on iOS. Please use text input."));
        }
      }
    } catch (error) {
      if (this.onErrorCallback) {
        this.onErrorCallback(
          error instanceof Error ? error : new Error("Failed to start voice recognition")
        );
      }
    }
  }

  async stopListening(): Promise<void> {
    try {
      if (Platform.OS === "android") {
        await Voice.stop();
      }
      this.isListening = false;
    } catch (error) {
      console.error("Error stopping voice recognition:", error);
    }
  }

  speak(text: string, options?: { language?: string; rate?: number; pitch?: number }): void {
    Speech.speak(text, {
      language: options?.language || "en-US",
      rate: options?.rate || 0.9,
      pitch: options?.pitch || 1.0,
    });
  }

  stopSpeaking(): void {
    Speech.stop();
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === "android") {
      try {
        const hasPermission = await Voice.isAvailable();
        return hasPermission;
      } catch (error) {
        console.error("Permission check failed:", error);
        return false;
      }
    }
    return true; // iOS permissions handled by Info.plist
  }
}

export const voiceService = new VoiceService();

