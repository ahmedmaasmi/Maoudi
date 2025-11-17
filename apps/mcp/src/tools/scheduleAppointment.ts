import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createApiClient } from "../client.js";

export const scheduleAppointmentTool: Tool = {
  name: "schedule_appointment",
  description:
    "Book an appointment while capturing patient context, reason, and symptoms. Returns appointment confirmation details.",
  inputSchema: {
    type: "object",
    properties: {
      doctorId: {
        type: "string",
        description: "Doctor ID from search_doctors result",
      },
      startUtc: {
        type: "string",
        format: "date-time",
        description: "Appointment start time (ISO8601)",
      },
      endUtc: {
        type: "string",
        format: "date-time",
        description: "Optional appointment end time (ISO8601)",
      },
      durationMinutes: {
        type: "number",
        description: "Duration in minutes if endUtc is not provided",
        default: 30,
      },
      reason: {
        type: "string",
        description: "Short description of why the patient needs the visit",
      },
      notes: {
        type: "string",
        description: "Additional context for the doctor",
      },
      symptoms: {
        type: "array",
        items: { type: "string" },
        description: "List of patient-reported symptoms",
      },
      user: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
        },
        required: ["name", "email"],
      },
    },
    required: ["doctorId", "startUtc", "user"],
  },
};

export async function scheduleAppointment(args: {
  doctorId: string;
  startUtc: string;
  endUtc?: string;
  durationMinutes?: number;
  reason?: string;
  notes?: string;
  symptoms?: string[];
  user: { name: string; email: string; phone?: string };
}) {
  const client = createApiClient();
  const payload = {
    doctorId: args.doctorId,
    startUtc: args.startUtc,
    endUtc: args.endUtc,
    durationMinutes: args.durationMinutes,
    reason: args.reason,
    notes: args.notes,
    symptoms: args.symptoms,
    user: args.user,
  };
  const response = await client.post("/appointments/schedule", payload);
  return response.data;
}


