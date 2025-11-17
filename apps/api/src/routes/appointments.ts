import { Router, Request, Response } from "express";
import { prismaClient } from "../utils/prisma";
import { BookingRequestSchema, ScheduleAppointmentRequestSchema } from "@voice-appointment/shared";
import { createCalendarEvent } from "../services/localCalendar";
import { AppError } from "../utils/errors";

const router = Router();

async function createAppointmentBooking(params: {
  doctorId: string;
  startUtc: string;
  endUtc?: string;
  user: { name: string; email: string; phone?: string };
  reason?: string;
  notes?: string;
  symptoms?: string[];
  durationMinutes?: number;
}) {
  const { doctorId, startUtc, endUtc, user, reason, notes, symptoms, durationMinutes } = params;
  const startDate = new Date(startUtc);
  const endDate =
    endUtc && endUtc.length > 0
      ? new Date(endUtc)
      : new Date(startDate.getTime() + (durationMinutes || 30) * 60 * 1000);

  const doctor = await prismaClient.doctor.findUnique({
    where: { id: doctorId },
  });

  if (!doctor) {
    throw new AppError("DOCTOR_NOT_FOUND", "Doctor not found", 404);
  }

  // No need to check for calendar credentials - we use local calendar

  const patient = await prismaClient.patient.upsert({
    where: { email: user.email },
    update: {
      name: user.name,
      phone: user.phone || null,
    },
    create: {
      name: user.name,
      email: user.email,
      phone: user.phone || null,
    },
  });

  const { eventId, calendarLink } = await createCalendarEvent(
    doctorId,
    startDate,
    endDate,
    user.name,
    user.email,
    user.phone
  );

  const appointment = await prismaClient.appointment.create({
    data: {
      doctorId,
      patientId: patient.id,
      startUtc: startDate,
      endUtc: endDate,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone || null,
      reason: reason || null,
      notes: notes || null,
      symptoms: symptoms?.length ? JSON.stringify(symptoms) : null,
      gcalEventId: eventId,
      status: "confirmed",
    },
  });

  if (symptoms?.length) {
    const trimmed = symptoms
      .map((symptom) => symptom.trim().toLowerCase())
      .filter((value) => value.length > 0);

    await Promise.all(
      trimmed.map((symptom) =>
        prismaClient.patientSymptom.upsert({
          where: {
            patientId_symptom: {
              patientId: patient.id,
              symptom,
            },
          },
          update: {
            notedAt: new Date(),
          },
          create: {
            patientId: patient.id,
            symptom,
          },
        })
      )
    );
  }

  return {
    appointment,
    calendarLink,
    gcalEventId: eventId,
  };
}

router.post("/book", async (req: Request, res: Response) => {
  const validation = BookingRequestSchema.safeParse(req.body);
  if (!validation.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid request body", 400, validation.error.errors);
  }

  const { doctorId, startUtc, endUtc, user } = validation.data;

  try {
    const { appointment, calendarLink, gcalEventId } = await createAppointmentBooking({
      doctorId,
      startUtc,
      endUtc,
      user,
    });

    res.json({
      appointmentId: appointment.id,
      gcalEventId,
      calendarLink,
    });
  } catch (error) {
    console.error("Booking error:", error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("BOOKING_ERROR", "Failed to book appointment", 500);
  }
});

router.post("/schedule", async (req: Request, res: Response) => {
  const validation = ScheduleAppointmentRequestSchema.safeParse(req.body);
  if (!validation.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid request body", 400, validation.error.errors);
  }

  const { doctorId, startUtc, endUtc, user, reason, notes, symptoms, durationMinutes } = validation.data;

  try {
    const result = await createAppointmentBooking({
      doctorId,
      startUtc,
      endUtc,
      user,
      reason,
      notes,
      symptoms,
      durationMinutes,
    });

    res.json({
      appointmentId: result.appointment.id,
      gcalEventId: result.gcalEventId,
      calendarLink: result.calendarLink,
      patientId: result.appointment.patientId,
    });
  } catch (error) {
    console.error("Schedule error:", error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("BOOKING_ERROR", "Failed to schedule appointment", 500);
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  const appointment = await prismaClient.appointment.findUnique({
    where: { id },
    include: { doctor: true },
  });

  if (!appointment) {
    throw new AppError("APPOINTMENT_NOT_FOUND", "Appointment not found", 404);
  }

  res.json({ appointment });
});

router.delete("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  const appointment = await prismaClient.appointment.findUnique({
    where: { id },
    include: { doctor: true },
  });

  if (!appointment) {
    throw new AppError("APPOINTMENT_NOT_FOUND", "Appointment not found", 404);
  }

  // Delete from Google Calendar if event ID exists
  if (appointment.gcalEventId) {
    try {
      const { getCalendarClient } = await import("../services/calendar");
      const oauth2Client = await getCalendarClient(appointment.doctorId);
      const { google } = await import("googleapis");
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      const credential = await prismaClient.calendarCredential.findUnique({
        where: { doctorId: appointment.doctorId },
      });

      if (credential) {
        await calendar.events.delete({
          calendarId: credential.calendarId,
          eventId: appointment.gcalEventId,
        });
      }
    } catch (error) {
      console.error("Failed to delete calendar event:", error);
      // Continue with database update even if calendar deletion fails
    }
  }

  // Update appointment status
  await prismaClient.appointment.update({
    where: { id },
    data: { status: "cancelled" },
  });

  res.json({ success: true });
});

export default router;

