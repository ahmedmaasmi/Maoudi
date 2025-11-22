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

  // Default working hours: 8 AM to 6 PM (can be customized per doctor later)
  const WORK_START_HOUR = 8;
  const WORK_END_HOUR = 18;
  
  // Weekend handling: skip weekends (Saturday = 6, Sunday = 0)
  const isWeekend = (date: Date) => {
    const day = date.getUTCDay();
    return day === 0 || day === 6;
  };

  // Normalize start time to beginning of working hours if needed
  if (currentTime.getUTCHours() < WORK_START_HOUR) {
    currentTime.setUTCHours(WORK_START_HOUR, 0, 0, 0);
  } else if (currentTime.getUTCHours() >= WORK_END_HOUR) {
    // Move to next day
    currentTime.setUTCDate(currentTime.getUTCDate() + 1);
    currentTime.setUTCHours(WORK_START_HOUR, 0, 0, 0);
  }

  // Ensure we start on a weekday
  while (isWeekend(currentTime)) {
    const daysUntilMonday = (8 - currentTime.getUTCDay()) % 7 || 7;
    currentTime.setUTCDate(currentTime.getUTCDate() + daysUntilMonday);
    currentTime.setUTCHours(WORK_START_HOUR, 0, 0, 0);
  }

  const maxIterations = 10000; // Safety limit to prevent infinite loops
  let iterations = 0;

  while (currentTime < endRangeUtc && iterations < maxIterations) {
    iterations++;
    
    const slotEnd = new Date(currentTime.getTime() + slotMinutes * 60 * 1000);
    
    // If slot would extend beyond end range, stop
    if (slotEnd > endRangeUtc) {
      break;
    }

    // Skip weekends - move to next Monday
    if (isWeekend(currentTime)) {
      const daysUntilMonday = (8 - currentTime.getUTCDay()) % 7 || 7;
      currentTime.setUTCDate(currentTime.getUTCDate() + daysUntilMonday);
      currentTime.setUTCHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    }

    // Check if slot is within working hours
    const hour = currentTime.getUTCHours();
    const minute = currentTime.getUTCMinutes();
    const slotEndHour = slotEnd.getUTCHours();
    const slotEndMinute = slotEnd.getUTCMinutes();
    
    // If slot starts before working hours, move to start of working hours
    if (hour < WORK_START_HOUR || (hour === WORK_START_HOUR && minute < 0)) {
      currentTime.setUTCHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    }
    
    // If slot starts at or after end of working hours, move to next day
    if (hour >= WORK_END_HOUR) {
      currentTime.setUTCDate(currentTime.getUTCDate() + 1);
      currentTime.setUTCHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    }
    
    // If slot extends beyond working hours, move to next day
    if (slotEndHour > WORK_END_HOUR || (slotEndHour === WORK_END_HOUR && slotEndMinute > 0)) {
      currentTime.setUTCDate(currentTime.getUTCDate() + 1);
      currentTime.setUTCHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    }

    // Check if this slot overlaps with any existing appointment
    const isBusy = existingAppointments.some((apt) => {
      const aptStart = new Date(apt.startUtc);
      const aptEnd = new Date(apt.endUtc);
      
      // Check for overlap: slots overlap if they share any time
      return (
        (currentTime.getTime() >= aptStart.getTime() && currentTime.getTime() < aptEnd.getTime()) ||
        (slotEnd.getTime() > aptStart.getTime() && slotEnd.getTime() <= aptEnd.getTime()) ||
        (currentTime.getTime() <= aptStart.getTime() && slotEnd.getTime() >= aptEnd.getTime())
      );
    });

    // If slot is not busy, add it
    if (!isBusy) {
      slots.push({ 
        start: new Date(currentTime), 
        end: new Date(slotEnd) 
      });
    }

    // Move to next slot (increment by slot duration)
    currentTime = new Date(currentTime.getTime() + slotMinutes * 60 * 1000);
  }

  if (iterations >= maxIterations) {
    console.warn(`[${timestamp}] 📅 LOCAL CALENDAR: Reached max iterations, stopping slot generation`);
  }

  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: Generated ${slots.length} available slots`);
  
  // If no slots were generated but we're within the date range, log a warning
  if (slots.length === 0 && startRangeUtc < endRangeUtc) {
    console.warn(`[${timestamp}] 📅 LOCAL CALENDAR: ⚠️ No slots generated. This might indicate an issue with the date range or working hours.`);
    console.warn(`[${timestamp}] 📅 LOCAL CALENDAR: Start: ${startRangeUtc.toISOString()}, End: ${endRangeUtc.toISOString()}`);
    console.warn(`[${timestamp}] 📅 LOCAL CALENDAR: Working hours: ${WORK_START_HOUR}:00 - ${WORK_END_HOUR}:00 UTC`);
  }
  
  return slots;
}

/**
 * Format date for iCal (YYYYMMDDTHHMMSSZ)
 */
function formatDateForICal(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape text for iCal format
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Generate iCal file content
 */
function generateICalContent(
  title: string,
  description: string,
  startUtc: Date,
  endUtc: Date,
  location: string,
  organizerEmail: string,
  attendeeEmail: string
): string {
  const start = formatDateForICal(startUtc);
  const end = formatDateForICal(endUtc);
  const now = formatDateForICal(new Date());
  const uid = `appointment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@maoudi.app`;

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Maoudi//Appointment Booking//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART:${start}
DTEND:${end}
SUMMARY:${escapeICalText(title)}
DESCRIPTION:${escapeICalText(description)}
LOCATION:${escapeICalText(location)}
ORGANIZER;CN=Doctor:MAILTO:${organizerEmail}
ATTENDEE;CN=Patient;RSVP=TRUE:MAILTO:${attendeeEmail}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;
}

/**
 * Generate Google Calendar link
 */
function generateGoogleCalendarLink(
  title: string,
  startUtc: Date,
  endUtc: Date,
  location: string,
  description: string
): string {
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatDate(startUtc)}/${formatDate(endUtc)}`,
    details: description,
    location: location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate Outlook Calendar link
 */
function generateOutlookCalendarLink(
  title: string,
  startUtc: Date,
  endUtc: Date,
  location: string,
  description: string
): string {
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const params = new URLSearchParams({
    subject: title,
    startdt: startUtc.toISOString(),
    enddt: endUtc.toISOString(),
    location: location,
    body: description,
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generate Apple Calendar link (ics file download)
 */
function generateAppleCalendarLink(
  title: string,
  description: string,
  startUtc: Date,
  endUtc: Date,
  location: string,
  organizerEmail: string,
  attendeeEmail: string
): string {
  // For Apple Calendar, we'll use a data URI with the iCal content
  // In a real app, you'd serve this from an endpoint
  const icalContent = generateICalContent(
    title,
    description,
    startUtc,
    endUtc,
    location,
    organizerEmail,
    attendeeEmail
  );
  
  // Return a data URI (in production, use a proper endpoint)
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(icalContent)}`;
}

/**
 * Create a local calendar event with enhanced calendar links
 */
export async function createCalendarEvent(
  doctorId: string,
  startUtc: Date,
  endUtc: Date,
  userName: string,
  userEmail: string,
  userPhone?: string,
  reason?: string,
  symptoms?: string[]
): Promise<{ 
  eventId: string; 
  calendarLink: string;
  googleCalendarLink?: string;
  outlookCalendarLink?: string;
  appleCalendarLink?: string;
  icalContent?: string;
}> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: Creating local calendar event`);
  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: Doctor: ${doctorId}`);
  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: Time: ${startUtc.toISOString()} to ${endUtc.toISOString()}`);
  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: Patient: ${userName} (${userEmail})`);

  // Get doctor information
  const doctor = await prismaClient.doctor.findUnique({
    where: { id: doctorId },
    select: {
      name: true,
      specialty: true,
      address: true,
      email: true,
    },
  });

  if (!doctor) {
    throw new Error("Doctor not found");
  }

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

  // Generate a local event ID
  const eventId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const calendarLink = `/appointments/${eventId}`;

  // Create event details
  const eventTitle = `Appointment with ${doctor.name} - ${doctor.specialty}`;
  let eventDescription = `Medical appointment with ${doctor.name} (${doctor.specialty})\n\n`;
  eventDescription += `Patient: ${userName}\n`;
  eventDescription += `Email: ${userEmail}\n`;
  if (userPhone) {
    eventDescription += `Phone: ${userPhone}\n`;
  }
  if (reason) {
    eventDescription += `\nReason: ${reason}\n`;
  }
  if (symptoms && symptoms.length > 0) {
    eventDescription += `\nSymptoms: ${symptoms.join(", ")}\n`;
  }

  const location = doctor.address || "Medical Office";

  // Generate calendar links
  const googleLink = generateGoogleCalendarLink(
    eventTitle,
    startUtc,
    endUtc,
    location,
    eventDescription
  );

  const outlookLink = generateOutlookCalendarLink(
    eventTitle,
    startUtc,
    endUtc,
    location,
    eventDescription
  );

  const appleLink = generateAppleCalendarLink(
    eventTitle,
    eventDescription,
    startUtc,
    endUtc,
    location,
    doctor.email || "doctor@maoudi.app",
    userEmail
  );

  // Generate iCal content
  const icalContent = generateICalContent(
    eventTitle,
    eventDescription,
    startUtc,
    endUtc,
    location,
    doctor.email || "doctor@maoudi.app",
    userEmail
  );

  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: ✓ Event created: ${eventId}`);
  console.log(`[${timestamp}] 📅 LOCAL CALENDAR: ✓ Calendar links generated`);

  return {
    eventId,
    calendarLink,
    googleCalendarLink: googleLink,
    outlookCalendarLink: outlookLink,
    appleCalendarLink: appleLink,
    icalContent,
  };
}

