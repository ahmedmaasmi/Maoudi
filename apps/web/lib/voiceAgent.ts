/**
 * Voice Agent WebSocket Client
 * Connects to the live voice MCP agent service for real-time voice interaction
 */

const VOICE_AGENT_URL = process.env.NEXT_PUBLIC_VOICE_AGENT_URL || "http://localhost:5007";
const WS_URL = VOICE_AGENT_URL.replace("http://", "ws://").replace("https://", "wss://");

import { ToolResult } from "./formatters";

export interface VoiceAgentMessage {
  type: "transcript" | "response" | "status" | "error";
  text?: string;
  is_final?: boolean;
  tool_result?: ToolResult;
  message?: string;
}

export interface VoiceAgentCapabilities {
  whisper_available: boolean;
  ollama_model?: string;
  whisper_model?: string | null;
}

export class VoiceAgentClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isConnecting = false;

  constructor() {
    // Initialize event listener maps
    this.listeners.set("transcript", new Set());
    this.listeners.set("response", new Set());
    this.listeners.set("status", new Set());
    this.listeners.set("error", new Set());
    this.listeners.set("open", new Set());
    this.listeners.set("close", new Set());
  }

  async checkCapabilities(): Promise<VoiceAgentCapabilities> {
    try {
      const response = await fetch(`${VOICE_AGENT_URL}/capabilities`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("[VoiceAgent] Failed to check capabilities:", error);
      // Default to assuming Whisper is not available
      return { whisper_available: false };
    }
  }

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.isConnecting) {
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkInterval);
            resolve();
          } else if (!this.isConnecting) {
            clearInterval(checkInterval);
            reject(new Error("Connection failed"));
          }
        }, 100);
      });
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${WS_URL}/ws/voice`;
        console.log(`[VoiceAgent] Connecting to: ${wsUrl}`);
        console.log(`[VoiceAgent] VOICE_AGENT_URL: ${VOICE_AGENT_URL}`);
        console.log(`[VoiceAgent] WS_URL: ${WS_URL}`);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.emit("open", {});
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data: VoiceAgentMessage = JSON.parse(event.data);
            console.log("[VoiceAgent] Received message:", data);
            this.emit(data.type, data);
          } catch (error) {
            console.error("[VoiceAgent] Failed to parse WebSocket message:", error, event.data);
          }
        };

        this.ws.onerror = (error) => {
          console.error("[VoiceAgent] WebSocket error:", error);
          this.isConnecting = false;
          this.emit("error", { error });
          reject(error);
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          this.emit("close", {});
          this.attemptReconnect();
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
        this.connect().catch(console.error);
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  sendText(message: string, location?: { lat: number; lng: number }) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const payload = {
        type: "text",
        message,
        location,
      };
      console.log("[VoiceAgent] Sending text message:", payload);
      this.ws.send(JSON.stringify(payload));
    } else {
      console.error("[VoiceAgent] WebSocket is not connected. State:", this.ws?.readyState);
    }
  }

  sendAudio(audioData: ArrayBuffer) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
    } else {
      console.error("WebSocket is not connected");
    }
  }

  reset() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "reset" }));
    }
  }

  on(event: string, callback: (data: any) => void) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.add(callback);
    }
  }

  off(event: string, callback: (data: any) => void) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

