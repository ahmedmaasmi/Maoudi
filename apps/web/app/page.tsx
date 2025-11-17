"use client";

import { useState } from "react";
import VoiceChat from "@/components/VoiceChat";
import BookingFlow from "@/components/BookingFlow";

export default function Home() {
  const [mode, setMode] = useState<"voice" | "form">("voice");

  return (
    <main className="min-h-screen bg-black">
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold mb-2 text-white">Voice Appointment Booking</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("voice")}
              className={`px-4 py-2 rounded-lg transition-colors ${
                mode === "voice"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              Voice Chat
            </button>
            <button
              onClick={() => setMode("form")}
              className={`px-4 py-2 rounded-lg transition-colors ${
                mode === "form"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              Form Booking
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {mode === "voice" ? <VoiceChat /> : <BookingFlow />}
      </div>
    </main>
  );
}

