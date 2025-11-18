"use client";

import { useState } from "react";
import VoiceChat from "@/components/VoiceChat";
import BookingFlow from "@/components/BookingFlow";
import AppointmentsList from "@/components/AppointmentsList";
import DoctorsList from "@/components/DoctorsList";
import { Calendar, Stethoscope, MessageSquare, FileText } from "lucide-react";

export default function Home() {
  const [mode, setMode] = useState<"voice" | "form" | "appointments" | "doctors">("voice");

  return (
    <main className="min-h-screen bg-black">
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold mb-4 text-white">Voice Appointment Booking</h1>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setMode("voice")}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                mode === "voice"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Voice Chat
            </button>
            <button
              onClick={() => setMode("form")}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                mode === "form"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <FileText className="w-4 h-4" />
              Form Booking
            </button>
            <button
              onClick={() => setMode("appointments")}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                mode === "appointments"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <Calendar className="w-4 h-4" />
              Appointments
            </button>
            <button
              onClick={() => setMode("doctors")}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                mode === "doctors"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              Doctors
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {mode === "voice" && <VoiceChat />}
        {mode === "form" && <BookingFlow />}
        {mode === "appointments" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Booked Appointments</h2>
            <AppointmentsList />
          </div>
        )}
        {mode === "doctors" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Doctors</h2>
            <DoctorsList />
          </div>
        )}
      </div>
    </main>
  );
}

