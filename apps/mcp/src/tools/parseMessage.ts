import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createApiClient } from "../client.js";

export const parseMessageTool: Tool = {
  name: "parse_message",
  description: "Extract intent and entities (specialty, location, date) from a user's natural language message.",
  inputSchema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "User's message (e.g., 'I need a cardiologist near downtown tomorrow')",
      },
    },
    required: ["message"],
  },
};

export async function parseMessage(args: { message: string }) {
  const client = createApiClient();
  const response = await client.post("/nlu/parse", {
    message: args.message,
  });
  return response.data;
}

