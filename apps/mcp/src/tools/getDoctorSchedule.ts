import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createApiClient } from "../client.js";

export const getDoctorScheduleTool: Tool = {
  name: "get_doctor_schedule",
  description: "Retrieve a doctor's confirmed appointments within a date range.",
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
    },
    required: ["doctorId", "startUtc", "endUtc"],
  },
};

export async function getDoctorSchedule(args: {
  doctorId: string;
  startUtc: string;
  endUtc: string;
}) {
  const client = createApiClient();
  const response = await client.get(`/doctors/${args.doctorId}/schedule`, {
    params: {
      startUtc: args.startUtc,
      endUtc: args.endUtc,
    },
  });
  return response.data;
}


