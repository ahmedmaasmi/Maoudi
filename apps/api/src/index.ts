import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { errorHandler } from "./middleware/errorHandler";
import { globalRateLimit, geocodeRateLimit, availabilityRateLimit, bookingRateLimit } from "./middleware/rateLimit";

// Routes
import authRoutes from "./routes/auth";
import doctorsRoutes from "./routes/doctors";
import availabilityRoutes from "./routes/availability";
import appointmentsRoutes from "./routes/appointments";
import geocodeRoutes from "./routes/geocode";
import nluRoutes from "./routes/nlu";
import healthRoutes from "./routes/health";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const prisma = new PrismaClient();

// Enable WAL mode for SQLite concurrency
prisma.$executeRaw`PRAGMA journal_mode=WAL;`.catch(console.error);

// Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",");
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.some((allowed) => origin.match(new RegExp(allowed.replace("*", ".*"))))) {
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
app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/doctors", doctorsRoutes);
app.use("/availability", availabilityRateLimit, availabilityRoutes);
app.use("/appointments", bookingRateLimit, appointmentsRoutes);
app.use("/geocode", geocodeRateLimit, geocodeRoutes);
app.use("/nlu", nluRoutes);

// Error handling (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

