"use client";

import { useState, useEffect, useRef } from "react";
import { getSpeechRecognition, speak, stopSpeaking } from "@/lib/speech";
import { apiClient } from "@/lib/api";

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
    const recognition = getSpeechRecognition();
    if (!recognition) {
      alert("Speech recognition is not supported in your browser. Please use Chrome or Edge.");
      return;
    }

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setTextInput(transcript);
      await handleUserMessage(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        alert("Microphone permission denied. Please enable microphone access.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
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
      // Parse the message
      const nluResult = await apiClient.parseMessage(message);

      let response = "";

      if (nluResult.intent === "search_doctors") {
        // Get user location (simplified - in production, use browser geolocation)
        let lat = 40.7128; // Default to NYC
        let lng = -74.0060;

        if (nluResult.entities.location) {
          try {
            const geocode = await apiClient.geocode(nluResult.entities.location);
            lat = geocode.lat;
            lng = geocode.lng;
          } catch (error) {
            response = "I couldn't find that location. Using default location.";
          }
        } else {
          // Try to get user's current location
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            lat = position.coords.latitude;
            lng = position.coords.longitude;
          } catch (error) {
            response = "I'll search using a default location. ";
          }
        }

        if (nluResult.entities.specialty) {
          const doctors = await apiClient.searchDoctors(
            nluResult.entities.specialty,
            lat,
            lng,
            10
          );

          if (doctors.length > 0) {
            response += `I found ${doctors.length} doctor(s) near you:\n\n`;
            doctors.slice(0, 5).forEach((doctor, index) => {
              response += `${index + 1}. ${doctor.name} - ${doctor.specialty}\n`;
              response += `   ${doctor.address} (${doctor.distance?.toFixed(1)} km away)\n\n`;
            });
          } else {
            response += "I couldn't find any doctors matching your criteria.";
          }
        } else {
          response = "What specialty are you looking for?";
        }
      } else if (nluResult.intent === "book_appointment") {
        response = "To book an appointment, please select a doctor and time slot from the options above.";
      } else {
        response = "I can help you find and book appointments with doctors. Try saying something like 'I need a cardiologist near downtown tomorrow'.";
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
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">Welcome to Voice Appointment Booking</p>
            <p className="text-sm">Click the microphone or type a message to get started</p>
            <p className="text-xs mt-2">Try: &quot;I need a cardiologist near downtown tomorrow&quot;</p>
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
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
              <p>Processing...</p>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Type your message or use voice..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isProcessing}
        />
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          className={`px-6 py-2 rounded-lg font-medium ${
            isListening
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
          disabled={isProcessing}
        >
          {isListening ? "🛑 Stop" : "🎤 Voice"}
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50"
          disabled={!textInput.trim() || isProcessing}
        >
          Send
        </button>
      </form>
    </div>
  );
}

