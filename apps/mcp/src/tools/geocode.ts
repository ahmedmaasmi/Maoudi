import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createApiClient } from "../client.js";

export const geocodeTool: Tool = {
  name: "geocode",
  description: "Convert an address or location name to coordinates (latitude and longitude).",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Address or location name (e.g., 'downtown New York', '123 Main St, San Francisco')",
      },
    },
    required: ["query"],
  },
};

export async function geocode(args: { query: string }) {
  const client = createApiClient();
  const response = await client.get("/geocode", {
    params: { q: args.query },
  });
  return response.data;
}

