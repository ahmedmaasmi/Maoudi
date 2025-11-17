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

export const ScheduleAppointmentRequestSchema = BookingRequestSchema.extend({
  endUtc: z.string().datetime().optional(),
  reason: z.string().min(3).max(160).optional(),
  symptoms: z
    .array(z.string().min(2).max(40))
    .min(1)
    .max(5)
    .optional(),
  notes: z.string().min(3).max(400).optional(),
  durationMinutes: z.number().int().min(15).max(120).optional(),
});

export const AvailabilityRequestSchema = z.object({
  doctorId: z.string().min(1),
  startRangeUtc: z.string().datetime(),
  endRangeUtc: z.string().datetime(),
  slotMinutes: z.number().int().min(15).max(120).default(30),
});

export const DoctorScheduleQuerySchema = z.object({
  startUtc: z.string().datetime(),
  endUtc: z.string().datetime(),
});

export const DoctorStatsQuerySchema = DoctorScheduleQuerySchema.extend({
  groupBy: z.enum(["day", "week", "month"]).default("day"),
});

export const PatientSymptomSearchSchema = z.object({
  symptom: z.string().min(2).max(50),
  doctorId: z.string().optional(),
  startUtc: z.string().datetime().optional(),
  endUtc: z.string().datetime().optional(),
});

