import { Router, Request, Response } from "express";
import { AppointmentAIAgent } from "../services/aiAgent";
import { AppError } from "../utils/errors";

const router = Router();

// Session-based agent storage (in production, use Redis or similar)
const agentSessions = new Map<string, AppointmentAIAgent>();

function getOrCreateAgent(sessionId?: string): AppointmentAIAgent {
  const id = sessionId || "default";
  if (!agentSessions.has(id)) {
    agentSessions.set(id, new AppointmentAIAgent());
  }
  return agentSessions.get(id)!;
}

interface ChatRequest {
  message: string;
  sessionId?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const { message, sessionId, location } = req.body as ChatRequest;

    if (!message || typeof message !== "string") {
      throw new AppError("VALIDATION_ERROR", "Message is required", 400);
    }

    const agent = getOrCreateAgent(sessionId);
    const result = await agent.processMessage(message, location);

    res.json({
      response: result.response,
      action: result.action,
      data: result.data,
    });
  } catch (error) {
    console.error("Chat error:", error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("CHAT_ERROR", "Failed to process chat message", 500);
  }
});

export default router;

