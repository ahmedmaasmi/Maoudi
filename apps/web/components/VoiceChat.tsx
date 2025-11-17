"use client";

import { useState, useEffect, useRef } from "react";
import { getSpeechRecognition, speak, stopSpeaking } from "@/lib/speech";
import { apiClient } from "@/lib/api";
import { ShaderAnimation } from "@/components/ui/shader-lines";
import { AIVoiceInput } from "@/components/ui/ai-voice-input";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function VoiceChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState("");
  const recognitionRef = useRef<ReturnType<typeof getSpeechRecognition> | null>(null);

  useEffect(() => {
    // Load voices when component mounts
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    return () => {
      stopSpeaking();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

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

    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      // Get user location (try browser geolocation first)
      let location: { lat: number; lng: number } | undefined;

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      } catch (error) {
        // Location not available, will try geocoding if location is mentioned in message
        console.log("Location not available, will use geocoding if needed");
      }

      // Use AI agent chat endpoint that uses MCP tools
      const chatResponse = await apiClient.chat(message, location);

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
      } else if (chatResponse.action === "book_appointment" && chatResponse.data) {
        const booking = chatResponse.data;
        response += `\n\n✅ Appointment booked successfully!\n`;
        response += `Appointment ID: ${booking.appointmentId}\n`;
        if (booking.calendarLink) {
          response += `Calendar link: ${booking.calendarLink}`;
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

      const assistantMessage: Message = {
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      speak(response);
    } catch (error) {
      console.error("Error processing message:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      speak("Sorry, I encountered an error. Please try again.");
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
        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-white mt-8 backdrop-blur-sm bg-gray-900/80 border border-gray-700 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-lg mb-2 font-semibold">Welcome to Voice Appointment Booking</p>
              <p className="text-sm text-gray-300">Click the microphone button or type a message to get started</p>
              <p className="text-xs mt-2 text-gray-400">Try: &quot;I need a cardiologist near downtown tomorrow&quot;</p>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-100 border border-gray-700"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-gray-800 text-gray-100 border border-gray-700 px-4 py-2 rounded-lg">
                <p>Processing...</p>
              </div>
            </div>
          )}
        </div>

        {/* Text input form */}
        <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type your message or use voice..."
            className="flex-1 px-4 py-2 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-900 text-white placeholder-gray-500"
            disabled={isProcessing}
          />
          <button
            type="submit"
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={!textInput.trim() || isProcessing}
          >
            Send
          </button>
        </form>

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
        </div>
      </div>
    </div>
  );
}

