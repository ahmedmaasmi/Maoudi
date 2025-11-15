import { z } from "zod";

export const DoctorSchema = z.object({
  id: z.string(),
  name: z.string(),
  specialty: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const DoctorSearchQuerySchema = z.object({
  specialty: z.string().min(1),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radiusKm: z.coerce.number().min(0).max(100).default(10),
});

