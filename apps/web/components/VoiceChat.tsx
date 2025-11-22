"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSpeechRecognition, speak, stopSpeaking } from "@/lib/speech";
import { apiClient } from "@/lib/api";
import { VoiceAgentClient, VoiceAgentMessage } from "@/lib/voiceAgent";
import { ShaderAnimation } from "@/components/ui/shader-lines";
import { AIVoiceInput } from "@/components/ui/ai-voice-input";
import { Volume2, VolumeX, Plus, MessageSquare, Radio, Mic } from "lucide-react";
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

type ToolAction =
  | "search_doctors"
  | "check_availability"
  | "book_appointment"
  | "schedule_appointment"
  | "get_doctor_schedule"
  | "get_appointment_stats"
  | "search_patients_by_symptom";

const formatDoctorList = (doctors: any[]): string => {
  if (!Array.isArray(doctors) || doctors.length === 0) {
    return "No doctors matched the requested criteria.";
  }

  const header = `I found ${doctors.length} doctor${doctors.length === 1 ? "" : "s"}:`;
  const entries = doctors.slice(0, 5).map((doctor: any, index: number) => {
    const lines = [
      `${index + 1}. ${doctor?.name || "Doctor"}${doctor?.specialty ? ` - ${doctor.specialty}` : ""}`,
    ];

    if (doctor?.address) {
      lines.push(`   ${doctor.address}`);
    }
    if (typeof doctor?.distance === "number") {
      lines.push(`   ${doctor.distance.toFixed(1)} km away`);
    }
    return lines.join("\n");
  });

  return `${header}\n\n${entries.join("\n\n")}`;
};

const formatAvailabilitySlots = (slots: any[]): string => {
  if (!Array.isArray(slots) || slots.length === 0) {
    return "No available slots found in the requested time range.";
  }

  const entries = slots.slice(0, 5).map((slot: any, index: number) => {
    const start = slot?.start || slot?.startUtc;
    const end = slot?.end || slot?.endUtc;
    const startDate = start ? new Date(start).toLocaleString() : "Unknown start";
    const endDate = end ? new Date(end).toLocaleTimeString() : "Unknown end";
    return `${index + 1}. ${startDate} - ${endDate}`;
  });

  return `Available time slots:\n\n${entries.join("\n")}\n\nWould you like to book one of these slots?`;
};

const formatBookingDetails = (booking: any): string | undefined => {
  if (!booking) {
    return undefined;
  }

  const parts: string[] = ["✅ Appointment booked successfully!"];
  if (booking.appointmentId) {
    parts.push(`Appointment ID: ${booking.appointmentId}`);
  }

  const calendarLinks: string[] = [];
  if (booking.googleCalendarLink) {
    calendarLinks.push(`• Google Calendar: ${booking.googleCalendarLink}`);
  }
  if (booking.outlookCalendarLink) {
    calendarLinks.push(`• Outlook: ${booking.outlookCalendarLink}`);
  }
  if (booking.appleCalendarLink) {
    calendarLinks.push(`• Apple Calendar: ${booking.appleCalendarLink}`);
  }
  if (booking.calendarLink) {
    calendarLinks.push(`• View Appointment: ${booking.calendarLink}`);
  }

  if (calendarLinks.length > 0) {
    parts.push("", "📅 Add to Calendar:", ...calendarLinks);
  }

  return parts.join("\n");
};

const formatScheduleDetails = (schedule: any): string => {
  const appointments = schedule?.appointments;
  if (!Array.isArray(appointments) || appointments.length === 0) {
    return "No appointments scheduled in that time range.";
  }

  const startRange = schedule?.range?.startUtc || schedule?.range?.start || appointments[0]?.startUtc;
  const endRange =
    schedule?.range?.endUtc || schedule?.range?.end || appointments[appointments.length - 1]?.endUtc;

  const header = `Doctor schedule from ${new Date(startRange || Date.now()).toLocaleString()} to ${new Date(
    endRange || Date.now()
  ).toLocaleString()}:`;

  const entries = appointments.slice(0, 5).map((appointment: any, index: number) => {
    const start = appointment?.startUtc || appointment?.start;
    const lines = [
      `${index + 1}. ${start ? new Date(start).toLocaleString() : "Unknown time"} - ${
        appointment?.patientName || "Patient"
      } (${appointment?.status || "status unknown"})`,
    ];
    if (appointment?.reason) {
      lines.push(`   Reason: ${appointment.reason}`);
    }
    if (Array.isArray(appointment?.symptoms) && appointment.symptoms.length > 0) {
      lines.push(`   Symptoms: ${appointment.symptoms.join(", ")}`);
    }
    return lines.join("\n");
  });

  return `${header}\n\n${entries.join("\n\n")}`;
};

const formatStatsDetails = (stats: any): string | undefined => {
  if (!stats) {
    return undefined;
  }

  const start = stats.range?.startUtc || stats.range?.start;
  const end = stats.range?.endUtc || stats.range?.end;
  const lines: string[] = [
    `📊 Appointment stats (${start ? new Date(start).toLocaleDateString() : "N/A"} - ${
      end ? new Date(end).toLocaleDateString() : "N/A"
    }):`,
  ];

  if (stats.totals) {
    lines.push(
      `Total: ${stats.totals.total ?? 0} | Confirmed: ${stats.totals.confirmed ?? 0} | Completed: ${
        stats.totals.completed ?? 0
      } | Cancelled: ${stats.totals.cancelled ?? 0}`
    );
  }

  if (Array.isArray(stats.buckets) && stats.buckets.length > 0) {
    lines.push("", "Buckets:");
    stats.buckets.slice(0, 5).forEach((bucket: any) => {
      lines.push(` - ${bucket.label}: ${bucket.total} (completed ${bucket.completed}, cancelled ${bucket.cancelled})`);
    });
  }

  if (Array.isArray(stats.topSymptoms) && stats.topSymptoms.length > 0) {
    lines.push(
      "",
      `Top symptoms: ${stats.topSymptoms.map((entry: any) => `${entry.symptom} (${entry.count})`).join(", ")}`
    );
  }

  return lines.join("\n");
};

const formatPatientMatchDetails = (matches: any[]): string => {
  if (!Array.isArray(matches) || matches.length === 0) {
    return "No patients matched that symptom in the requested range.";
  }

  const header = `Found ${matches.length} patient${matches.length === 1 ? "" : "s"}:`;
  const entries = matches.slice(0, 3).map((match: any, index: number) => {
    const patient = match?.patient || {};
    const lines = [
      `${index + 1}. ${patient.name || "Patient"}${patient.email ? ` (${patient.email})` : ""}`,
    ];

    if (Array.isArray(patient.symptoms) && patient.symptoms.length > 0) {
      lines.push(`   Symptoms: ${patient.symptoms.map((record: any) => record.symptom || record).join(", ")}`);
    }

    if (Array.isArray(match?.recentAppointments) && match.recentAppointments.length > 0) {
      const latest = match.recentAppointments[0];
      lines.push(
        `   Last visit: ${
          latest?.startUtc ? new Date(latest.startUtc).toLocaleString() : "Unknown date"
        } with status ${latest?.status || "unknown"}`
      );
    }

    return lines.join("\n");
  });

  return `${header}\n\n${entries.join("\n\n")}`;
};

const describeToolResult = (
  action?: ToolAction | string,
  data?: any,
  summary?: string,
  error?: string
): string | undefined => {
  const parts: string[] = [];

  if (error) {
    parts.push(`⚠️ ${error}`);
  }

  if (summary) {
    parts.push(summary.trim());
  }

  if (!action || !data) {
    return parts.length > 0 ? parts.join("\n\n") : undefined;
  }

  switch (action) {
    case "search_doctors": {
      const text = formatDoctorList(data?.doctors);
      if (text) {
        parts.push(text);
      }
      break;
    }
    case "check_availability": {
      const text = formatAvailabilitySlots(data?.slots);
      if (text) {
        parts.push(text);
      }
      break;
    }
    case "book_appointment":
    case "schedule_appointment": {
      const text = formatBookingDetails(data);
      if (text) {
        parts.push(text);
      }
      break;
    }
    case "get_doctor_schedule": {
      const text = formatScheduleDetails(data);
      if (text) {
        parts.push(text);
      }
      break;
    }
    case "get_appointment_stats": {
      const text = formatStatsDetails(data);
      if (text) {
        parts.push(text);
      }
      break;
    }
    case "search_patients_by_symptom": {
      const text = formatPatientMatchDetails(data?.matches);
      if (text) {
        parts.push(text);
      }
      break;
    }
    default:
      break;
  }

  return parts.length > 0 ? parts.join("\n\n") : undefined;
};

const tryParseJsonPayload = (value?: string): any | null => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}") + 1;
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(value.slice(start, end));
      } catch {
        return null;
      }
    }
    return null;
  }
};

const extractResponseText = (rawText?: string): string => {
  if (!rawText) {
    return "";
  }

  const cleaned = rawText.replace(/```json|```/gi, "").trim();
  if (!cleaned) {
    return "";
  }

  const parsed = tryParseJsonPayload(cleaned);
  if (parsed) {
    if (typeof parsed.response === "string") {
      return parsed.response;
    }
    if (typeof parsed.message === "string") {
      return parsed.message;
    }
  }

  return cleaned;
};

const formatAgentResponseText = (rawText?: string, toolResult?: any): string => {
  const baseText = extractResponseText(rawText);
  const action = toolResult?.tool || toolResult?.action;
  const data = toolResult?.result ?? toolResult?.data;
  const summary = toolResult?.summary;
  const error = toolResult?.error;

  const details = describeToolResult(action, data, summary, error);
  if (details) {
    return baseText ? `${baseText}\n\n${details}` : details;
  }

  return baseText;
};

export default function VoiceChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [showChatList, setShowChatList] = useState(false);
  const [useLiveVoiceAgent, setUseLiveVoiceAgent] = useState(false);
  const [voiceAgentConnected, setVoiceAgentConnected] = useState(false);
  const [whisperAvailable, setWhisperAvailable] = useState(false);
  const recognitionRef = useRef<ReturnType<typeof getSpeechRecognition> | null>(null);
  const voiceAgentRef = useRef<VoiceAgentClient | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isMutedRef = useRef(isMuted);
  const lastTranscriptRef = useRef<{ text: string; time: number } | null>(null);

  const loadChats = useCallback(async () => {
    try {
      const chatList = await apiClient.getChats();
      setChats(chatList);
    } catch (error) {
      console.error("Failed to load chats:", error);
    }
  }, []);

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

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted) {
      stopSpeaking();
    }
  }, [isMuted]);

  const stopListening = useCallback(() => {
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

    lastTranscriptRef.current = null;
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening();
      if (voiceAgentRef.current) {
        voiceAgentRef.current.disconnect();
        voiceAgentRef.current = null;
      }
    };
  }, [stopListening]);

  useEffect(() => {
    if (!useLiveVoiceAgent) {
      stopListening();
      if (voiceAgentRef.current) {
        voiceAgentRef.current.disconnect();
        voiceAgentRef.current = null;
      }
      setVoiceAgentConnected(false);
      return;
    }

    const client = new VoiceAgentClient();
    voiceAgentRef.current = client;
    stopListening();

    const handleTranscript = (data: VoiceAgentMessage) => {
      if (data.is_final && data.text) {
        const transcript = data.text.trim();
        if (!transcript) {
          return;
        }
        setTextInput(transcript);
        const now = Date.now();
        const last = lastTranscriptRef.current;
        if (!last || last.text !== transcript || now - last.time > 1500) {
          lastTranscriptRef.current = { text: transcript, time: now };
          setMessages((prev) => [
            ...prev,
            {
              role: "user",
              content: transcript,
              timestamp: new Date(),
            },
          ]);
        }
      }
    };

    const handleResponse = (data: VoiceAgentMessage) => {
      const formatted = formatAgentResponseText(data.text, data.tool_result);
      if (!formatted) {
        return;
      }
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: formatted,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      if (!isMutedRef.current) {
        speak(formatted);
      }
      setIsProcessing(false);
    };

    const handleError = (payload: VoiceAgentMessage) => {
      const errorMessage = payload?.message || payload?.text || "Voice agent error.";
      console.error("[VoiceChat] Voice agent error:", payload);
      
      // If it's a Whisper error, we'll use browser STT instead
      if (errorMessage.toLowerCase().includes("whisper")) {
        console.log("[VoiceChat] Whisper unavailable, switching to browser STT mode");
        setWhisperAvailable(false);
        // Don't show error message or disconnect - just use browser STT
        return;
      }
      
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ ${errorMessage}`,
          timestamp: new Date(),
        },
      ]);
      setIsProcessing(false);
    };

    const handleStatus = (payload: VoiceAgentMessage) => {
      if (payload?.message) {
        console.log("[VoiceChat] Voice agent status:", payload.message);
      }
    };

    const handleOpen = () => {
      console.log("[VoiceChat] Voice agent WebSocket opened");
      setVoiceAgentConnected(true);
    };

    const handleClose = () => {
      console.log("[VoiceChat] Voice agent WebSocket closed");
      setVoiceAgentConnected(false);
      setIsProcessing(false);
    };

    client.on("transcript", handleTranscript);
    client.on("response", handleResponse);
    client.on("error", handleError);
    client.on("status", handleStatus);
    client.on("open", handleOpen);
    client.on("close", handleClose);

    console.log("[VoiceChat] Attempting to connect to voice agent...");
    client
      .checkCapabilities()
      .then((capabilities) => {
        setWhisperAvailable(capabilities.whisper_available);
        console.log("[VoiceChat] Voice agent capabilities:", capabilities);
        if (!capabilities.whisper_available) {
          console.log("[VoiceChat] Whisper not available, will use browser STT with text messages");
        }
        return client.connect();
      })
      .then(() => {
        console.log("[VoiceChat] Successfully connected to voice agent");
      })
      .catch((error) => {
        console.error("[VoiceChat] Failed to connect to voice agent:", error);
        setVoiceAgentConnected(false);
        setUseLiveVoiceAgent(false);
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
      setVoiceAgentConnected(false);
    };
  }, [stopListening, useLiveVoiceAgent]);

  const greetUser = useCallback(() => {
    if (isMutedRef.current) {
      return;
    }
    const greeting = "Hello! I'm listening. How can I help you today?";
    stopSpeaking();
    speak(greeting);
  }, []);

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

  const startListening = async () => {
    greetUser();

    if (useLiveVoiceAgent) {
      const client = voiceAgentRef.current;
      if (!client) {
        alert("Voice agent is not ready yet. Please toggle the Live Agent switch again.");
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
                
                // Add user message to chat
                const userMessage: ChatMessage = {
                  role: "user",
                  content: transcript,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, userMessage]);
                setIsProcessing(true);

                // Get user location
                let location: { lat: number; lng: number } | undefined;
                try {
                  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    if (!navigator.geolocation) {
                      reject(new Error("Geolocation not available"));
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 2000 });
                  });
                  location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                  };
                } catch (error) {
                  // Location not available, continue without it
                }

                // Send text message via WebSocket
                if (client.isConnected) {
                  client.sendText(transcript, location);
                } else {
                  console.error("[VoiceChat] Voice agent not connected");
                  setIsProcessing(false);
                }
              }
            } catch (error) {
              console.error("Error processing speech result:", error);
              setIsProcessing(false);
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
              // Don't show alert for no-speech, just stop listening
            } else {
              console.warn(`Speech recognition error: ${event.error}`);
            }
            setIsProcessing(false);
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
          return;
        }

        // Whisper is available - use audio streaming
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Microphone access is not supported in this browser.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
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
          sampleRate: 16000,
        });
        audioContextRef.current = audioContext;
        await audioContext.resume();

        const source = audioContext.createMediaStreamSource(stream);
        sourceNodeRef.current = source;
        // Note: ScriptProcessorNode is deprecated but still widely supported
        // Consider migrating to AudioWorkletNode in the future
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
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
        setIsListening(true);
      } catch (error) {
        console.error("Error starting live voice agent:", error);
        alert(
          "Failed to start the live voice agent. Please verify microphone permissions and that the agent server is running."
        );
        stopListening();
        setIsListening(false);
      }
      return;
    } else {
      // Fallback to Web Speech API
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
    }
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
            setIsProcessing(false);
            return;
          }
        }

        // Get user location
        let location: { lat: number; lng: number } | undefined;
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error("Geolocation not available"));
              return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 2000 });
          });
          location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          console.log("[VoiceChat] Got location:", location);
        } catch (error) {
          console.log("[VoiceChat] Location not available, continuing without it");
        }

        // Send message via WebSocket
        console.log("[VoiceChat] Sending message via WebSocket:", message);
        voiceAgentRef.current.sendText(message, location);
        // Response will be handled by the WebSocket event listener
        return;
      }

      // Fallback to Express API
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
            <button
              onClick={() => setUseLiveVoiceAgent(!useLiveVoiceAgent)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                useLiveVoiceAgent
                  ? voiceAgentConnected
                    ? "bg-green-600/50 hover:bg-green-700/50 text-white"
                    : "bg-yellow-600/50 hover:bg-yellow-700/50 text-white"
                  : "bg-gray-800/50 hover:bg-gray-700/50 text-gray-300"
              }`}
              title={
                useLiveVoiceAgent
                  ? voiceAgentConnected
                    ? "Live Voice Agent (MCP) - Connected"
                    : "Live Voice Agent (MCP) - Connecting..."
                  : "Using Browser Speech API"
              }
            >
              {useLiveVoiceAgent ? (
                <>
                  <Radio className="w-4 h-4" />
                  <span className="text-sm">
                    Live Agent {voiceAgentConnected ? "✓" : "..."}
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span className="text-sm">Browser STT</span>
                </>
              )}
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

