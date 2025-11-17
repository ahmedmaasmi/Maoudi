import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createApiClient } from "../client.js";

export const searchPatientsBySymptomTool: Tool = {
  name: "search_patients_by_symptom",
  description: "Find patients who reported a symptom, optionally filtered by doctor and timeframe.",
  inputSchema: {
    type: "object",
    properties: {
      symptom: {
        type: "string",
        description: "Symptom keyword, e.g. 'fever' or 'headache'",
      },
      doctorId: {
        type: "string",
        description: "Restrict results to patients who met this doctor",
      },
      startUtc: {
        type: "string",
        format: "date-time",
        description: "Only include appointments after this date",
      },
      endUtc: {
        type: "string",
        format: "date-time",
        description: "Only include appointments before this date",
      },
    },
    required: ["symptom"],
  },
};

export async function searchPatientsBySymptom(args: {
  symptom: string;
  doctorId?: string;
  startUtc?: string;
  endUtc?: string;
}) {
  const client = createApiClient();
  const response = await client.get("/patients/search", {
    params: args,
  });
  return response.data;
}


