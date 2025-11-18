import { Router, Request, Response } from "express";
import { AppointmentAIAgent } from "../services/aiAgent";
import { AppError } from "../utils/errors";
import { prismaClient } from "../utils/prisma";

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
  chatId?: string;
  sessionId?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

// Create a new chat
router.post("/new", async (req: Request, res: Response) => {
  try {
    const { title, userId } = req.body;
    
    const chat = await prismaClient.chat.create({
      data: {
        title: title || "New Chat",
        userId: userId || null,
      },
    });

    res.json({ chatId: chat.id, title: chat.title });
  } catch (error) {
    console.error("Create chat error:", error);
    throw new AppError("CHAT_ERROR", "Failed to create chat", 500);
  }
});

// List all chats for a user
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    
    const chats = await prismaClient.chat.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1, // Just to check if chat has messages
        },
      },
    });

    res.json(chats.map(chat => ({
      id: chat.id,
      title: chat.title,
      userId: chat.userId,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messageCount: chat.messages.length,
    })));
  } catch (error) {
    console.error("List chats error:", error);
    throw new AppError("CHAT_ERROR", "Failed to list chats", 500);
  }
});

// Get chat history
router.get("/:chatId", async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    
    const chat = await prismaClient.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!chat) {
      throw new AppError("NOT_FOUND", "Chat not found", 404);
    }

    res.json({
      id: chat.id,
      title: chat.title,
      userId: chat.userId,
      messages: chat.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
        createdAt: msg.createdAt,
      })),
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    });
  } catch (error) {
    console.error("Get chat error:", error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("CHAT_ERROR", "Failed to get chat", 500);
  }
});

// Send a message in a chat
router.post("/", async (req: Request, res: Response) => {
  try {
    const { message, chatId, sessionId, location } = req.body as ChatRequest;

    if (!message || typeof message !== "string") {
      throw new AppError("VALIDATION_ERROR", "Message is required", 400);
    }

    // Get or create chat
    let chat;
    if (chatId) {
      chat = await prismaClient.chat.findUnique({ where: { id: chatId } });
      if (!chat) {
        throw new AppError("NOT_FOUND", "Chat not found", 404);
      }
    } else {
      // Create new chat if no chatId provided
      chat = await prismaClient.chat.create({
        data: {
          title: "New Chat",
          userId: sessionId || null,
        },
      });
    }

    // Save user message
    await prismaClient.chatMessage.create({
      data: {
        chatId: chat.id,
        role: "user",
        content: message,
      },
    });

    // Get or create agent for this chat
    const agent = getOrCreateAgent(chatId || sessionId || chat.id);
    const result = await agent.processMessage(message, location);

    // Save assistant response
    await prismaClient.chatMessage.create({
      data: {
        chatId: chat.id,
        role: "assistant",
        content: result.response,
        metadata: JSON.stringify({
          action: result.action,
          data: result.data,
        }),
      },
    });

    // Update chat title if a doctor was selected or booked
    let newTitle = chat.title;
    const context = agent.getContext();
    
    if (context.selectedDoctorId) {
      // Get doctor name from context or database
      let doctorName: string | null = null;
      
      // Try to get from foundDoctors in context first
      if (context.foundDoctors && context.foundDoctors.length > 0) {
        const selectedDoctor = context.foundDoctors.find(d => d.id === context.selectedDoctorId);
        if (selectedDoctor) {
          doctorName = selectedDoctor.name;
        }
      }
      
      // If not found in context, fetch from database
      if (!doctorName) {
        const doctor = await prismaClient.doctor.findUnique({
          where: { id: context.selectedDoctorId },
          select: { name: true },
        });
        if (doctor) {
          doctorName = doctor.name;
        }
      }
      
      // Update title if we found a doctor and title doesn't already include it
      if (doctorName && !chat.title.includes(doctorName)) {
        // Remove "Dr." prefix if present for cleaner title
        const cleanName = doctorName.replace(/^Dr\.?\s*/i, "");
        newTitle = `Appointment with ${cleanName}`;
      }
    }

    // Update chat updatedAt and title
    await prismaClient.chat.update({
      where: { id: chat.id },
      data: { 
        updatedAt: new Date(),
        title: newTitle,
      },
    });

    res.json({
      chatId: chat.id,
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

