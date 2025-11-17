/**
 * Validates required environment variables at startup
 * Throws an error if any required variables are missing
 */
export function validateEnv() {
  const required = [
    "DATABASE_URL",
    "BACKEND_API_KEY",
    "ENCRYPTION_KEY",
  ];

  const optional = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "OAUTH_REDIRECT_URI",
    "JWT_SECRET",
    "OLLAMA_BASE_URL",
    "OLLAMA_MODEL",
  ];

  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
      `Please check your .env file in apps/api/.`
    );
  }

  // Warn about optional but recommended variables
  const recommended = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "OAUTH_REDIRECT_URI"];
  const missingRecommended = recommended.filter((key) => !process.env[key]);
  
  if (missingRecommended.length > 0) {
    console.warn(
      `Warning: Missing recommended environment variables: ${missingRecommended.join(", ")}\n` +
      `Google Calendar integration will not work without these.`
    );
  }

  console.log("✓ Environment variables validated");
}

