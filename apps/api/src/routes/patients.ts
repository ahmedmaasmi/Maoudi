import { Router, Request, Response } from "express";
import { prismaClient } from "../utils/prisma";
import { PatientSymptomSearchSchema } from "@voice-appointment/shared";
import { AppError } from "../utils/errors";

const router = Router();

const formatSymptom = (value: string) =>
  value
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const parseSymptoms = (value?: string | null): string[] | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

router.get("/search", async (req: Request, res: Response) => {
  const validation = PatientSymptomSearchSchema.safeParse(req.query);
  if (!validation.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid query parameters", 400, validation.error.errors);
  }

  const { symptom, doctorId, startUtc, endUtc } = validation.data;
  const appointmentFilters: any = {};

  if (doctorId) {
    appointmentFilters.doctorId = doctorId;
  }
  if (startUtc) {
    appointmentFilters.startUtc = { gte: new Date(startUtc) };
  }
  if (endUtc) {
    appointmentFilters.endUtc = { lte: new Date(endUtc) };
  }

  const patients = await prismaClient.patient.findMany({
    where: {
      symptoms: {
        some: {
          symptom: {
            contains: symptom.trim().toLowerCase(),
            mode: "insensitive",
          },
        },
      },
      ...(Object.keys(appointmentFilters).length
        ? {
            appointments: {
              some: appointmentFilters,
            },
          }
        : {}),
    },
    include: {
      symptoms: true,
      appointments: {
        where: appointmentFilters,
        orderBy: { startUtc: "desc" },
        take: 5,
      },
    },
  });

  const matches = patients.map((patient) => ({
    patient: {
      id: patient.id,
      name: patient.name,
      email: patient.email,
      phone: patient.phone,
      createdAt: patient.createdAt.toISOString(),
      updatedAt: patient.updatedAt.toISOString(),
      symptoms: patient.symptoms.map((record) => ({
        symptom: formatSymptom(record.symptom),
        notedAt: record.notedAt.toISOString(),
      })),
    },
    recentAppointments: patient.appointments.map((appointment) => ({
      appointmentId: appointment.id,
      startUtc: appointment.startUtc.toISOString(),
      endUtc: appointment.endUtc.toISOString(),
      status: appointment.status as "confirmed" | "cancelled" | "completed",
      patientName: appointment.userName,
      patientEmail: appointment.userEmail,
      reason: appointment.reason,
      notes: appointment.notes,
      symptoms: parseSymptoms(appointment.symptoms)?.map(formatSymptom) ?? null,
    })),
  }));

  res.json({ matches });
});

export default router;


