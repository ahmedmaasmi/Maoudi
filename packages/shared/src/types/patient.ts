export interface Patient {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientSymptomRecord {
  symptom: string;
  notedAt: string;
}

export interface PatientSummary extends Patient {
  symptoms: PatientSymptomRecord[];
}

export interface DoctorScheduleEntry {
  appointmentId: string;
  startUtc: string;
  endUtc: string;
  status: "confirmed" | "cancelled" | "completed";
  patientName: string;
  patientEmail: string;
  reason?: string | null;
  notes?: string | null;
  symptoms?: string[] | null;
}

export interface DoctorScheduleResponse {
  doctorId: string;
  range: {
    startUtc: string;
    endUtc: string;
  };
  appointments: DoctorScheduleEntry[];
}

export interface DoctorStatsBucket {
  label: string;
  total: number;
  completed: number;
  cancelled: number;
}

export interface DoctorStatsResponse {
  doctorId: string;
  range: {
    startUtc: string;
    endUtc: string;
  };
  totals: {
    total: number;
    confirmed: number;
    cancelled: number;
    completed: number;
  };
  buckets: DoctorStatsBucket[];
  topSymptoms: Array<{ symptom: string; count: number }>;
}

export interface PatientSymptomSearchMatch {
  patient: PatientSummary;
  recentAppointments: DoctorScheduleEntry[];
}


