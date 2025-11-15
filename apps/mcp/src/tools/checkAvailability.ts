import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createApiClient } from "../client.js";

export const checkAvailabilityTool: Tool = {
  name: "check_availability",
  description: "Check available time slots for a doctor within a date range.",
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
        description: "Start of availability range (ISO8601)",
      },
      endUtc: {
        type: "string",
        format: "date-time",
        description: "End of availability range (ISO8601)",
      },
      slotMinutes: {
        type: "number",
        description: "Duration of each slot in minutes",
        default: 30,
      },
    },
    required: ["doctorId", "startUtc", "endUtc"],
  },
};

export async function checkAvailability(args: {
  doctorId: string;
  startUtc: string;
  endUtc: string;
  slotMinutes?: number;
}) {
  const client = createApiClient();
  const response = await client.post("/availability", {
    doctorId: args.doctorId,
    startRangeUtc: args.startUtc,
    endRangeUtc: args.endUtc,
    slotMinutes: args.slotMinutes || 30,
  });
  return response.data;
}

