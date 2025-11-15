import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createApiClient } from "../client.js";

export const bookAppointmentTool: Tool = {
  name: "book_appointment",
  description: "Book an appointment with a doctor. Creates a Google Calendar event and persists the appointment.",
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
      user: {
        type: "object",
        properties: {
          name: { type: "string", description: "Patient name" },
          email: { type: "string", format: "email", description: "Patient email" },
          phone: { type: "string", description: "Patient phone number (optional)" },
        },
        required: ["name", "email"],
      },
    },
    required: ["doctorId", "startUtc", "user"],
  },
};

export async function bookAppointment(args: {
  doctorId: string;
  startUtc: string;
  user: { name: string; email: string; phone?: string };
}) {
  const client = createApiClient();
  
  // Calculate end time (default 30 minutes)
  const startDate = new Date(args.startUtc);
  const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
  
  const response = await client.post("/appointments/book", {
    doctorId: args.doctorId,
    startUtc: args.startUtc,
    endUtc: endDate.toISOString(),
    user: args.user,
  });
  return response.data;
}

