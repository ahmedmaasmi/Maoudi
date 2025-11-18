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

