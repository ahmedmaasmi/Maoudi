"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { speak, stopSpeaking } from "@/lib/speech";
import { apiClient } from "@/lib/api";
import { VoiceAgentClient } from "@/lib/voiceAgent";
import { ShaderAnimation } from "@/components/ui/shader-lines";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai/conversation";
import {
  Message,
  MessageContent,
  MessageAvatar,
} from "@/components/ai/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
} from "@/components/ai/prompt-input";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai/reasoning";
import { Response } from "@/components/ai/response";
import { describeToolResult } from "@/lib/formatters";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";
import { useVoiceAgent, ChatMessage } from "@/hooks/useVoiceAgent";
import { ChatHeader } from "@/components/voice-chat/ChatHeader";
import { ChatList } from "@/components/voice-chat/ChatList";
import { VoiceControls } from "@/components/voice-chat/VoiceControls";
import {
  AUDIO_SAMPLE_RATE,
  AUDIO_CHANNEL_COUNT,
  AUDIO_BUFFER_SIZE,
  AUTO_RESTART_DELAY,
} from "@/lib/constants";

interface Chat {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export default function VoiceChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [showChatList, setShowChatList] = useState(false);
  const [useLiveVoiceAgent, setUseLiveVoiceAgent] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for audio streaming (when using Whisper)
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const voiceAgentRef = useRef<VoiceAgentClient | null>(null);
  const shouldAutoRestartRef = useRef(false);

  // Custom hooks
  const { getLocation, getLocationWithTimeout } = useGeolocation();
  
  // State for audio streaming (when using Whisper)
  const [isAudioStreaming, setIsAudioStreaming] = useState(false);

  // Voice recognition hook for browser STT
  const voiceRecognition = useVoiceRecognition({
    onTranscript: (transcript) => {
      setTextInput("");
      if (useLiveVoiceAgent) {
        handleUserMessage(transcript);
      } else {
        shouldAutoRestartRef.current = true;
        handleUserMessage(transcript);
      }
    },
    onError: (errorMsg) => {
      setError(errorMsg);
      setIsProcessing(false);
    },
    autoRestart: !useLiveVoiceAgent,
    onAutoRestart: () => {
      if (shouldAutoRestartRef.current && !isMuted && !useLiveVoiceAgent) {
        setTimeout(() => {
          if (shouldAutoRestartRef.current && !isListeningState) {
            startListening();
          }
        }, AUTO_RESTART_DELAY);
      }
    },
  });

  // Combine listening states: browser STT from hook or audio streaming
  const isListeningState = useMemo(
    () => isAudioStreaming || voiceRecognition.isListening,
    [isAudioStreaming, voiceRecognition.isListening]
  );

  // Voice agent hook
  const {
    isConnected: voiceAgentConnected,
    whisperAvailable,
    client: voiceAgentClient,
    sendText: sendVoiceAgentText,
  } = useVoiceAgent({
    enabled: useLiveVoiceAgent,
    isMuted,
    onUserMessage: (message) => {
      setTextInput("");
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: message,
          timestamp: new Date(),
        },
      ]);
    },
    onAssistantMessage: (message) => {
      setMessages((prev) => [...prev, message]);
      setIsProcessing(false);
    },
    onError: (errorMsg) => {
      setError(errorMsg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ ${errorMsg}`,
          timestamp: new Date(),
        },
      ]);
      setIsProcessing(false);
    },
    onStatusChange: (connected) => {
      // Status change handled by hook
    },
    autoRestartListening: () => {
      if (shouldAutoRestartRef.current && !isMuted && !useLiveVoiceAgent) {
        setTimeout(() => {
          if (shouldAutoRestartRef.current && !isListeningState) {
            startListening();
          }
        }, AUTO_RESTART_DELAY);
      }
    },
    isListening: isListeningState,
  });

  // Keep voice agent ref in sync
  useEffect(() => {
    voiceAgentRef.current = voiceAgentClient;
  }, [voiceAgentClient]);

  // Load chats on mount
  const loadChats = useCallback(async () => {
    try {
      setIsLoadingChats(true);
      setError(null);
      const chatList = await apiClient.getChats();
      setChats(chatList);
    } catch (error) {
      console.error("Failed to load chats:", error);
      setError("Failed to load chats. Please try again.");
    } finally {
      setIsLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Initialize speech synthesis voices
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }

    window.speechSynthesis.getVoices();
    const handleVoicesChanged = () => {
      window.speechSynthesis?.getVoices();
    };
    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Handle mute state
  useEffect(() => {
    if (isMuted) {
      stopSpeaking();
    }
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening();
      if (voiceAgentRef.current) {
        voiceAgentRef.current.disconnect();
        voiceAgentRef.current = null;
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    shouldAutoRestartRef.current = false;
    voiceRecognition.stopListening();

    // Clean up audio streaming resources
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    setIsAudioStreaming(false);
  }, [voiceRecognition]);

  const startListening = useCallback(async () => {
    shouldAutoRestartRef.current = false;

    if (useLiveVoiceAgent) {
      const client = voiceAgentRef.current;
      if (!client) {
        setError("Voice agent is not ready yet. Please toggle the Live Agent switch again.");
        setUseLiveVoiceAgent(false);
        return;
      }

      try {
        if (!client.isConnected) {
          await client.connect();
        }

        // If Whisper is not available, use browser STT and send text via WebSocket
        if (!whisperAvailable) {
          console.log("[VoiceChat] Using browser STT with voice agent (Whisper unavailable)");
          voiceRecognition.startListening();
          return;
        }

        // Whisper is available - use audio streaming
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Microphone access is not supported in this browser.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: AUDIO_SAMPLE_RATE,
            channelCount: AUDIO_CHANNEL_COUNT,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        mediaStreamRef.current = stream;

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error("Web Audio API is not supported in this browser.");
        }
        const audioContext: AudioContext = new AudioContextClass({
          sampleRate: AUDIO_SAMPLE_RATE,
        });
        audioContextRef.current = audioContext;
        await audioContext.resume();

        const source = audioContext.createMediaStreamSource(stream);
        sourceNodeRef.current = source;
        const processor = audioContext.createScriptProcessor(AUDIO_BUFFER_SIZE, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          if (voiceAgentRef.current?.isConnected) {
            const inputData = event.inputBuffer.getChannelData(0);
            const int16Array = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              const sample = Math.max(-1, Math.min(1, inputData[i]));
              int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
            }
            voiceAgentRef.current.sendAudio(int16Array.buffer);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        setIsAudioStreaming(true);
      } catch (error) {
        console.error("Error starting live voice agent:", error);
        setError(
          "Failed to start the live voice agent. Please verify microphone permissions and that the agent server is running."
        );
        stopListening();
        setIsAudioStreaming(false);
      }
      return;
    } else {
      // Fallback to Web Speech API
      voiceRecognition.startListening();
            shouldAutoRestartRef.current = true;
    }
  }, [useLiveVoiceAgent, whisperAvailable, voiceRecognition, stopListening]);

  const handleUserMessage = useCallback(
    async (message: string) => {
    if (!message.trim()) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);
      setError(null);

    try {
      // If live voice agent is enabled, use WebSocket
      if (useLiveVoiceAgent) {
        console.log("[VoiceChat] Live voice agent enabled, checking connection...");
        if (!voiceAgentRef.current) {
          console.error("[VoiceChat] Voice agent client not initialized");
          setIsProcessing(false);
          return;
        }
        
        if (!voiceAgentRef.current.isConnected) {
          console.log("[VoiceChat] Not connected, attempting to connect...");
          try {
            await voiceAgentRef.current.connect();
            console.log("[VoiceChat] Connected successfully");
          } catch (error) {
            console.error("[VoiceChat] Failed to connect:", error);
              setError("Failed to connect to voice agent. Please try again.");
            setIsProcessing(false);
            return;
          }
        }

        // Get user location
          const location = await getLocation();

        // Send message via WebSocket
        console.log("[VoiceChat] Sending message via WebSocket:", message);
        voiceAgentRef.current.sendText(message, location);
        // Response will be handled by the WebSocket event listener
        return;
      }

      // Fallback to Express API
        const finalLocation = await getLocationWithTimeout();

      // Use AI agent chat endpoint that uses MCP tools
      const chatResponse = await apiClient.chat(message, finalLocation, currentChatId || undefined);
      
      // Update currentChatId if a new chat was created
      if (chatResponse.chatId && chatResponse.chatId !== currentChatId) {
        setCurrentChatId(chatResponse.chatId);
        await loadChats();
      } else if (chatResponse.chatId === currentChatId) {
        // Refresh chat list to get updated title
        await loadChats();
      }

      let response = chatResponse.response;
      const actionDetails = describeToolResult(chatResponse.action, chatResponse.data);
      if (actionDetails) {
        response = response ? `${response}\n\n${actionDetails}` : actionDetails;
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (!isMuted) {
        await speak(response);
        // Auto-restart recording if browser STT is active and not using live voice agent
        if (!useLiveVoiceAgent && shouldAutoRestartRef.current && !isMuted) {
          setTimeout(() => {
            if (shouldAutoRestartRef.current && !isListeningState) {
              startListening();
            }
            }, AUTO_RESTART_DELAY);
        }
      }
    } catch (error) {
      console.error("Error processing message:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
        setError("Failed to process message. Please try again.");
      if (!isMuted) {
        await speak("Sorry, I encountered an error. Please try again.");
        // Auto-restart recording if browser STT is active and not using live voice agent
        if (!useLiveVoiceAgent && shouldAutoRestartRef.current && !isMuted) {
          setTimeout(() => {
              if (shouldAutoRestartRef.current && !isListeningState) {
              startListening();
            }
            }, AUTO_RESTART_DELAY);
        }
      }
    } finally {
      setIsProcessing(false);
    }
    },
    [useLiveVoiceAgent, currentChatId, loadChats, isMuted, isListeningState, getLocation, getLocationWithTimeout, startListening]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing) return;
    await handleUserMessage(textInput);
    setTextInput("");
    },
    [textInput, isProcessing, handleUserMessage]
  );

  const createNewChat = useCallback(async () => {
    try {
      setError(null);
      const newChat = await apiClient.createChat("New Chat");
      setCurrentChatId(newChat.chatId);
      setMessages([]);
      await loadChats();
      setShowChatList(false);
    } catch (error) {
      console.error("Failed to create chat:", error);
      setError("Failed to create new chat. Please try again.");
    }
  }, [loadChats]);

  const loadChat = useCallback(
    async (chatId: string) => {
      try {
        setError(null);
        const chat = await apiClient.getChat(chatId);
        setCurrentChatId(chatId);
        setMessages(
          chat.messages.map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
            timestamp: new Date(msg.createdAt),
          }))
        );
        setShowChatList(false);
      } catch (error) {
        console.error("Failed to load chat:", error);
        setError("Failed to load chat. Please try again.");
      }
    },
    []
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      if (!prev) {
        stopSpeaking();
      }
      return !prev;
    });
  }, []);

  // Memoized components
  const chatHeader = useMemo(
    () => (
      <ChatHeader
        onToggleChatList={() => setShowChatList((prev) => !prev)}
        onCreateNewChat={createNewChat}
        useLiveVoiceAgent={useLiveVoiceAgent}
        voiceAgentConnected={voiceAgentConnected}
        onToggleLiveAgent={() => setUseLiveVoiceAgent((prev) => !prev)}
        isLoading={isProcessing || isLoadingChats}
      />
    ),
    [useLiveVoiceAgent, voiceAgentConnected, isProcessing, isLoadingChats, createNewChat]
  );

  const chatList = useMemo(
    () =>
      showChatList ? (
        <ChatList
          chats={chats}
          currentChatId={currentChatId}
          onSelectChat={loadChat}
          isLoading={isLoadingChats}
        />
      ) : null,
    [showChatList, chats, currentChatId, loadChat, isLoadingChats]
  );

  const voiceControls = useMemo(
    () => (
      <VoiceControls
        isListening={isListeningState}
        isMuted={isMuted}
        onStartListening={startListening}
        onStopListening={stopListening}
        onToggleMute={toggleMute}
        isLoading={isProcessing}
      />
    ),
    [isListeningState, isMuted, startListening, stopListening, toggleMute, isProcessing]
  );

  return (
    <div className="relative flex flex-col h-screen max-w-4xl mx-auto p-4 overflow-hidden bg-black">
      {/* Shader Background */}
      <div className="absolute inset-0 -z-10">
        <ShaderAnimation />
      </div>

      {/* Content with backdrop blur for readability */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Error Message */}
        {error && (
          <div
            className="mb-4 px-4 py-2 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm"
            role="alert"
            aria-live="polite"
          >
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline"
              aria-label="Dismiss error"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Chat Header */}
        {chatHeader}

        {/* Chat List Sidebar */}
        {chatList}

        <Conversation className="relative w-full flex-1 mb-4" style={{ height: "calc(100vh - 200px)" }}>
          <ConversationContent>
            {messages.length === 0 && (
              <div className="text-center text-white mt-8 backdrop-blur-sm bg-gray-900/80 border border-gray-700 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-lg mb-2 font-semibold">Welcome to Voice Appointment Booking</p>
                <p className="text-sm text-gray-300">Click the microphone button or type a message to get started</p>
                <p className="text-xs mt-2 text-gray-400">
                  Try: &quot;I need a cardiologist near downtown tomorrow&quot;
                </p>
              </div>
            )}
            {messages.map((message, index) => (
              <Message key={index} from={message.role}>
                <MessageAvatar 
                  src={message.role === "user" ? "" : ""} 
                  name={message.role === "user" ? "User" : "AI"} 
                />
                <MessageContent>
                  {message.role === "assistant" ? <Response>{message.content}</Response> : message.content}
                </MessageContent>
              </Message>
            ))}
            {isProcessing && (
              <Reasoning isStreaming={isProcessing}>
                <ReasoningTrigger title="Thinking" />
                <ReasoningContent>Processing your request...</ReasoningContent>
              </Reasoning>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Text input form */}
        <PromptInput onSubmit={handleSubmit} className="mb-4">
          <PromptInputTextarea
            value={textInput}
            onChange={(e) => setTextInput(e.currentTarget.value)}
            placeholder="Type your message or use voice..."
            disabled={isProcessing}
            aria-label="Message input"
          />
          <PromptInputToolbar>
            <PromptInputSubmit disabled={!textInput.trim() || isProcessing} />
          </PromptInputToolbar>
        </PromptInput>

        {/* Voice Input Controls */}
        {voiceControls}
      </div>
    </div>
  );
}
