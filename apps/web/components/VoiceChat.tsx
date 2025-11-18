"use client";

import { useState, useEffect, useRef } from "react";
import { getSpeechRecognition, speak, stopSpeaking } from "@/lib/speech";
import { apiClient } from "@/lib/api";
import { ShaderAnimation } from "@/components/ui/shader-lines";
import { AIVoiceInput } from "@/components/ui/ai-voice-input";
import { Volume2, VolumeX, Plus, MessageSquare } from "lucide-react";
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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Chat {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export default function VoiceChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [showChatList, setShowChatList] = useState(false);
  const recognitionRef = useRef<ReturnType<typeof getSpeechRecognition> | null>(null);

  useEffect(() => {
    // Load voices when component mounts
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    // Load chats on mount
    loadChats();

    return () => {
      stopSpeaking();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const loadChats = async () => {
    try {
      const chatList = await apiClient.getChats();
      setChats(chatList);
    } catch (error) {
      console.error("Failed to load chats:", error);
    }
  };

  const createNewChat = async () => {
    try {
      const newChat = await apiClient.createChat("New Chat");
      setCurrentChatId(newChat.chatId);
      setMessages([]);
      await loadChats();
      setShowChatList(false);
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  };

  const loadChat = async (chatId: string) => {
    try {
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
    }
  };

  const startListening = () => {
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
      alert("Speech recognition is not supported in your browser. Please use Chrome or Edge.");
      return;
    }

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = async (event) => {
      try {
        const transcript = event.results[0][0].transcript;
        if (transcript && transcript.trim()) {
          setTextInput(transcript);
          await handleUserMessage(transcript);
        }
      } catch (error) {
        console.error("Error processing speech result:", error);
      } finally {
        setIsListening(false);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      recognitionRef.current = null;
      if (event.error === "not-allowed") {
        alert("Microphone permission denied. Please enable microphone access in your browser settings.");
      } else if (event.error === "no-speech") {
        alert("No speech detected. Please try again.");
      } else if (event.error === "network") {
        alert("Network error. Please check your connection.");
      } else {
        alert(`Speech recognition error: ${event.error}. Please try again.`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      setIsListening(false);
      alert("Failed to start speech recognition. Please try again.");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch (error) {
        console.warn("Error stopping speech recognition:", error);
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const handleUserMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      // Get user location asynchronously (non-blocking) - don't wait for it
      let location: { lat: number; lng: number } | undefined;
      
      // Start geolocation request but don't wait for it
      const locationPromise = new Promise<{ lat: number; lng: number } | undefined>((resolve) => {
        if (!navigator.geolocation) {
          resolve(undefined);
          return;
        }
        
        // Use a shorter timeout and don't block
        const timeoutId = setTimeout(() => {
          resolve(undefined);
        }, 2000); // Reduced from 5s to 2s
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          () => {
            clearTimeout(timeoutId);
            resolve(undefined);
          },
          { timeout: 2000, maximumAge: 60000 } // Cache for 1 minute
        );
      });

      // Start the chat request immediately, location will be added if available
      locationPromise.then((loc) => {
        // If location arrives after chat starts, it's okay - the backend can handle it
        if (loc) {
          location = loc;
        }
      }).catch(() => {
        // Ignore location errors
      });

      // Wait a short time for location, but proceed if it takes too long
      const locationWithTimeout = Promise.race([
        locationPromise,
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 500))
      ]);

      const finalLocation = await locationWithTimeout;

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

      // Handle tool actions and format response
      if (chatResponse.action === "search_doctors" && chatResponse.data?.doctors) {
        const doctors = chatResponse.data.doctors;
        if (doctors.length > 0) {
          response += `\n\nI found ${doctors.length} doctor(s):\n\n`;
          doctors.slice(0, 5).forEach((doctor: any, index: number) => {
            response += `${index + 1}. ${doctor.name} - ${doctor.specialty}\n`;
            response += `   ${doctor.address}${doctor.distance ? ` (${doctor.distance.toFixed(1)} km away)` : ""}\n\n`;
          });
        }
      } else if (chatResponse.action === "check_availability" && chatResponse.data?.slots) {
        const slots = chatResponse.data.slots;
        if (slots.length > 0) {
          response += `\n\nAvailable time slots:\n\n`;
          slots.slice(0, 5).forEach((slot: any, index: number) => {
            const start = new Date(slot.start);
            const end = new Date(slot.end);
            response += `${index + 1}. ${start.toLocaleString()} - ${end.toLocaleTimeString()}\n`;
          });
          response += `\nWould you like to book one of these slots?`;
        } else {
          response += "\n\nNo available slots found in the requested time range.";
        }
      } else if ((chatResponse.action === "book_appointment" || chatResponse.action === "schedule_appointment") && chatResponse.data) {
        const booking = chatResponse.data;
        response += `\n\n✅ Appointment booked successfully!\n`;
        response += `Appointment ID: ${booking.appointmentId}\n\n`;
        response += `📅 Add to Calendar:\n`;
        if (booking.googleCalendarLink) {
          response += `• Google Calendar: ${booking.googleCalendarLink}\n`;
        }
        if (booking.outlookCalendarLink) {
          response += `• Outlook: ${booking.outlookCalendarLink}\n`;
        }
        if (booking.appleCalendarLink) {
          response += `• Apple Calendar: ${booking.appleCalendarLink}\n`;
        }
        if (booking.calendarLink) {
          response += `• View Appointment: ${booking.calendarLink}\n`;
        }
      } else if (chatResponse.action === "get_doctor_schedule" && chatResponse.data?.appointments) {
        const schedule = chatResponse.data;
        response += `\n\nDoctor schedule from ${new Date(schedule.range?.startUtc || Date.now()).toLocaleString()} to ${new Date(
          schedule.range?.endUtc || Date.now()
        ).toLocaleString()}:\n`;
        schedule.appointments.slice(0, 5).forEach((appointment: any, index: number) => {
          response += `\n${index + 1}. ${new Date(appointment.startUtc).toLocaleString()} - ${
            appointment.patientName
          } (${appointment.status})`;
          if (appointment.reason) {
            response += `\n   Reason: ${appointment.reason}`;
          }
          if (appointment.symptoms?.length) {
            response += `\n   Symptoms: ${appointment.symptoms.join(", ")}`;
          }
        });
      } else if (chatResponse.action === "get_appointment_stats" && chatResponse.data?.totals) {
        const stats = chatResponse.data;
        response += `\n\n📊 Appointment stats (${new Date(stats.range.startUtc).toLocaleDateString()} - ${new Date(
          stats.range.endUtc
        ).toLocaleDateString()}):\n`;
        response += `Total: ${stats.totals.total} | Confirmed: ${stats.totals.confirmed} | Completed: ${stats.totals.completed} | Cancelled: ${stats.totals.cancelled}\n`;
        if (stats.buckets?.length) {
          response += `\nBuckets:\n`;
          stats.buckets.slice(0, 5).forEach((bucket: any) => {
            response += ` - ${bucket.label}: ${bucket.total} (completed ${bucket.completed}, cancelled ${bucket.cancelled})\n`;
          });
        }
        if (stats.topSymptoms?.length) {
          response += `\nTop symptoms: ${stats.topSymptoms
            .map((entry: any) => `${entry.symptom} (${entry.count})`)
            .join(", ")}`;
        }
      } else if (chatResponse.action === "search_patients_by_symptom" && chatResponse.data?.matches) {
        const matches = chatResponse.data.matches;
        if (matches.length === 0) {
          response += `\n\nNo patients matched that symptom in the requested range.`;
        } else {
          response += `\n\nFound ${matches.length} patient(s):\n`;
          matches.slice(0, 3).forEach((match: any, index: number) => {
            response += `\n${index + 1}. ${match.patient.name} (${match.patient.email})`;
            if (match.patient.symptoms?.length) {
              response += `\n   Symptoms: ${match.patient.symptoms
                .map((record: any) => record.symptom)
                .join(", ")}`;
            }
            if (match.recentAppointments?.length) {
              const latest = match.recentAppointments[0];
              response += `\n   Last visit: ${new Date(latest.startUtc).toLocaleString()} with status ${latest.status}`;
            }
            response += "\n";
          });
        }
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (!isMuted) {
        speak(response);
      }
    } catch (error) {
      console.error("Error processing message:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      if (!isMuted) {
        speak("Sorry, I encountered an error. Please try again.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing) return;
    await handleUserMessage(textInput);
    setTextInput("");
  };

  return (
    <div className="relative flex flex-col h-screen max-w-4xl mx-auto p-4 overflow-hidden bg-black">
      {/* Shader Background */}
      <div className="absolute inset-0 -z-10">
        <ShaderAnimation />
      </div>

      {/* Content with backdrop blur for readability */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Chat Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChatList(!showChatList)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm">Chats</span>
            </button>
            <button
              onClick={createNewChat}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">New Chat</span>
            </button>
          </div>
        </div>

        {/* Chat List Sidebar */}
        {showChatList && (
          <div className="absolute left-4 top-16 z-30 w-64 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg p-2 max-h-96 overflow-y-auto">
            <div className="space-y-1">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => loadChat(chat.id)}
                  className={`w-full text-left px-3 py-2 rounded hover:bg-gray-800 transition-colors ${
                    currentChatId === chat.id ? "bg-gray-800 border border-gray-600" : ""
                  }`}
                >
                  <div className="text-sm font-medium text-gray-200 truncate">{chat.title}</div>
                  <div className="text-xs text-gray-400">
                    {chat.messageCount} message{chat.messageCount !== 1 ? "s" : ""}
                  </div>
                </button>
              ))}
              {chats.length === 0 && (
                <div className="text-sm text-gray-400 px-3 py-2">No chats yet</div>
              )}
            </div>
          </div>
        )}
        <Conversation className="relative w-full flex-1 mb-4" style={{ height: "calc(100vh - 200px)" }}>
          <ConversationContent>
            {messages.length === 0 && (
              <div className="text-center text-white mt-8 backdrop-blur-sm bg-gray-900/80 border border-gray-700 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-lg mb-2 font-semibold">Welcome to Voice Appointment Booking</p>
                <p className="text-sm text-gray-300">Click the microphone button or type a message to get started</p>
                <p className="text-xs mt-2 text-gray-400">Try: &quot;I need a cardiologist near downtown tomorrow&quot;</p>
              </div>
            )}
            {messages.map((message, index) => (
              <Message key={index} from={message.role}>
                <MessageAvatar 
                  src={message.role === "user" ? "" : ""} 
                  name={message.role === "user" ? "User" : "AI"} 
                />
                <MessageContent>
                  {message.role === "assistant" ? (
                    <Response>{message.content}</Response>
                  ) : (
                    message.content
                  )}
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
          />
          <PromptInputToolbar>
            <PromptInputSubmit disabled={!textInput.trim() || isProcessing} />
          </PromptInputToolbar>
        </PromptInput>

        {/* Voice Input Controls */}
        <div className="relative z-20 flex flex-col items-center gap-4 pb-4">
          <AIVoiceInput 
            submitted={isListening}
            onSubmittedChange={(submitted) => {
              if (submitted) {
                startListening();
              } else {
                stopListening();
              }
            }}
          />
          {/* Mute/Unmute Button */}
          <button
            onClick={() => {
              setIsMuted(!isMuted);
              if (!isMuted) {
                stopSpeaking();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 transition-colors"
            title={isMuted ? "Unmute audio" : "Mute audio"}
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
      </div>
    </div>
  );
}

