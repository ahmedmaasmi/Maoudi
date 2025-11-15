import { Router, Request, Response } from "express";
import { google } from "googleapis";
import { PrismaClient } from "@prisma/client";
import { encrypt } from "../utils/encryption";
import { AppError } from "../utils/errors";
import crypto from "crypto";

const router = Router();
const prisma = new PrismaClient();

// Store OAuth states temporarily (in production, use Redis)
const oauthStates = new Map<string, { doctorId: string; expiresAt: Date }>();

// Clean up expired states every 10 minutes
setInterval(() => {
  const now = new Date();
  for (const [state, data] of oauthStates.entries()) {
    if (data.expiresAt < now) {
      oauthStates.delete(state);
    }
  }
}, 10 * 60 * 1000);

router.get("/google/initiate", async (req: Request, res: Response) => {
  const doctorId = req.query.doctorId as string;

  if (!doctorId) {
    throw new AppError("MISSING_DOCTOR_ID", "doctorId is required", 400);
  }

  // Verify doctor exists
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
  });

  if (!doctor) {
    throw new AppError("DOCTOR_NOT_FOUND", "Doctor not found", 404);
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.OAUTH_REDIRECT_URI
  );

  // Generate state token for CSRF protection
  const state = crypto.randomBytes(32).toString("hex");
  oauthStates.set(state, {
    doctorId,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  });

  const scopes = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    state,
    prompt: "consent", // Force consent to get refresh token
  });

  res.json({ authUrl, state });
});

router.get("/google/callback", async (req: Request, res: Response) => {
  const { code, state, doctorId } = req.query;

  if (!code || !state || !doctorId) {
    throw new AppError("MISSING_PARAMS", "code, state, and doctorId are required", 400);
  }

  // Verify state
  const stateData = oauthStates.get(state as string);
  if (!stateData || stateData.expiresAt < new Date()) {
    throw new AppError("INVALID_STATE", "Invalid or expired state token", 400);
  }

  if (stateData.doctorId !== doctorId) {
    throw new AppError("STATE_MISMATCH", "State token does not match doctorId", 400);
  }

  // Clean up state
  oauthStates.delete(state as string);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.OAUTH_REDIRECT_URI
  );

  try {
    const { tokens } = await oauth2Client.getToken(code as string);

    if (!tokens.refresh_token) {
      throw new AppError("NO_REFRESH_TOKEN", "Failed to obtain refresh token", 400);
    }

    // Encrypt and store refresh token
    const encryptedToken = encrypt(tokens.refresh_token);

    await prisma.calendarCredential.upsert({
      where: { doctorId: doctorId as string },
      create: {
        doctorId: doctorId as string,
        encryptedToken,
        accessToken: tokens.access_token || null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      update: {
        encryptedToken,
        accessToken: tokens.access_token || null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });

    res.json({ success: true, doctorId });
  } catch (error) {
    console.error("OAuth callback error:", error);
    throw new AppError("OAUTH_ERROR", "Failed to complete OAuth flow", 500);
  }
});

router.get("/google/refresh", async (req: Request, res: Response) => {
  const doctorId = req.query.doctorId as string;

  if (!doctorId) {
    throw new AppError("MISSING_DOCTOR_ID", "doctorId is required", 400);
  }

  try {
    const { getCalendarClient } = await import("../services/calendar");
    await getCalendarClient(doctorId); // This will refresh the token if needed
    res.json({ success: true });
  } catch (error) {
    throw new AppError("REFRESH_ERROR", "Failed to refresh token", 500);
  }
});

export default router;

