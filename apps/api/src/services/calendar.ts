import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { PrismaClient } from "@prisma/client";
import { decrypt } from "../utils/encryption";

const prisma = new PrismaClient();

export async function getCalendarClient(doctorId: string): Promise<OAuth2Client> {
  const credential = await prisma.calendarCredential.findUnique({
    where: { doctorId },
  });

  if (!credential) {
    throw new Error(`No calendar credentials found for doctor ${doctorId}`);
  }

  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.OAUTH_REDIRECT_URI
  );

  // Decrypt and set refresh token
  const refreshToken = decrypt(credential.encryptedToken);
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  // Check if access token is expired and refresh if needed
  if (!credential.accessToken || !credential.tokenExpiry || credential.tokenExpiry < new Date()) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    await prisma.calendarCredential.update({
      where: { doctorId },
      data: {
        accessToken: credentials.access_token || null,
        tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      },
    });

    oauth2Client.setCredentials(credentials);
  } else {
    oauth2Client.setCredentials({
      access_token: credential.accessToken,
      refresh_token: refreshToken,
    });
  }

  return oauth2Client;
}

export async function checkAvailability(
  doctorId: string,
  startRangeUtc: Date,
  endRangeUtc: Date,
  slotMinutes: number
): Promise<Array<{ start: Date; end: Date }>> {
  const oauth2Client = await getCalendarClient(doctorId);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const credential = await prisma.calendarCredential.findUnique({
    where: { doctorId },
  });

  if (!credential) {
    throw new Error(`No calendar credentials found for doctor ${doctorId}`);
  }

  // Get freebusy information
  const freebusyResponse = await calendar.freebusy.query({
    requestBody: {
      timeMin: startRangeUtc.toISOString(),
      timeMax: endRangeUtc.toISOString(),
      items: [{ id: credential.calendarId }],
    },
  });

  const busyPeriods = freebusyResponse.data.calendars?.[credential.calendarId]?.busy || [];
  
  // Generate available slots
  const slots: Array<{ start: Date; end: Date }> = [];
  let currentTime = new Date(startRangeUtc);

  while (currentTime < endRangeUtc) {
    const slotEnd = new Date(currentTime.getTime() + slotMinutes * 60 * 1000);
    
    if (slotEnd > endRangeUtc) break;

    // Check if this slot overlaps with any busy period
    const isBusy = busyPeriods.some((busy) => {
      const busyStart = new Date(busy.start || "");
      const busyEnd = new Date(busy.end || "");
      return (
        (currentTime >= busyStart && currentTime < busyEnd) ||
        (slotEnd > busyStart && slotEnd <= busyEnd) ||
        (currentTime <= busyStart && slotEnd >= busyEnd)
      );
    });

    if (!isBusy) {
      slots.push({ start: new Date(currentTime), end: new Date(slotEnd) });
    }

    currentTime = new Date(currentTime.getTime() + slotMinutes * 60 * 1000);
  }

  return slots;
}

export async function createCalendarEvent(
  doctorId: string,
  startUtc: Date,
  endUtc: Date,
  userName: string,
  userEmail: string,
  userPhone?: string
): Promise<{ eventId: string; calendarLink: string }> {
  const oauth2Client = await getCalendarClient(doctorId);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const credential = await prisma.calendarCredential.findUnique({
    where: { doctorId },
  });

  if (!credential) {
    throw new Error(`No calendar credentials found for doctor ${doctorId}`);
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
  });

  const event = await calendar.events.insert({
    calendarId: credential.calendarId,
    requestBody: {
      summary: `Appointment with ${userName}`,
      description: `Appointment booked through voice appointment system.\n\nPatient: ${userName}\nEmail: ${userEmail}${userPhone ? `\nPhone: ${userPhone}` : ""}`,
      start: {
        dateTime: startUtc.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: endUtc.toISOString(),
        timeZone: "UTC",
      },
      attendees: [
        { email: userEmail, displayName: userName },
        ...(doctor?.email ? [{ email: doctor.email }] : []),
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 }, // 24 hours before
        ],
      },
    },
  });

  return {
    eventId: event.data.id || "",
    calendarLink: event.data.htmlLink || "",
  };
}

