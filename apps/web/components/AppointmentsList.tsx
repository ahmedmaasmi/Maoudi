"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Calendar, Clock, User, MapPin, Phone, Mail, X } from "lucide-react";

interface Appointment {
  id: string;
  startUtc: string;
  endUtc: string;
  userName: string;
  userEmail: string;
  userPhone?: string | null;
  status: string;
  reason?: string | null;
  notes?: string | null;
  symptoms?: string | null;
  doctor: {
    id: string;
    name: string;
    specialty: string;
    address: string;
    phone?: string | null;
    email?: string | null;
  };
}

export default function AppointmentsList() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "confirmed" | "cancelled" | "completed">("all");

  useEffect(() => {
    loadAppointments();
  }, [filter]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getAppointments(
        filter !== "all" ? { status: filter } : undefined
      );
      setAppointments(data);
    } catch (err) {
      setError("Failed to load appointments");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-500/20 text-green-400 border-green-500/50";
      case "cancelled":
        return "bg-red-500/20 text-red-400 border-red-500/50";
      case "completed":
        return "bg-blue-500/20 text-blue-400 border-blue-500/50";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/50";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "confirmed", "cancelled", "completed"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg transition-colors capitalize ${
              filter === status
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Appointments List */}
      {appointments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No appointments found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">
                    {appointment.doctor.name}
                  </h3>
                  <p className="text-gray-400">{appointment.doctor.specialty}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                    appointment.status
                  )}`}
                >
                  {appointment.status}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-300">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span>{formatDate(appointment.startUtc)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span>
                    {formatTime(appointment.startUtc)} - {formatTime(appointment.endUtc)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span>{appointment.doctor.address}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <User className="w-4 h-4 text-gray-500" />
                  <span>{appointment.userName}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span>{appointment.userEmail}</span>
                </div>
                {appointment.userPhone && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span>{appointment.userPhone}</span>
                  </div>
                )}
                {appointment.reason && (
                  <div className="mt-2 pt-2 border-t border-gray-800">
                    <p className="text-sm text-gray-400">
                      <span className="font-medium">Reason:</span> {appointment.reason}
                    </p>
                  </div>
                )}
                {appointment.symptoms && (
                  <div className="mt-2 pt-2 border-t border-gray-800">
                    <p className="text-sm text-gray-400">
                      <span className="font-medium">Symptoms:</span>{" "}
                      {JSON.parse(appointment.symptoms).join(", ")}
                    </p>
                  </div>
                )}
                {appointment.notes && (
                  <div className="mt-2 pt-2 border-t border-gray-800">
                    <p className="text-sm text-gray-400">
                      <span className="font-medium">Notes:</span> {appointment.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

