import axios, { AxiosInstance } from "axios";
import dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables from root .env file
dotenv.config({ path: resolve(__dirname, "../../../.env") });
dotenv.config(); // Also load from apps/mcp/.env if it exists

export function createApiClient(): AxiosInstance {
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";
  const apiKey = process.env.API_KEY || process.env.BACKEND_API_KEY;

  if (!apiKey) {
    throw new Error("API_KEY or BACKEND_API_KEY environment variable is required");
  }

  return axios.create({
    baseURL: apiBaseUrl,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
  });
}

