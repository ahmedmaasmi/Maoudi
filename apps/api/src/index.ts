import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { prismaClient } from "./utils/prisma";
import { errorHandler } from "./middleware/errorHandler";
import { apiKeyAuth } from "./middleware/auth";
import { globalRateLimit, geocodeRateLimit, availabilityRateLimit, bookingRateLimit } from "./middleware/rateLimit";
import { validateEnv } from "./utils/env";

// Routes
import authRoutes from "./routes/auth";
import doctorsRoutes from "./routes/doctors";
import availabilityRoutes from "./routes/availability";
import appointmentsRoutes from "./routes/appointments";
import geocodeRoutes from "./routes/geocode";
import nluRoutes from "./routes/nlu";
import chatRoutes from "./routes/chat";
import healthRoutes from "./routes/health";
import patientsRoutes from "./routes/patients";

// Load environment variables from root .env file
import { resolve } from "path";
dotenv.config({ path: resolve(__dirname, "../../../.env") });
dotenv.config(); // Also load from apps/api/.env if it exists

// Validate environment variables at startup
try {
  validateEnv();
} catch (error) {
  console.error("Environment validation failed:", error);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",");
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        // Allow requests with no origin (like mobile apps or curl requests)
        callback(null, true);
        return;
      }
      
      // Check if origin matches any allowed origin pattern
      const isAllowed = allowedOrigins.some((allowed) => {
        // Escape special regex characters except * and .
        const escaped = allowed.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
        // Replace * with .* for wildcard matching
        const pattern = escaped.replace(/\*/g, ".*");
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Global rate limiting
app.use(globalRateLimit);

// Routes
// Public routes (no API key required)
app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/doctors", doctorsRoutes);
app.use("/chat", globalRateLimit, chatRoutes); // Public chat endpoint for end users

// Protected routes (require API key authentication)
app.use("/availability", apiKeyAuth, availabilityRateLimit, availabilityRoutes);
app.use("/appointments", apiKeyAuth, bookingRateLimit, appointmentsRoutes);
app.use("/geocode", apiKeyAuth, geocodeRateLimit, geocodeRoutes);
app.use("/nlu", apiKeyAuth, nluRoutes);
app.use("/patients", apiKeyAuth, patientsRoutes);

// Error handling (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await prismaClient.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await prismaClient.$disconnect();
  process.exit(0);
});

