import axios from "axios";
import type { BookingRequest, NLUParseRequest } from "@voice-appointment/shared";

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
};

