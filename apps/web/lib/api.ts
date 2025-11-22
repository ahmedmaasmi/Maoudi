import axios, { AxiosInstance } from "axios";
import type {
  BookingRequest,
  ScheduleAppointmentRequest,
  ScheduleAppointmentResponse,
  DoctorScheduleResponse,
  DoctorStatsResponse,
  PatientSymptomSearchMatch,
} from "@voice-appointment/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
  email?: string | null;
  distance?: number;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
}

export interface BookingResponse {
  appointmentId: string;
  gcalEventId: string;
  calendarLink: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
}

export interface NLUResult {
  intent: string;
  entities: {
    specialty?: string;
    location?: string;
    dateRange?: {
      start: string;
      end: string;
    };
  };
}

export const apiClient = {
  searchDoctors: async (specialty: string, lat: number, lng: number, radiusKm: number = 10) => {
    const response = await api.get<{ doctors: Doctor[] }>("/doctors/search", {
      params: { specialty, lat, lng, radiusKm },
    });
    return response.data.doctors;
  },

  checkAvailability: async (
    doctorId: string,
    startRangeUtc: string,
    endRangeUtc: string,
    slotMinutes: number = 30
  ) => {
    const response = await api.post<{ slots: AvailabilitySlot[] }>("/availability", {
      doctorId,
      startRangeUtc,
      endRangeUtc,
      slotMinutes,
    });
    return response.data.slots;
  },

  bookAppointment: async (request: BookingRequest) => {
    const response = await api.post<BookingResponse>("/appointments/book", request);
    return response.data;
  },

  scheduleAppointment: async (request: ScheduleAppointmentRequest) => {
    const response = await api.post<ScheduleAppointmentResponse>("/appointments/schedule", request);
    return response.data;
  },

  getDoctorSchedule: async (doctorId: string, startUtc: string, endUtc: string) => {
    const response = await api.get<DoctorScheduleResponse>(`/doctors/${doctorId}/schedule`, {
      params: { startUtc, endUtc },
    });
    return response.data;
  },

  getAppointmentStats: async (
    doctorId: string,
    startUtc: string,
    endUtc: string,
    groupBy: "day" | "week" | "month" = "day"
  ) => {
    const response = await api.get<DoctorStatsResponse>(`/doctors/${doctorId}/stats`, {
      params: { startUtc, endUtc, groupBy },
    });
    return response.data;
  },

  searchPatientsBySymptom: async (params: {
    symptom: string;
    doctorId?: string;
    startUtc?: string;
    endUtc?: string;
  }) => {
    const response = await api.get<{ matches: PatientSymptomSearchMatch[] }>("/patients/search", {
      params,
    });
    return response.data.matches;
  },

  geocode: async (query: string) => {
    const response = await api.get<GeocodeResult>("/geocode", {
      params: { q: query },
    });
    return response.data;
  },

  parseMessage: async (message: string) => {
    const response = await api.post<NLUResult>("/nlu/parse", { message });
    return response.data;
  },

  chat: async (message: string, location?: { lat: number; lng: number }, chatId?: string) => {
    const response = await api.post<{
      chatId: string;
      response: string;
      action?: string;
      data?: any;
    }>("/chat", { message, location, chatId });
    return response.data;
  },

  createChat: async (title?: string, userId?: string) => {
    const response = await api.post<{ chatId: string; title: string }>("/chat/new", { title, userId });
    return response.data;
  },

  getChats: async (userId?: string) => {
    const response = await api.get<Array<{
      id: string;
      title: string;
      userId: string | null;
      createdAt: string;
      updatedAt: string;
      messageCount: number;
    }>>("/chat", { params: userId ? { userId } : {} });
    return response.data;
  },

  getChat: async (chatId: string) => {
    const response = await api.get<{
      id: string;
      title: string;
      userId: string | null;
      messages: Array<{
        id: string;
        role: string;
        content: string;
        metadata: any;
        createdAt: string;
      }>;
      createdAt: string;
      updatedAt: string;
    }>(`/chat/${chatId}`);
    return response.data;
  },

  getAppointments: async (params?: { status?: string; email?: string }) => {
    const response = await api.get<{
      appointments: Array<{
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
        doctor: Doctor;
      }>;
    }>("/appointments", { params });
    return response.data.appointments;
  },

  getAllDoctors: async (specialty?: string) => {
    const response = await api.get<{ doctors: Doctor[] }>("/doctors", {
      params: specialty ? { specialty } : {},
    });
    return response.data.doctors;
  },

  // Voice Agent Service (Live Voice MCP Agent)
  voiceAgent: {
    getUrl: () => {
      return process.env.NEXT_PUBLIC_VOICE_AGENT_URL || "http://localhost:5007";
    },
    
    chat: async (message: string, location?: { lat: number; lng: number }, chatId?: string) => {
      const voiceAgentUrl = process.env.NEXT_PUBLIC_VOICE_AGENT_URL || "http://localhost:5007";
      const response = await axios.post<{
        response: string;
        tool_result?: any;
        chatId?: string;
      }>(`${voiceAgentUrl}/chat`, {
        message,
        location,
        chatId,
      });
      return response.data;
    },
  },
};

