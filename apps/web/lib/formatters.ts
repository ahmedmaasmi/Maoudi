/**
 * Formatters for voice chat tool results and agent responses
 */

export type ToolAction =
  | "search_doctors"
  | "check_availability"
  | "book_appointment"
  | "schedule_appointment"
  | "get_doctor_schedule"
  | "get_appointment_stats"
  | "search_patients_by_symptom";

export interface Doctor {
  name?: string;
  specialty?: string;
  address?: string;
  distance?: number;
}

export interface AvailabilitySlot {
  start?: string;
  startUtc?: string;
  end?: string;
  endUtc?: string;
}

export interface BookingDetails {
  appointmentId?: string;
  googleCalendarLink?: string;
  outlookCalendarLink?: string;
  appleCalendarLink?: string;
  calendarLink?: string;
}

export interface ScheduleRange {
  start?: string;
  startUtc?: string;
  end?: string;
  endUtc?: string;
}

export interface Appointment {
  startUtc?: string;
  start?: string;
  endUtc?: string;
  end?: string;
  patientName?: string;
  status?: string;
  reason?: string;
  symptoms?: string[] | any[];
}

export interface ScheduleDetails {
  appointments?: Appointment[];
  range?: ScheduleRange;
}

export interface StatsTotals {
  total?: number;
  confirmed?: number;
  completed?: number;
  cancelled?: number;
}

export interface StatsBucket {
  label?: string;
  total?: number;
  completed?: number;
  cancelled?: number;
}

export interface SymptomEntry {
  symptom: string;
  count: number;
}

export interface StatsDetails {
  range?: ScheduleRange;
  totals?: StatsTotals;
  buckets?: StatsBucket[];
  topSymptoms?: SymptomEntry[];
}

export interface Patient {
  name?: string;
  email?: string;
  symptoms?: Array<{ symptom?: string } | string>;
}

export interface RecentAppointment {
  startUtc?: string;
  status?: string;
}

export interface PatientMatch {
  patient?: Patient;
  recentAppointments?: RecentAppointment[];
}

export interface ToolResult {
  tool?: ToolAction | string;
  action?: ToolAction | string;
  result?: any;
  data?: any;
  summary?: string;
  error?: string;
}

export function formatDoctorList(doctors: Doctor[]): string {
  if (!Array.isArray(doctors) || doctors.length === 0) {
    return "No doctors matched the requested criteria.";
  }

  const header = `I found ${doctors.length} doctor${doctors.length === 1 ? "" : "s"}:`;
  const entries = doctors.slice(0, 5).map((doctor, index) => {
    const lines = [
      `${index + 1}. ${doctor?.name || "Doctor"}${doctor?.specialty ? ` - ${doctor.specialty}` : ""}`,
    ];

    if (doctor?.address) {
      lines.push(`   ${doctor.address}`);
    }
    if (typeof doctor?.distance === "number") {
      lines.push(`   ${doctor.distance.toFixed(1)} km away`);
    }
    return lines.join("\n");
  });

  return `${header}\n\n${entries.join("\n\n")}`;
}

export function formatAvailabilitySlots(slots: AvailabilitySlot[]): string {
  if (!Array.isArray(slots) || slots.length === 0) {
    return "No available slots found in the requested time range.";
  }

  const entries = slots.slice(0, 5).map((slot, index) => {
    const start = slot?.start || slot?.startUtc;
    const end = slot?.end || slot?.endUtc;
    const startDate = start ? new Date(start).toLocaleString() : "Unknown start";
    const endDate = end ? new Date(end).toLocaleTimeString() : "Unknown end";
    return `${index + 1}. ${startDate} - ${endDate}`;
  });

  return `Available time slots:\n\n${entries.join("\n")}\n\nWould you like to book one of these slots?`;
}

export function formatBookingDetails(booking: BookingDetails | null | undefined): string | undefined {
  if (!booking) {
    return undefined;
  }

  const parts: string[] = ["✅ Appointment booked successfully!"];
  if (booking.appointmentId) {
    parts.push(`Appointment ID: ${booking.appointmentId}`);
  }

  const calendarLinks: string[] = [];
  if (booking.googleCalendarLink) {
    calendarLinks.push(`• Google Calendar: ${booking.googleCalendarLink}`);
  }
  if (booking.outlookCalendarLink) {
    calendarLinks.push(`• Outlook: ${booking.outlookCalendarLink}`);
  }
  if (booking.appleCalendarLink) {
    calendarLinks.push(`• Apple Calendar: ${booking.appleCalendarLink}`);
  }
  if (booking.calendarLink) {
    calendarLinks.push(`• View Appointment: ${booking.calendarLink}`);
  }

  if (calendarLinks.length > 0) {
    parts.push("", "📅 Add to Calendar:", ...calendarLinks);
  }

  return parts.join("\n");
}

export function formatScheduleDetails(schedule: ScheduleDetails): string {
  const appointments = schedule?.appointments;
  if (!Array.isArray(appointments) || appointments.length === 0) {
    return "No appointments scheduled in that time range.";
  }

  const startRange = schedule?.range?.startUtc || schedule?.range?.start || appointments[0]?.startUtc;
  const endRange =
    schedule?.range?.endUtc || schedule?.range?.end || appointments[appointments.length - 1]?.endUtc;

  const header = `Doctor schedule from ${new Date(startRange || Date.now()).toLocaleString()} to ${new Date(
    endRange || Date.now()
  ).toLocaleString()}:`;

  const entries = appointments.slice(0, 5).map((appointment, index) => {
    const start = appointment?.startUtc || appointment?.start;
    const lines = [
      `${index + 1}. ${start ? new Date(start).toLocaleString() : "Unknown time"} - ${
        appointment?.patientName || "Patient"
      } (${appointment?.status || "status unknown"})`,
    ];
    if (appointment?.reason) {
      lines.push(`   Reason: ${appointment.reason}`);
    }
    if (Array.isArray(appointment?.symptoms) && appointment.symptoms.length > 0) {
      lines.push(`   Symptoms: ${appointment.symptoms.join(", ")}`);
    }
    return lines.join("\n");
  });

  return `${header}\n\n${entries.join("\n\n")}`;
}

export function formatStatsDetails(stats: StatsDetails | null | undefined): string | undefined {
  if (!stats) {
    return undefined;
  }

  const start = stats.range?.startUtc || stats.range?.start;
  const end = stats.range?.endUtc || stats.range?.end;
  const lines: string[] = [
    `📊 Appointment stats (${start ? new Date(start).toLocaleDateString() : "N/A"} - ${
      end ? new Date(end).toLocaleDateString() : "N/A"
    }):`,
  ];

  if (stats.totals) {
    lines.push(
      `Total: ${stats.totals.total ?? 0} | Confirmed: ${stats.totals.confirmed ?? 0} | Completed: ${
        stats.totals.completed ?? 0
      } | Cancelled: ${stats.totals.cancelled ?? 0}`
    );
  }
  if (Array.isArray(stats.buckets) && stats.buckets.length > 0) {
    lines.push("", "Buckets:");
    stats.buckets.slice(0, 5).forEach((bucket) => {
      lines.push(` - ${bucket.label}: ${bucket.total} (completed ${bucket.completed}, cancelled ${bucket.cancelled})`);
    });
  }

  if (Array.isArray(stats.topSymptoms) && stats.topSymptoms.length > 0) {
    lines.push(
      "",
      `Top symptoms: ${stats.topSymptoms.map((entry) => `${entry.symptom} (${entry.count})`).join(", ")}`
    );
  }

  return lines.join("\n");
}

export function formatPatientMatchDetails(matches: PatientMatch[]): string {
  if (!Array.isArray(matches) || matches.length === 0) {
    return "No patients matched that symptom in the requested range.";
  }

  const header = `Found ${matches.length} patient${matches.length === 1 ? "" : "s"}:`;
  const entries = matches.slice(0, 3).map((match, index) => {
    const patient = match?.patient || {};
    const lines = [
      `${index + 1}. ${patient.name || "Patient"}${patient.email ? ` (${patient.email})` : ""}`,
    ];

    if (Array.isArray(patient.symptoms) && patient.symptoms.length > 0) {
      lines.push(`   Symptoms: ${patient.symptoms.map((record) => (typeof record === "string" ? record : record.symptom || "")).join(", ")}`);
    }

    if (Array.isArray(match?.recentAppointments) && match.recentAppointments.length > 0) {
      const latest = match.recentAppointments[0];
      lines.push(
        `   Last visit: ${
          latest?.startUtc ? new Date(latest.startUtc).toLocaleString() : "Unknown date"
        } with status ${latest?.status || "unknown"}`
      );
    }

    return lines.join("\n");
  });

  return `${header}\n\n${entries.join("\n\n")}`;
}

export function describeToolResult(
  action?: ToolAction | string,
  data?: any,
  summary?: string,
  error?: string
): string | undefined {
  const parts: string[] = [];

  if (error) {
    parts.push(`⚠️ ${error}`);
  }

  if (summary) {
    parts.push(summary.trim());
  }

  if (!action || !data) {
    return parts.length > 0 ? parts.join("\n\n") : undefined;
  }

  switch (action) {
    case "search_doctors": {
      const text = formatDoctorList(data?.doctors);
      if (text) {
        parts.push(text);
      }
      break;
    }
    case "check_availability": {
      const text = formatAvailabilitySlots(data?.slots);
      if (text) {
        parts.push(text);
      }
      break;
    }
    case "book_appointment":
    case "schedule_appointment": {
      const text = formatBookingDetails(data);
      if (text) {
        parts.push(text);
      }
      break;
    }
    case "get_doctor_schedule": {
      const text = formatScheduleDetails(data);
      if (text) {
        parts.push(text);
      }
      break;
    }
    case "get_appointment_stats": {
      const text = formatStatsDetails(data);
      if (text) {
        parts.push(text);
      }
      break;
    }
    case "search_patients_by_symptom": {
      const text = formatPatientMatchDetails(data?.matches);
      if (text) {
        parts.push(text);
      }
      break;
    }
    default:
      break;
  }

  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

function tryParseJsonPayload(value?: string): any | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}") + 1;
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(value.slice(start, end));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function extractResponseText(rawText?: string): string {
  if (!rawText) {
    return "";
  }

  const cleaned = rawText.replace(/```json|```/gi, "").trim();
  if (!cleaned) {
    return "";
  }

  const parsed = tryParseJsonPayload(cleaned);
  if (parsed) {
    if (typeof parsed.response === "string") {
      return parsed.response;
    }
    if (typeof parsed.message === "string") {
      return parsed.message;
    }
  }

  return cleaned;
}

export function formatAgentResponseText(rawText?: string, toolResult?: ToolResult): string {
  const baseText = extractResponseText(rawText);
  const action = toolResult?.tool || toolResult?.action;
  const data = toolResult?.result ?? toolResult?.data;
  const summary = toolResult?.summary;
  const error = toolResult?.error;

  const details = describeToolResult(action, data, summary, error);
  if (details) {
    return baseText ? `${baseText}\n\n${details}` : details;
  }

  return baseText;
}

