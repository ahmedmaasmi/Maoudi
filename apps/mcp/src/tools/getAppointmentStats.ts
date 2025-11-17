import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createApiClient } from "../client.js";

export const getAppointmentStatsTool: Tool = {
  name: "get_appointment_stats",
  description: "Summarize a doctor's workload over time with optional grouping.",
  inputSchema: {
    type: "object",
    properties: {
      doctorId: {
        type: "string",
        description: "Doctor ID returned from search_doctors",
      },
      startUtc: {
        type: "string",
        format: "date-time",
        description: "Range start (ISO8601)",
      },
      endUtc: {
        type: "string",
        format: "date-time",
        description: "Range end (ISO8601)",
      },
      groupBy: {
        type: "string",
        enum: ["day", "week", "month"],
        description: "Bucket granularity",
        default: "day",
      },
    },
    required: ["doctorId", "startUtc", "endUtc"],
  },
};

export async function getAppointmentStats(args: {
  doctorId: string;
  startUtc: string;
  endUtc: string;
  groupBy?: "day" | "week" | "month";
}) {
  const client = createApiClient();
  const response = await client.get(`/doctors/${args.doctorId}/stats`, {
    params: {
      startUtc: args.startUtc,
      endUtc: args.endUtc,
      groupBy: args.groupBy,
    },
  });
  return response.data;
}


