export interface Appointment {
  id: string;
  doctorId: string;
  startUtc: Date;
  endUtc: Date;
  userName: string;
  userEmail: string;
  userPhone?: string | null;
  gcalEventId?: string | null;
  status: "confirmed" | "cancelled" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingRequest {
  doctorId: string;
  startUtc: string; // ISO8601
  endUtc: string; // ISO8601
  user: {
    name: string;
    email: string;
    phone?: string;
  };
}

export interface BookingResponse {
  appointmentId: string;
  gcalEventId: string;
  calendarLink: string;
}

