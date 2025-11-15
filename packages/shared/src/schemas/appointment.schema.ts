import { z } from "zod";

export const BookingRequestSchema = z.object({
  doctorId: z.string().min(1),
  startUtc: z.string().datetime(),
  endUtc: z.string().datetime(),
  user: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
  }),
});

export const AvailabilityRequestSchema = z.object({
  doctorId: z.string().min(1),
  startRangeUtc: z.string().datetime(),
  endRangeUtc: z.string().datetime(),
  slotMinutes: z.number().int().min(15).max(120).default(30),
});

