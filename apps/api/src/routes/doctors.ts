import { Router, Request, Response } from "express";
import { prismaClient } from "../utils/prisma";
import { DoctorSearchQuerySchema } from "@voice-appointment/shared";
import { doctorSearchCache } from "../utils/cache";
import { getDistance } from "geolib";
import { AppError } from "../utils/errors";

const router = Router();

router.get("/search", async (req: Request, res: Response) => {
  // Validate query parameters
  const validation = DoctorSearchQuerySchema.safeParse(req.query);
  if (!validation.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid query parameters", 400, validation.error.errors);
  }

  const { specialty, lat, lng, radiusKm } = validation.data;

  // Validate specialty is not empty after trimming
  if (!specialty || !specialty.trim()) {
    throw new AppError("VALIDATION_ERROR", "Specialty parameter cannot be empty", 400);
  }

  // Check cache
  const cacheKey = `doctors:${specialty}:${lat}:${lng}:${radiusKm}`;
  const cached = doctorSearchCache.get(cacheKey);
  if (cached) {
    return res.json({ doctors: cached });
  }

  // Get all doctors with matching specialty (SQLite doesn't support case-insensitive mode)
  const doctors = await prismaClient.doctor.findMany({
    where: {
      specialty: {
        contains: specialty,
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

export default router;

