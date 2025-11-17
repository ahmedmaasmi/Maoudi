import { Router, Request, Response } from "express";
import { prismaClient } from "../utils/prisma";
import {
  DoctorSearchQuerySchema,
  DoctorScheduleQuerySchema,
  DoctorStatsQuerySchema,
} from "@voice-appointment/shared";
import { doctorSearchCache } from "../utils/cache";
import { getDistance } from "geolib";
import { AppError } from "../utils/errors";
import { apiKeyAuth } from "../middleware/auth";
import { normalizeSpecialty } from "../utils/specialty";

const router = Router();

const parseSymptoms = (value?: string | null): string[] | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const formatSymptom = (value: string) =>
  value
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

type RawAppointment = Awaited<ReturnType<typeof prismaClient.appointment.findMany>>[number];
type AppointmentWithDetails = RawAppointment & {
  reason: string | null;
  notes: string | null;
  symptoms: string | null;
};

router.get("/search", async (req: Request, res: Response) => {
  // Validate query parameters
  const validation = DoctorSearchQuerySchema.safeParse(req.query);
  if (!validation.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid query parameters", 400, validation.error.errors);
  }

  const { specialty, lat, lng, radiusKm } = validation.data;

  const trimmedSpecialty = specialty?.trim() ?? "";
  if (!trimmedSpecialty) {
    throw new AppError("VALIDATION_ERROR", "Specialty parameter cannot be empty", 400);
  }

  const normalizedSpecialty = normalizeSpecialty(trimmedSpecialty);

  // Check cache
  const cacheKey = `doctors:${normalizedSpecialty}:${lat}:${lng}:${radiusKm}`;
  const cached = doctorSearchCache.get(cacheKey);
  if (cached) {
    return res.json({ doctors: cached });
  }

  // Get all doctors with matching specialty (SQLite doesn't support case-insensitive mode)
  const doctors = await prismaClient.doctor.findMany({
    where: {
      specialty: {
        contains: normalizedSpecialty,
      },
    },
  });

  // Filter by distance
  const nearbyDoctors = doctors
    .map((doctor: { id: string; name: string; specialty: string; address: string; latitude: number; longitude: number; phone?: string | null; email?: string | null }) => ({
      ...doctor,
      distance: getDistance(
        { latitude: lat, longitude: lng },
        { latitude: doctor.latitude, longitude: doctor.longitude }
      ) / 1000, // Convert to km
    }))
    .filter((doctor: { distance: number }) => doctor.distance <= radiusKm)
    .sort((a: { distance: number }, b: { distance: number }) => a.distance - b.distance);

  // Cache the result
  doctorSearchCache.set(cacheKey, nearbyDoctors);

  res.json({ doctors: nearbyDoctors });
});

router.get("/:doctorId/schedule", apiKeyAuth, async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const validation = DoctorScheduleQuerySchema.safeParse(req.query);
  if (!validation.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid query parameters", 400, validation.error.errors);
  }

  const doctor = await prismaClient.doctor.findUnique({
    where: { id: doctorId },
  });

  if (!doctor) {
    throw new AppError("DOCTOR_NOT_FOUND", "Doctor not found", 404);
  }

  const { startUtc, endUtc } = validation.data;
  const start = new Date(startUtc);
  const end = new Date(endUtc);

  if (start > end) {
    throw new AppError("VALIDATION_ERROR", "startUtc must be before endUtc", 400);
  }

  const appointments = (await prismaClient.appointment.findMany({
    where: {
      doctorId,
      startUtc: { gte: start },
      endUtc: { lte: end },
    },
    orderBy: { startUtc: "asc" },
  })) as AppointmentWithDetails[];

  const mapped = appointments.map((appointment) => ({
    appointmentId: appointment.id,
    startUtc: appointment.startUtc.toISOString(),
    endUtc: appointment.endUtc.toISOString(),
    status: appointment.status as "confirmed" | "cancelled" | "completed",
    patientName: appointment.userName,
    patientEmail: appointment.userEmail,
    reason: appointment.reason,
    notes: appointment.notes,
    symptoms: parseSymptoms(appointment.symptoms),
  }));

  res.json({
    doctorId,
    range: {
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
    },
    appointments: mapped,
  });
});

router.get("/:doctorId/stats", apiKeyAuth, async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const validation = DoctorStatsQuerySchema.safeParse(req.query);
  if (!validation.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid query parameters", 400, validation.error.errors);
  }

  const doctor = await prismaClient.doctor.findUnique({
    where: { id: doctorId },
  });

  if (!doctor) {
    throw new AppError("DOCTOR_NOT_FOUND", "Doctor not found", 404);
  }

  const { startUtc, endUtc, groupBy } = validation.data;
  const start = new Date(startUtc);
  const end = new Date(endUtc);

  if (start > end) {
    throw new AppError("VALIDATION_ERROR", "startUtc must be before endUtc", 400);
  }

  const appointments = (await prismaClient.appointment.findMany({
    where: {
      doctorId,
      startUtc: { gte: start },
      endUtc: { lte: end },
    },
    orderBy: { startUtc: "asc" },
  })) as AppointmentWithDetails[];

  const totals = {
    total: appointments.length,
    confirmed: appointments.filter((appt) => appt.status === "confirmed").length,
    cancelled: appointments.filter((appt) => appt.status === "cancelled").length,
    completed: appointments.filter((appt) => appt.status === "completed").length,
  };

  const bucketMap = new Map<
    string,
    {
      label: string;
      total: number;
      completed: number;
      cancelled: number;
    }
  >();

  const formatBucketKey = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    if (groupBy === "day") {
      return `${year}-${month}-${day}`;
    }

    if (groupBy === "week") {
      const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
      const pastDaysOfYear = (Number(date) - Number(firstDayOfYear)) / 86400000;
      const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getUTCDay() + 1) / 7);
      return `${year}-W${String(weekNumber).padStart(2, "0")}`;
    }

    return `${year}-${month}`;
  };

  appointments.forEach((appointment) => {
    const key = formatBucketKey(appointment.startUtc);
    if (!bucketMap.has(key)) {
      bucketMap.set(key, {
        label: key,
        total: 0,
        completed: 0,
        cancelled: 0,
      });
    }

    const bucket = bucketMap.get(key)!;
    bucket.total += 1;
    if (appointment.status === "completed") {
      bucket.completed += 1;
    }
    if (appointment.status === "cancelled") {
      bucket.cancelled += 1;
    }
  });

  const symptomCounts = new Map<string, number>();
  appointments.forEach((appointment) => {
    const parsed = parseSymptoms(appointment.symptoms);
    parsed?.forEach((symptom) => {
      const normalized = symptom.trim().toLowerCase();
      if (!normalized) {
        return;
      }
      symptomCounts.set(normalized, (symptomCounts.get(normalized) || 0) + 1);
    });
  });

  const topSymptoms = Array.from(symptomCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([symptom, count]) => ({ symptom: formatSymptom(symptom), count }));

  res.json({
    doctorId,
    range: {
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
    },
    totals,
    buckets: Array.from(bucketMap.values()).sort((a, b) => (a.label > b.label ? 1 : -1)),
    topSymptoms,
  });
});

export default router;

