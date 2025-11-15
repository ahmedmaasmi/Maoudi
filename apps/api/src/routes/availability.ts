import { Router, Request, Response } from "express";
import { AvailabilityRequestSchema } from "@voice-appointment/shared";
import { checkAvailability } from "../services/calendar";
import { availabilityCache } from "../utils/cache";
import { AppError } from "../utils/errors";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  // Validate request body
  const validation = AvailabilityRequestSchema.safeParse(req.body);
  if (!validation.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid request body", 400, validation.error.errors);
  }

  const { doctorId, startRangeUtc, endRangeUtc, slotMinutes } = validation.data;

  // Check cache
  const cacheKey = `availability:${doctorId}:${startRangeUtc}:${endRangeUtc}:${slotMinutes}`;
  const cached = availabilityCache.get(cacheKey);
  if (cached) {
    return res.json({ slots: cached });
  }

  try {
    const slots = await checkAvailability(
      doctorId,
      new Date(startRangeUtc),
      new Date(endRangeUtc),
      slotMinutes
    );

    // Format slots for response
    const formattedSlots = slots.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
    }));

    // Cache the result
    availabilityCache.set(cacheKey, formattedSlots);

    res.json({ slots: formattedSlots });
  } catch (error) {
    if (error instanceof Error && error.message.includes("No calendar credentials")) {
      throw new AppError("NO_CREDENTIALS", "Doctor has not connected their calendar", 400);
    }
    throw error;
  }
});

export default router;

