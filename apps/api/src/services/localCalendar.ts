import { prismaClient } from "../utils/prisma";

/**
 * Local calendar service that uses only the database
 * No external calendar integration needed
 */

/**
 * Check availability for a doctor based on existing appointments in the database
 */
export async function checkAvailability(
  doctorId: string,
  startRangeUtc: Date,
  endRangeUtc: Date,
  slotMinutes: number
): Promise<Array<{ start: Date; end: Date }>> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: Checking availability for doctor ${doctorId}`);
  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: Range: ${startRangeUtc.toISOString()} to ${endRangeUtc.toISOString()}`);
  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: Slot duration: ${slotMinutes} minutes`);

  // Get all existing appointments for this doctor in the time range
  const existingAppointments = await prismaClient.appointment.findMany({
    where: {
      doctorId,
      status: {
        not: "cancelled", // Don't count cancelled appointments
      },
      // Check for overlapping appointments
      OR: [
        // Appointment starts within range
        {
          startUtc: {
            gte: startRangeUtc,
            lt: endRangeUtc,
          },
        },
        // Appointment ends within range
        {
          endUtc: {
            gt: startRangeUtc,
            lte: endRangeUtc,
          },
        },
        // Appointment completely contains range
        {
          startUtc: {
            lte: startRangeUtc,
          },
          endUtc: {
            gte: endRangeUtc,
          },
        },
      ],
    },
    orderBy: {
      startUtc: "asc",
    },
  });

  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: Found ${existingAppointments.length} existing appointments in range`);
  existingAppointments.forEach((apt, i) => {
    console.log(`[${timestamp}] 📅 LOCAL CALENDAR:   ${i + 1}. ${apt.startUtc.toISOString()} - ${apt.endUtc.toISOString()} (${apt.status})`);
  });

  // Generate available slots
  const slots: Array<{ start: Date; end: Date }> = [];
  let currentTime = new Date(startRangeUtc);

  // Default working hours: 9 AM to 5 PM (can be customized per doctor later)
  const WORK_START_HOUR = 9;
  const WORK_END_HOUR = 17;

  while (currentTime < endRangeUtc) {
    const slotEnd = new Date(currentTime.getTime() + slotMinutes * 60 * 1000);
    
    if (slotEnd > endRangeUtc) break;

    // Check if slot is within working hours
    const hour = currentTime.getUTCHours();
    if (hour < WORK_START_HOUR || hour >= WORK_END_HOUR) {
      // Skip outside working hours, move to next day start
      const nextDay = new Date(currentTime);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      nextDay.setUTCHours(WORK_START_HOUR, 0, 0, 0);
      currentTime = nextDay;
      continue;
    }

    // Check if this slot overlaps with any existing appointment
    const isBusy = existingAppointments.some((apt) => {
      const aptStart = new Date(apt.startUtc);
      const aptEnd = new Date(apt.endUtc);
      
      // Check for overlap
      return (
        (currentTime >= aptStart && currentTime < aptEnd) ||
        (slotEnd > aptStart && slotEnd <= aptEnd) ||
        (currentTime <= aptStart && slotEnd >= aptEnd)
      );
    });

    if (!isBusy) {
      slots.push({ start: new Date(currentTime), end: new Date(slotEnd) });
    }

    // Move to next slot
    currentTime = new Date(currentTime.getTime() + slotMinutes * 60 * 1000);
  }

  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: Generated ${slots.length} available slots`);
  return slots;
}

/**
 * Create a local calendar event (just store in database, no external calendar)
 */
export async function createCalendarEvent(
  doctorId: string,
  startUtc: Date,
  endUtc: Date,
  userName: string,
  userEmail: string,
  userPhone?: string
): Promise<{ eventId: string; calendarLink: string }> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: Creating local calendar event`);
  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: Doctor: ${doctorId}`);
  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: Time: ${startUtc.toISOString()} to ${endUtc.toISOString()}`);
  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: Patient: ${userName} (${userEmail})`);

  // Check if slot is already taken (double-booking prevention)
  const conflictingAppointment = await prismaClient.appointment.findFirst({
    where: {
      doctorId,
      status: {
        not: "cancelled",
      },
      OR: [
        {
          startUtc: {
            lt: endUtc,
            gte: startUtc,
          },
        },
        {
          endUtc: {
            gt: startUtc,
            lte: endUtc,
          },
        },
        {
          startUtc: {
            lte: startUtc,
          },
          endUtc: {
            gte: endUtc,
          },
        },
      ],
    },
  });

  if (conflictingAppointment) {
    console.log(`[${timestamp}] 📅 LOCAL CALENDAR: ✗ Conflict detected with appointment ${conflictingAppointment.id}`);
    throw new Error(
      `Time slot is already booked. Conflicting appointment: ${conflictingAppointment.startUtc.toISOString()} - ${conflictingAppointment.endUtc.toISOString()}`
    );
  }

  // Generate a local event ID (just use a timestamp-based ID)
  const eventId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const calendarLink = `/appointments/${eventId}`; // Local link

  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: ✓ Event created: ${eventId}`);

  return {
    eventId,
    calendarLink,
  };
}

