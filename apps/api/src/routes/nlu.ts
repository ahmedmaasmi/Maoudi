import { Router, Request, Response } from "express";
import { NLUParseRequestSchema } from "@voice-appointment/shared";
import { parseMessage } from "../services/nlu";
import { AppError } from "../utils/errors";

const router = Router();

router.post("/parse", async (req: Request, res: Response) => {
  // Validate request body
  const validation = NLUParseRequestSchema.safeParse(req.body);
  if (!validation.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid request body", 400, validation.error.errors);
  }

  const { message } = validation.data;

  try {
    const result = await parseMessage(message);
    res.json(result);
  } catch (error) {
    console.error("NLU parse error:", error);
    throw new AppError("NLU_ERROR", "Failed to parse message", 500);
  }
});

export default router;

