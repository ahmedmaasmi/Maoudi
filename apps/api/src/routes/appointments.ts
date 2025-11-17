import { Router, Request, Response } from "express";
import { prismaClient } from "../utils/prisma";
import { BookingRequestSchema } from "@voice-appointment/shared";
import { createCalendarEvent } from "../services/calendar";
import { AppError } from "../utils/errors";

const router = Router();

router.post("/book", async (req: Request, res: Response) => {
  // Validate request body
  const validation = BookingRequestSchema.safeParse(req.body);
  if (!validation.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid request body", 400, validation.error.errors);
  }

  const { doctorId, startUtc, endUtc, user } = validation.data;

  // Verify doctor exists
  const doctor = await prismaClient.doctor.findUnique({
    where: { id: doctorId },
  });

  if (!doctor) {
    throw new AppError("DOCTOR_NOT_FOUND", "Doctor not found", 404);
  }

  // Check if doctor has calendar credentials
  const credential = await prismaClient.calendarCredential.findUnique({
    where: { doctorId },
  });

  if (!credential) {
    throw new AppError("NO_CREDENTIALS", "Doctor has not connected their calendar", 400);
  }

  try {
    // Create calendar event
    const { eventId, calendarLink } = await createCalendarEvent(
      doctorId,
      new Date(startUtc),
      new Date(endUtc),
      user.name,
      user.email,
      user.phone
    );

    // Create appointment in database
    const appointment = await prismaClient.appointment.create({
      data: {
        doctorId,
        startUtc: new Date(startUtc),
        endUtc: new Date(endUtc),
        userName: user.name,
        userEmail: user.email,
        userPhone: user.phone || null,
        gcalEventId: eventId,
        status: "confirmed",
      },
    });

    res.json({
      appointmentId: appointment.id,
      gcalEventId: eventId,
      calendarLink,
    });
  } catch (error) {
    console.error("Booking error:", error);
    throw new AppError("BOOKING_ERROR", "Failed to book appointment", 500);
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

