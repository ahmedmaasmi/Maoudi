import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { DoctorSearchQuerySchema } from "@voice-appointment/shared";
import { doctorSearchCache } from "../utils/cache";
import { getDistance } from "geolib";
import { AppError } from "../utils/errors";

const router = Router();
const prisma = new PrismaClient();

router.get("/search", async (req: Request, res: Response) => {
  // Validate query parameters
  const validation = DoctorSearchQuerySchema.safeParse(req.query);
  if (!validation.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid query parameters", 400, validation.error.errors);
  }

  const { specialty, lat, lng, radiusKm } = validation.data;

  // Check cache
  const cacheKey = `doctors:${specialty}:${lat}:${lng}:${radiusKm}`;
  const cached = doctorSearchCache.get(cacheKey);
  if (cached) {
    return res.json({ doctors: cached });
  }

  // Get all doctors with matching specialty
  const doctors = await prisma.doctor.findMany({
    where: {
      specialty: {
        contains: specialty,
        mode: "insensitive",
      },
    },
  });

  // Filter by distance
  const nearbyDoctors = doctors
    .map((doctor) => ({
      ...doctor,
      distance: getDistance(
        { latitude: lat, longitude: lng },
        { latitude: doctor.latitude, longitude: doctor.longitude }
      ) / 1000, // Convert to km
    }))
    .filter((doctor) => doctor.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);

  // Cache the result
  doctorSearchCache.set(cacheKey, nearbyDoctors);

  res.json({ doctors: nearbyDoctors });
});

export default router;

