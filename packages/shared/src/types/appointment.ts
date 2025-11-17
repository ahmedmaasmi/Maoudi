export interface Appointment {
  id: string;
  doctorId: string;
  patientId?: string | null;
  startUtc: Date;
  endUtc: Date;
  userName: string;
  userEmail: string;
  userPhone?: string | null;
  reason?: string | null;
  notes?: string | null;
  symptoms?: string[] | null;
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

export type ScheduleAppointmentRequest = Omit<BookingRequest, "endUtc"> & {
  endUtc?: string;
  reason?: string;
  symptoms?: string[];
  notes?: string;
  durationMinutes?: number;
};

export interface BookingResponse {
  appointmentId: string;
  gcalEventId: string;
  calendarLink: string;
}

export interface ScheduleAppointmentResponse extends BookingResponse {
  patientId?: string;
}

