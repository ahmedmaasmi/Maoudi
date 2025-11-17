import { parseMessage } from "./nlu";
import { prismaClient } from "../utils/prisma";
import { createCalendarEvent, checkAvailability } from "./calendar";
import { AppError } from "../utils/errors";
import axios from "axios";

const parseSymptoms = (value?: string | null): string[] | null => {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch (error) {
    console.warn("Failed to parse symptoms payload", error);
    return null;
  }
};

const formatSymptom = (value: string) =>
  value
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

interface ToolCall {
  name: string;
  arguments: any;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ConversationContext {
  messages: ChatMessage[];
  userInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  foundDoctors?: any[];
  selectedDoctorId?: string;
  availableSlots?: Array<{ start: Date; end: Date }>;
}

/**
 * AI Agent that uses MCP tools to intelligently book appointments
 */
export class AppointmentAIAgent {
  private context: ConversationContext;

  constructor() {
    this.context = {
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant for booking and managing doctor appointments. You can:
1. Search for doctors by specialty and location
2. Check availability for doctors
3. Schedule appointments (collecting patient context and symptoms)
4. Review doctor schedules for specific ranges
5. Generate appointment statistics
6. Find patients by symptom for clinical insights

Always be conversational and helpful. Ask for missing information (name, email, location, specialty, preferred time, symptoms) before booking.
When booking, confirm the appointment details with the user first.`,
        },
      ],
    };
  }

  /**
   * Process user message and return AI response, potentially using tools
   */
  async processMessage(
    userMessage: string,
    userLocation?: { lat: number; lng: number }
  ): Promise<{ response: string; action?: string; data?: any }> {
    // Add user message to context
    this.context.messages.push({
      role: "user",
      content: userMessage,
    });

    // Parse message to extract intent and entities
    const nluResult = await parseMessage(userMessage);

    // Use OpenRouter AI to generate intelligent response and decide on actions
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const aiResponse = await this.callAIWithTools(userMessage, nluResult, userLocation);
        return aiResponse;
      } catch (error) {
        console.warn("AI agent error, falling back to rule-based:", error);
      }
    }

    // Fallback to rule-based logic
    return this.ruleBasedResponse(nluResult, userMessage, userLocation);
  }

  /**
   * Call OpenRouter AI with tool descriptions
   */
  private async callAIWithTools(
    userMessage: string,
    nluResult: any,
    userLocation?: { lat: number; lng: number }
  ): Promise<{ response: string; action?: string; data?: any }> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    // Build context for AI
    const contextInfo = [];
    if (this.context.userInfo?.name) {
      contextInfo.push(`User name: ${this.context.userInfo.name}`);
    }
    if (this.context.userInfo?.email) {
      contextInfo.push(`User email: ${this.context.userInfo.email}`);
    }
    if (this.context.foundDoctors && this.context.foundDoctors.length > 0) {
      contextInfo.push(
        `Found ${this.context.foundDoctors.length} doctor(s). Doctor IDs: ${this.context.foundDoctors.map((d) => d.id).join(", ")}`
      );
    }
    if (this.context.selectedDoctorId) {
      contextInfo.push(`Selected doctor ID: ${this.context.selectedDoctorId}`);
    }
    if (this.context.availableSlots && this.context.availableSlots.length > 0) {
      contextInfo.push(`Available slots: ${this.context.availableSlots.length} slots found`);
    }

    const systemPrompt = `You are a helpful AI assistant for booking doctor appointments. You have access to these tools:

1. search_doctors(specialty: string, near: {lat: number, lng: number}, radiusKm?: number) - Search for doctors
2. check_availability(doctorId: string, startUtc: string, endUtc: string, slotMinutes?: number) - Check doctor availability
3. book_appointment(doctorId: string, startUtc: string, user: {name: string, email: string, phone?: string}) - Quick booking when only minimal info is available
4. schedule_appointment(doctorId: string, startUtc: string, user: {...}, reason?: string, symptoms?: string[]) - Preferred booking flow that captures patient context
5. get_doctor_schedule(doctorId: string, startUtc: string, endUtc: string) - Retrieve upcoming appointments
6. get_appointment_stats(doctorId: string, startUtc: string, endUtc: string, groupBy?: "day"|"week"|"month") - Summarize workload
7. search_patients_by_symptom(symptom: string, doctorId?: string, startUtc?: string, endUtc?: string) - Find patients that match a clinical query

Current context:
${contextInfo.length > 0 ? contextInfo.join("\n") : "No context yet"}

Parsed intent: ${nluResult.intent}
Specialty: ${nluResult.entities?.specialty || "not specified"}
Location: ${nluResult.entities?.location || "not specified"}
Date: ${nluResult.entities?.dateRange ? nluResult.entities.dateRange.start : "not specified"}

${userLocation ? `User location: ${userLocation.lat}, ${userLocation.lng}` : "User location: unknown"}

Respond naturally and helpfully. If you need to use a tool, respond with JSON in this format:
{
  "response": "Your conversational response to the user",
  "tool": {
    "name": "tool_name",
    "arguments": {...}
  }
}

If no tool is needed, just respond with:
{
  "response": "Your conversational response"
}`;

    const messages = [
      ...this.context.messages.slice(0, -1), // All messages except the last user message
      {
        role: "user" as const,
        content: systemPrompt + "\n\nUser: " + userMessage + "\n\nAssistant:",
      },
    ];

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const aiText = response.data.choices[0].message.content.trim();

    // Try to parse tool call from response
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const toolCall = parsed.tool;

        if (toolCall) {
          // Execute tool
          const toolResult = await this.executeTool(toolCall.name, toolCall.arguments, userLocation);
          return {
            response: parsed.response || aiText,
            action: toolCall.name,
            data: toolResult,
          };
        }

        return {
          response: parsed.response || aiText,
        };
      }
    } catch (error) {
      // If parsing fails, just return the text
    }

    return { response: aiText };
  }

  /**
   * Execute a tool call
   */
  private async executeTool(
    toolName: string,
    args: any,
    userLocation?: { lat: number; lng: number }
  ): Promise<any> {
    switch (toolName) {
      case "search_doctors": {
        if (!args.specialty) {
          throw new Error("Specialty is required");
        }
        
        let location = args.near || userLocation;
        
        // If location is provided as a string (location name), try to geocode it
        if (!location && args.location && typeof args.location === "string") {
          try {
            const { geocode } = await import("./geocode");
            const geocodeResult = await geocode(args.location);
            location = { lat: geocodeResult.lat, lng: geocodeResult.lng };
          } catch (error) {
            throw new Error(`Could not find location: ${args.location}`);
          }
        }
        
        if (!location) {
          throw new Error("Location is required. Please provide coordinates or a location name.");
        }

        const doctors = await prismaClient.doctor.findMany({
          where: {
            specialty: {
              contains: args.specialty,
              mode: "insensitive",
            },
          },
        });

        // Calculate distances and filter by radius
        const { getDistance } = await import("geolib");
        const doctorsWithDistance = doctors
          .map((doctor) => ({
            ...doctor,
            distance: getDistance(
              { latitude: location.lat, longitude: location.lng },
              { latitude: doctor.latitude, longitude: doctor.longitude }
            ) / 1000, // Convert to km
          }))
          .filter((d) => !args.radiusKm || d.distance <= args.radiusKm)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 10);

        this.context.foundDoctors = doctorsWithDistance;
        return { doctors: doctorsWithDistance };
      }

      case "check_availability": {
        if (!args.doctorId) {
          throw new Error("Doctor ID is required");
        }
        if (!args.startUtc || !args.endUtc) {
          throw new Error("Start and end times are required");
        }

        const slots = await checkAvailability(
          args.doctorId,
          new Date(args.startUtc),
          new Date(args.endUtc),
          args.slotMinutes || 30
        );

        this.context.selectedDoctorId = args.doctorId;
        this.context.availableSlots = slots;
        // Convert Date objects to ISO strings for JSON serialization
        return {
          slots: slots.map((slot) => ({
            start: slot.start.toISOString(),
            end: slot.end.toISOString(),
          })),
        };
      }

      case "book_appointment": {
        if (!args.doctorId || !args.startUtc || !args.user) {
          throw new Error("Doctor ID, start time, and user info are required");
        }

        return this.createAppointmentBooking({
          doctorId: args.doctorId,
          startUtc: args.startUtc,
          endUtc: args.endUtc,
          user: args.user,
          durationMinutes: args.durationMinutes,
        });
      }

      case "schedule_appointment": {
        if (!args.doctorId || !args.startUtc || !args.user) {
          throw new Error("Doctor ID, start time, and user info are required");
        }

        const normalizedSymptoms =
          typeof args.symptoms === "string"
            ? String(args.symptoms)
                .split(/[;,]/)
                .map((value) => value.trim())
                .filter(Boolean)
            : Array.isArray(args.symptoms)
            ? args.symptoms
            : undefined;

        return this.createAppointmentBooking({
          doctorId: args.doctorId,
          startUtc: args.startUtc,
          endUtc: args.endUtc,
          user: args.user,
          reason: args.reason,
          notes: args.notes,
          symptoms: normalizedSymptoms,
          durationMinutes: args.durationMinutes,
        });
      }

      case "get_doctor_schedule": {
        if (!args.doctorId || !args.startUtc || !args.endUtc) {
          throw new Error("doctorId, startUtc, and endUtc are required");
        }

        const doctor = await prismaClient.doctor.findUnique({
          where: { id: args.doctorId },
        });

        if (!doctor) {
          throw new Error("Doctor not found");
        }

        const start = new Date(args.startUtc);
        const end = new Date(args.endUtc);

        const appointments = await prismaClient.appointment.findMany({
          where: {
            doctorId: args.doctorId,
            startUtc: { gte: start },
            endUtc: { lte: end },
          },
          orderBy: { startUtc: "asc" },
        });

        return {
          doctorId: args.doctorId,
          range: {
            startUtc: start.toISOString(),
            endUtc: end.toISOString(),
          },
          appointments: appointments.map((appointment) => ({
            appointmentId: appointment.id,
            startUtc: appointment.startUtc.toISOString(),
            endUtc: appointment.endUtc.toISOString(),
            status: appointment.status,
            patientName: appointment.userName,
            patientEmail: appointment.userEmail,
            reason: appointment.reason,
            notes: appointment.notes,
            symptoms: parseSymptoms(appointment.symptoms),
          })),
        };
      }

      case "get_appointment_stats": {
        if (!args.doctorId || !args.startUtc || !args.endUtc) {
          throw new Error("doctorId, startUtc, and endUtc are required");
        }

        const doctor = await prismaClient.doctor.findUnique({
          where: { id: args.doctorId },
        });

        if (!doctor) {
          throw new Error("Doctor not found");
        }

        const start = new Date(args.startUtc);
        const end = new Date(args.endUtc);
        const groupBy = args.groupBy || "day";

        const appointments = await prismaClient.appointment.findMany({
          where: {
            doctorId: args.doctorId,
            startUtc: { gte: start },
            endUtc: { lte: end },
          },
        });

        const totals = {
          total: appointments.length,
          confirmed: appointments.filter((appt) => appt.status === "confirmed").length,
          cancelled: appointments.filter((appt) => appt.status === "cancelled").length,
          completed: appointments.filter((appt) => appt.status === "completed").length,
        };

        const bucketMap = new Map<
          string,
          { label: string; total: number; completed: number; cancelled: number }
        >();

        const formatBucketKey = (date: Date) => {
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, "0");
          const day = String(date.getUTCDate()).padStart(2, "0");

          if (groupBy === "day") {
            return `${year}-${month}-${day}`;
          }

          if (groupBy === "week") {
            const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
            const pastDaysOfYear = (Number(date) - Number(firstDayOfYear)) / 86400000;
            const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getUTCDay() + 1) / 7);
            return `${year}-W${String(weekNumber).padStart(2, "0")}`;
          }

          return `${year}-${month}`;
        };

        appointments.forEach((appointment) => {
          const key = formatBucketKey(appointment.startUtc);
          if (!bucketMap.has(key)) {
            bucketMap.set(key, { label: key, total: 0, completed: 0, cancelled: 0 });
          }

          const bucket = bucketMap.get(key)!;
          bucket.total += 1;
          if (appointment.status === "completed") {
            bucket.completed += 1;
          }
          if (appointment.status === "cancelled") {
            bucket.cancelled += 1;
          }
        });

        const symptomCounts = new Map<string, number>();
        appointments.forEach((appointment) => {
          const parsed = parseSymptoms(appointment.symptoms);
          parsed?.forEach((symptom) => {
            const normalized = symptom.trim().toLowerCase();
            if (!normalized) return;
            symptomCounts.set(normalized, (symptomCounts.get(normalized) || 0) + 1);
          });
        });

        const topSymptoms = Array.from(symptomCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([symptom, count]) => ({ symptom: formatSymptom(symptom), count }));

        return {
          doctorId: args.doctorId,
          range: {
            startUtc: start.toISOString(),
            endUtc: end.toISOString(),
          },
          totals,
          buckets: Array.from(bucketMap.values()).sort((a, b) => (a.label > b.label ? 1 : -1)),
          topSymptoms,
        };
      }

      case "search_patients_by_symptom": {
        if (!args.symptom) {
          throw new Error("Symptom is required");
        }

        const symptomQuery = String(args.symptom).trim().toLowerCase();
        const appointmentFilters: any = {};

        if (args.doctorId) {
          appointmentFilters.doctorId = args.doctorId;
        }
        if (args.startUtc) {
          appointmentFilters.startUtc = { gte: new Date(args.startUtc) };
        }
        if (args.endUtc) {
          appointmentFilters.endUtc = { lte: new Date(args.endUtc) };
        }

        const patients = await prismaClient.patient.findMany({
          where: {
            symptoms: {
              some: {
                symptom: {
                  contains: symptomQuery,
                  mode: "insensitive",
                },
              },
            },
            ...(Object.keys(appointmentFilters).length
              ? {
                  appointments: {
                    some: appointmentFilters,
                  },
                }
              : {}),
          },
          include: {
            symptoms: true,
            appointments: {
              where: appointmentFilters,
              orderBy: { startUtc: "desc" },
              take: 5,
            },
          },
        });

        return {
          matches: patients.map((patient) => ({
            patient: {
              id: patient.id,
              name: patient.name,
              email: patient.email,
              phone: patient.phone,
              createdAt: patient.createdAt.toISOString(),
              updatedAt: patient.updatedAt.toISOString(),
              symptoms: patient.symptoms.map((record) => ({
                symptom: formatSymptom(record.symptom),
                notedAt: record.notedAt.toISOString(),
              })),
            },
            recentAppointments: patient.appointments.map((appointment) => ({
              appointmentId: appointment.id,
              startUtc: appointment.startUtc.toISOString(),
              endUtc: appointment.endUtc.toISOString(),
              status: appointment.status,
              patientName: appointment.userName,
              patientEmail: appointment.userEmail,
              reason: appointment.reason,
              notes: appointment.notes,
              symptoms: parseSymptoms(appointment.symptoms),
            })),
          })),
        };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async createAppointmentBooking(args: {
    doctorId: string;
    startUtc: string;
    endUtc?: string;
    user: { name: string; email: string; phone?: string };
    reason?: string;
    notes?: string;
    symptoms?: string[];
    durationMinutes?: number;
  }) {
    const doctor = await prismaClient.doctor.findUnique({
      where: { id: args.doctorId },
    });

    if (!doctor) {
      throw new Error("Doctor not found");
    }

    const credential = await prismaClient.calendarCredential.findUnique({
      where: { doctorId: args.doctorId },
    });

    if (!credential) {
      throw new Error("Doctor has not connected their calendar");
    }

    const patient = await prismaClient.patient.upsert({
      where: { email: args.user.email },
      update: {
        name: args.user.name,
        phone: args.user.phone || null,
      },
      create: {
        name: args.user.name,
        email: args.user.email,
        phone: args.user.phone || null,
      },
    });

    const startDate = new Date(args.startUtc);
    const endDate = args.endUtc
      ? new Date(args.endUtc)
      : new Date(startDate.getTime() + (args.durationMinutes || 30) * 60 * 1000);

    const { eventId, calendarLink } = await createCalendarEvent(
      args.doctorId,
      startDate,
      endDate,
      args.user.name,
      args.user.email,
      args.user.phone
    );

    const appointment = await prismaClient.appointment.create({
      data: {
        doctorId: args.doctorId,
        patientId: patient.id,
        startUtc: startDate,
        endUtc: endDate,
        userName: args.user.name,
        userEmail: args.user.email,
        userPhone: args.user.phone || null,
        reason: args.reason || null,
        notes: args.notes || null,
        symptoms: args.symptoms?.length ? JSON.stringify(args.symptoms) : null,
        gcalEventId: eventId,
        status: "confirmed",
      },
    });

    if (args.symptoms?.length) {
      const normalized = args.symptoms
        .map((symptom) => symptom.trim().toLowerCase())
        .filter((value) => value.length > 0);

      await Promise.all(
        normalized.map((symptom) =>
          prismaClient.patientSymptom.upsert({
            where: {
              patientId_symptom: {
                patientId: patient.id,
                symptom,
              },
            },
            update: {
              notedAt: new Date(),
            },
            create: {
              patientId: patient.id,
              symptom,
            },
          })
        )
      );
    }

    this.context.selectedDoctorId = args.doctorId;

    return {
      appointmentId: appointment.id,
      patientId: patient.id,
      gcalEventId: eventId,
      calendarLink,
    };
  }

  /**
   * Rule-based fallback response
   */
  private ruleBasedResponse(
    nluResult: any,
    userMessage: string,
    userLocation?: { lat: number; lng: number }
  ): { response: string; action?: string; data?: any } {
    const lowerMessage = userMessage.toLowerCase();

    // Extract user info from message
    const emailMatch = userMessage.match(/\b[\w.-]+@[\w.-]+\.\w+\b/);
    const phoneMatch = userMessage.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
    const nameMatch = userMessage.match(/(?:my name is|i'm|i am|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);

    if (emailMatch && !this.context.userInfo?.email) {
      this.context.userInfo = {
        ...this.context.userInfo,
        email: emailMatch[0],
      };
    }
    if (phoneMatch && !this.context.userInfo?.phone) {
      this.context.userInfo = {
        ...this.context.userInfo,
        phone: phoneMatch[0],
      };
    }
    if (nameMatch && !this.context.userInfo?.name) {
      this.context.userInfo = {
        ...this.context.userInfo,
        name: nameMatch[1],
      };
    }

    if (nluResult.intent === "search_doctors") {
      if (!nluResult.entities?.specialty) {
        return {
          response: "What specialty are you looking for? For example, cardiologist, dentist, or dermatologist.",
        };
      }

      if (!userLocation && !nluResult.entities?.location) {
        return {
          response:
            "I need your location to search for doctors. Please enable location access or tell me your location.",
        };
      }

      // This will be handled by the AI agent or we can trigger search here
      return {
        response: `I'll search for ${nluResult.entities?.specialty} doctors near you. Let me find the best options...`,
        action: "search_doctors",
      };
    }

    if (nluResult.intent === "book_appointment") {
      if (!this.context.selectedDoctorId) {
        return {
          response: "Please select a doctor first. I can help you search for doctors if you'd like.",
        };
      }

      if (!this.context.userInfo?.name || !this.context.userInfo?.email) {
        return {
          response: "I need your name and email to book the appointment. What's your name and email address?",
        };
      }

      return {
        response: "I can help you book an appointment. Let me check the available time slots first.",
        action: "check_availability",
      };
    }

    return {
      response:
        "I can help you find and book appointments with doctors. Try saying something like 'I need a cardiologist near downtown tomorrow' or 'Book me an appointment with Dr. Smith'.",
    };
  }

  /**
   * Reset conversation context
   */
  resetContext() {
    this.context = {
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant for booking doctor appointments.`,
        },
      ],
    };
  }

  /**
   * Get current context
   */
  getContext(): ConversationContext {
    return this.context;
  }
}

// Note: This function is deprecated. Use new AppointmentAIAgent() directly for session-based management.
export function getAIAgent(): AppointmentAIAgent {
  return new AppointmentAIAgent();
}

