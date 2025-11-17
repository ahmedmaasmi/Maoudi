import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createApiClient } from "../client.js";

export const searchDoctorsTool: Tool = {
  name: "search_doctors",
  description: "Search for doctors by specialty and location. Returns a list of doctors sorted by distance.",
  inputSchema: {
    type: "object",
    properties: {
      specialty: {
        type: "string",
        description: "Medical specialty (e.g., 'cardiology', 'dentistry', 'dermatology')",
      },
      near: {
        type: "object",
        properties: {
          lat: { type: "number", description: "Latitude" },
          lng: { type: "number", description: "Longitude" },
        },
        required: ["lat", "lng"],
        description: "Location coordinates",
      },
      radiusKm: {
        type: "number",
        description: "Search radius in kilometers",
        default: 10,
      },
    },
    required: ["specialty", "near"],
  },
};

export async function searchDoctors(args: {
  specialty: string;
  near: { lat: number; lng: number };
  radiusKm?: number;
}) {
  const client = createApiClient({ requireApiKey: false });
  const response = await client.get("/doctors/search", {
    params: {
      specialty: args.specialty,
      lat: args.near.lat,
      lng: args.near.lng,
      radiusKm: args.radiusKm || 10,
    },
  });
  return response.data;
}

