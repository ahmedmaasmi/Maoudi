import axios, { AxiosInstance } from "axios";

export function createApiClient(): AxiosInstance {
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error("API_KEY environment variable is required");
  }

  return axios.create({
    baseURL: apiBaseUrl,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
  });
}

