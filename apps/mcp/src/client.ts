import axios, { AxiosInstance } from "axios";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../../../.env") });
dotenv.config();

type ApiClientOptions = {
  /**
   * When true, an explicit API key must be present. Routes that are public
   * (e.g., /doctors/search) can pass requireApiKey: false to allow usage
   * without credentials.
   */
  requireApiKey?: boolean;
};

export function createApiClient(options: ApiClientOptions = {}): AxiosInstance {
  const { requireApiKey = true } = options;
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";
  const apiKey = process.env.API_KEY || process.env.BACKEND_API_KEY;

  if (requireApiKey && !apiKey) {
    throw new Error("API_KEY or BACKEND_API_KEY environment variable is required");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  return axios.create({
    baseURL: apiBaseUrl,
    headers,
  });
}

