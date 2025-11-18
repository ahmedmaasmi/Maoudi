import { parseMessage } from "./nlu";
import { prismaClient } from "../utils/prisma";
import { createCalendarEvent, checkAvailability } from "./localCalendar";
import { AppError } from "../utils/errors";
import { normalizeSpecialty } from "../utils/specialty";
import axios from "axios";

// Only log verbose details in development
const DEBUG = process.env.NODE_ENV === "development";
const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.log(...args);
  }
};

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
  specialty?: string;
  locationPreference?: "current" | "specified" | "none";
  specifiedLocation?: string;
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
   * Match doctor name from user message to found doctors
   */
  private matchDoctorName(userMessage: string): string | null {
    if (!this.context.foundDoctors || this.context.foundDoctors.length === 0) {
      return null;
    }

    const lowerMessage = userMessage.toLowerCase();
    
    // Try to match doctor names
    for (const doctor of this.context.foundDoctors) {
      const doctorName = doctor.name.toLowerCase();
      // Remove "Dr." or "Dr" prefix for matching
      const nameWithoutPrefix = doctorName.replace(/^dr\.?\s*/i, "");
      const firstName = nameWithoutPrefix.split(/\s+/)[0];
      const lastName = nameWithoutPrefix.split(/\s+/).slice(1).join(" ");
      
      // Check if message contains full name or parts of it
      if (lowerMessage.includes(doctorName) || 
          lowerMessage.includes(nameWithoutPrefix) ||
          (firstName && lowerMessage.includes(firstName)) ||
          (lastName && lowerMessage.includes(lastName))) {
        debugLog(`Matched doctor name "${doctor.name}" from message`);
        return doctor.id;
      }
    }
    
    return null;
  }

  /**
   * Process user message and return AI response, potentially using tools
   */
  async processMessage(
    userMessage: string,
    userLocation?: { lat: number; lng: number }
  ): Promise<{ response: string; action?: string; data?: any }> {
    debugLog(`Processing message: "${userMessage}"`);

    // Try to match doctor name from message
    const matchedDoctorId = this.matchDoctorName(userMessage);
    if (matchedDoctorId) {
      this.context.selectedDoctorId = matchedDoctorId;
      debugLog(`Selected doctor from message: ${matchedDoctorId}`);
    }

    // Add user message to context
    this.context.messages.push({
      role: "user",
      content: userMessage,
    });

    // Extract user info from message (email, phone, name)
    this.extractUserInfo(userMessage);

    // Parse message to extract intent and entities
    const nluResult = await parseMessage(userMessage);
    debugLog("NLU Result:", {
      intent: nluResult.intent,
      specialty: nluResult.entities?.specialty,
      location: nluResult.entities?.location,
      dateRange: nluResult.entities?.dateRange,
    });

    // Preserve specialty from conversation if mentioned
    if (nluResult.entities?.specialty && !this.context.specialty) {
      this.context.specialty = nluResult.entities.specialty;
    }

    // Extract location preference from message
    const lowerMessage = userMessage.toLowerCase();
    if (lowerMessage.includes("use my location") || 
        lowerMessage.includes("near me") || 
        lowerMessage.includes("current location") ||
        lowerMessage.includes("my location") ||
        lowerMessage.includes("where i am")) {
      this.context.locationPreference = "current";
    } else if (nluResult.entities?.location) {
      this.context.locationPreference = "specified";
      this.context.specifiedLocation = nluResult.entities.location;
    }

    // Auto-book if we have enough information: email, time, and specialty
    const hasEmail = this.context.userInfo?.email;
    const hasTime = nluResult.entities?.dateRange?.start;
    const hasSpecialty = this.context.specialty || nluResult.entities?.specialty;

    if (hasEmail && hasTime && hasSpecialty && !this.context.selectedDoctorId) {
      debugLog("Attempting auto-booking...");
      
      // If location is specified but not geocoded yet, geocode it now
      let locationForBooking = userLocation;
      if (!locationForBooking && this.context.locationPreference === "specified" && this.context.specifiedLocation) {
        try {
          const { geocode } = await import("./geocode");
          const geocodeResult = await geocode(this.context.specifiedLocation);
          locationForBooking = { lat: geocodeResult.lat, lng: geocodeResult.lng };
        } catch (error) {
          debugLog("Geocoding failed:", error);
        }
      }
      
      // Try to auto-book using database data
      const autoBookResult = await this.attemptAutoBooking(
        hasSpecialty,
        hasTime,
        locationForBooking
      );
      if (autoBookResult) {
        return autoBookResult;
      }
    }

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
    const ruleBasedResult = this.ruleBasedResponse(nluResult, userMessage, userLocation);
    return ruleBasedResult;
  }

  /**
   * Attempt to automatically book an appointment using database data
   */
  private async attemptAutoBooking(
    specialty: string,
    startTimeUtc: string,
    userLocation?: { lat: number; lng: number }
  ): Promise<{ response: string; action?: string; data?: any } | null> {
    debugLog("Auto-booking:", { specialty, startTimeUtc, userLocation });

    try {
      let doctorsWithCalendar: any[] = [];

      // If we already have doctors in context, use them
      if (this.context.foundDoctors && this.context.foundDoctors.length > 0) {
        debugLog(`Using ${this.context.foundDoctors.length} doctors from context`);
        // Fetch full doctor data for doctors in context
        const doctorIds = this.context.foundDoctors.map((d) => d.id);
        const doctors = await prismaClient.doctor.findMany({
          where: { id: { in: doctorIds } },
        });
        doctorsWithCalendar = doctors;
      } else {
        // Normalize specialty to canonical form (e.g., "cardiologist" -> "cardiology")
        const normalizedSpecialty = normalizeSpecialty(specialty);
        
        // Fetch doctors from database for this specialty
        // SQLite doesn't support case-insensitive mode, so we fetch all and filter
        const allDoctors = await prismaClient.doctor.findMany();

        // Filter by normalized specialty (case-insensitive)
        const doctors = allDoctors.filter((d) =>
          normalizeSpecialty(d.specialty) === normalizedSpecialty
        );

        if (doctors.length === 0) {
          debugLog(`No doctors found for specialty "${normalizedSpecialty}"`);
          return null; // No doctors found, let AI handle it
        }

      // No need to filter by calendar credentials - we use local calendar
      doctorsWithCalendar = doctors;
      }

      if (doctorsWithCalendar.length === 0) {
        return null; // No doctors found, let AI handle it
      }

      // If we have location, filter by radius and sort by distance; otherwise use first available
      let selectedDoctor = doctorsWithCalendar[0];
      const radiusKm = 50; // Default radius: 50km
      
      if (userLocation) {
        const { getDistance } = await import("geolib");
        const doctorsWithDistance = doctorsWithCalendar
          .map((doctor) => ({
            doctor,
            distance: getDistance(
              { latitude: userLocation.lat, longitude: userLocation.lng },
              { latitude: doctor.latitude, longitude: doctor.longitude }
            ) / 1000,
          }))
          .filter((d) => d.distance <= radiusKm) // Filter by radius
          .sort((a, b) => a.distance - b.distance);
        
        if (doctorsWithDistance.length === 0) {
          // If no doctors within radius, use the closest one anyway
          const allWithDistance = doctorsWithCalendar
            .map((doctor) => ({
              doctor,
              distance: getDistance(
                { latitude: userLocation.lat, longitude: userLocation.lng },
                { latitude: doctor.latitude, longitude: doctor.longitude }
              ) / 1000,
            }))
            .sort((a, b) => a.distance - b.distance);
          selectedDoctor = allWithDistance[0].doctor;
          debugLog(`Selected closest doctor: ${selectedDoctor.name} (${allWithDistance[0].distance.toFixed(2)} km away)`);
        } else {
          selectedDoctor = doctorsWithDistance[0].doctor;
          debugLog(`Selected nearest doctor: ${selectedDoctor.name} (${doctorsWithDistance[0].distance.toFixed(2)} km away)`);
        }
      }

      // Store in context
      this.context.foundDoctors = doctorsWithCalendar;
      this.context.selectedDoctorId = selectedDoctor.id;
      debugLog(`Selected doctor: ${selectedDoctor.name} (${selectedDoctor.specialty})`);

      // Check availability for the requested time
      const startDate = new Date(startTimeUtc);
      const endDate = new Date(startDate.getTime() + 30 * 60 * 1000); // 30 min default

      const { checkAvailability } = await import("./localCalendar");
      
      // First, check if the exact requested time is available
      const requestedTimeCheck = await checkAvailability(
        selectedDoctor.id,
        startDate,
        endDate,
        30
      );
      
      // If the exact time is not available, search for slots in a wider window
      let availableSlots: Array<{ start: Date; end: Date }> = [];
      if (requestedTimeCheck.length === 0) {
        // Requested time is booked, search for next available slots
        debugLog(`Requested time ${startTimeUtc} is not available, searching for alternatives...`);
        availableSlots = await checkAvailability(
          selectedDoctor.id,
          startDate,
          new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000), // Check next 7 days
          30
        );
      } else {
        // Exact time is available
        availableSlots = requestedTimeCheck;
      }
      
      debugLog(`Found ${availableSlots.length} available slots`);

      // Find a slot that matches or is close to requested time
      const requestedTime = startDate.getTime();
      const matchingSlot = availableSlots.find((slot) => {
        const slotTime = slot.start.getTime();
        const timeDiff = Math.abs(slotTime - requestedTime);
        return timeDiff < 60 * 60 * 1000; // Within 1 hour
      });

      let slotToUse = matchingSlot || availableSlots[0];

      // If no slots found at all, return a helpful message
      if (!slotToUse) {
        const requestedHour = startDate.getUTCHours();
        const requestedMinute = startDate.getUTCMinutes();
        
        // Check if requested time is within reasonable working hours (8 AM - 6 PM UTC)
        if (requestedHour >= 8 && requestedHour < 18) {
          // Time is reasonable but no slots found - doctor might be fully booked
          return {
            response: `I found ${selectedDoctor.name}, a ${specialty} specialist, but they don't have any available slots around ${startTimeUtc}. Would you like me to check other times or find another doctor?`,
            action: "check_availability",
            data: { slots: [] },
          };
        } else {
          debugLog(`Requested time is outside working hours (${requestedHour}:${String(requestedMinute).padStart(2, '0')} UTC)`);
          return {
            response: `I found ${selectedDoctor.name}, a ${specialty} specialist, but they don't have availability at ${startTimeUtc} (outside working hours). Would you like me to check other times?`,
            action: "check_availability",
            data: { slots: [] },
          };
        }
      }

      debugLog(`Selected slot: ${slotToUse.start.toISOString()} to ${slotToUse.end.toISOString()}`);
      
      // Determine if we're using the exact requested time or an alternative
      const isExactMatch = matchingSlot !== undefined;
      const slotTime = slotToUse.start.getTime();
      const timeDiff = Math.abs(slotTime - requestedTime);
      const hoursDiff = Math.round(timeDiff / (60 * 60 * 1000));
      
      // Book the appointment
      const user = {
        name: this.context.userInfo?.name || "Patient",
        email: this.context.userInfo?.email!,
        phone: this.context.userInfo?.phone,
      };
      debugLog("Booking appointment for user:", user);

      const bookingResult = await this.createAppointmentBooking({
        doctorId: selectedDoctor.id,
        startUtc: slotToUse.start.toISOString(),
        endUtc: slotToUse.end.toISOString(),
        user,
        durationMinutes: 30,
      });
      debugLog(`Appointment booking successful! ID: ${bookingResult.appointmentId}`);

      // Craft response message based on whether we used exact time or alternative
      let responseMessage: string;
      if (isExactMatch) {
        responseMessage = `Great! I've booked an appointment with ${selectedDoctor.name} (${specialty}) for ${slotToUse.start.toLocaleString()}. Your appointment is confirmed!`;
      } else if (hoursDiff <= 2) {
        responseMessage = `The time you requested wasn't available, but I found a slot ${hoursDiff === 0 ? 'at the same time' : `just ${hoursDiff} hour${hoursDiff > 1 ? 's' : ''} ${slotTime > requestedTime ? 'later' : 'earlier'}`}. I've booked your appointment with ${selectedDoctor.name} (${specialty}) for ${slotToUse.start.toLocaleString()}. Your appointment is confirmed!`;
      } else {
        responseMessage = `The time you requested wasn't available, but I found the next available slot. I've booked your appointment with ${selectedDoctor.name} (${specialty}) for ${slotToUse.start.toLocaleString()}. Your appointment is confirmed!`;
      }

      return {
        response: responseMessage,
        action: "schedule_appointment",
        data: bookingResult,
      };
    } catch (error) {
      console.error("Auto-booking failed:", error);
      return null; // Fall back to AI
    }
  }

  /**
   * Extract user information (email, phone, name) from message and update context
   */
  private extractUserInfo(userMessage: string): void {
    const timestamp = new Date().toISOString();
    
    // Extract email
    const emailMatch = userMessage.match(/\b[\w.-]+@[\w.-]+\.\w+\b/);
    if (emailMatch && !this.context.userInfo?.email) {
      this.context.userInfo = {
        ...this.context.userInfo,
        email: emailMatch[0],
      };
      console.log(`[${timestamp}] [EXTRACT] ✓ Extracted email: ${emailMatch[0]}`);
    } else if (emailMatch) {
      console.log(`[${timestamp}] [EXTRACT] Email already in context: ${this.context.userInfo?.email}`);
    } else {
      console.log(`[${timestamp}] [EXTRACT] No email found in message`);
    }

    // Extract phone
    const phoneMatch = userMessage.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
    if (phoneMatch && !this.context.userInfo?.phone) {
      this.context.userInfo = {
        ...this.context.userInfo,
        phone: phoneMatch[0],
      };
      console.log(`[${timestamp}] [EXTRACT] ✓ Extracted phone: ${phoneMatch[0]}`);
    } else if (phoneMatch) {
      console.log(`[${timestamp}] [EXTRACT] Phone already in context: ${this.context.userInfo?.phone}`);
    } else {
      console.log(`[${timestamp}] [EXTRACT] No phone found in message`);
    }

    // Extract name (look for patterns like "my name is", "i'm", "i am", "call me", or name at start of sentence)
    // Improved regex to avoid capturing "and" after the name
    let nameMatch = userMessage.match(/(?:my name is|i'm|i am|call me|this is|hello im|hi im|i am)\s+([A-Z][a-z]+)(?:\s+and\s+my|\s+and\s+email|\s+and\s+phone|$|\s*[,\.]|\s+(?:a|an|the|is|needs|wants|email|phone))/i);
    if (!nameMatch) {
      // Try to extract name at the start of a sentence (e.g., "Sarah, a busy professional...")
      nameMatch = userMessage.match(/^(?:hello|hi)\s+im\s+([A-Z][a-z]+)(?:\s+and\s+my|\s+and\s+email|$|\s*[,\.])/i);
    }
    if (!nameMatch) {
      // Try "hello im ahmed" pattern
      nameMatch = userMessage.match(/^(?:hello|hi)\s+im\s+([A-Z][a-z]+)(?:\s+and\s+my|\s+and\s+email|$|\s*[,\.])/i);
    }
    if (!nameMatch) {
      // Try name at start followed by comma or common words, but stop before "and"
      nameMatch = userMessage.match(/^([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?(?:\s*[,\.]|\s+(?:a|an|the|is|needs|wants|email|phone))/);
    }
    // Additional pattern: "for sarah" or "for [name]"
    if (!nameMatch) {
      nameMatch = userMessage.match(/(?:for|with|patient|name)\s+([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?(?:\s+[a-z]+@|\s*[,\.]|$)/i);
    }
    if (nameMatch && !this.context.userInfo?.name) {
      // Clean up the name - take only the first word if it looks like multiple words
      let extractedName = nameMatch[1].trim();
      // If name contains "and" or other stop words, take only the part before them
      const stopWords = /\s+(and|my|email|phone|is|a|an|the)\s+/i;
      if (stopWords.test(extractedName)) {
        extractedName = extractedName.split(stopWords)[0].trim();
      }
      this.context.userInfo = {
        ...this.context.userInfo,
        name: extractedName,
      };
      console.log(`[${timestamp}] [EXTRACT] ✓ Extracted name: ${extractedName}`);
    } else if (nameMatch) {
      console.log(`[${timestamp}] [EXTRACT] Name already in context: ${this.context.userInfo?.name}`);
    } else {
      console.log(`[${timestamp}] [EXTRACT] No name found in message`);
    }
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
    if (this.context.userInfo?.phone) {
      contextInfo.push(`User phone: ${this.context.userInfo.phone}`);
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

    // Extract time preference from message if dateRange is available
    let timePreference = "";
    if (nluResult.entities?.dateRange) {
      timePreference = `Preferred time: ${nluResult.entities.dateRange.start}`;
      contextInfo.push(timePreference);
    }

    // Include specialty from context if available
    const specialtyToUse = nluResult.entities?.specialty || this.context.specialty;
    if (specialtyToUse) {
      contextInfo.push(`Specialty needed: ${specialtyToUse}`);
    }

    // Include location preference
    if (this.context.locationPreference) {
      if (this.context.locationPreference === "current") {
        contextInfo.push(`Location preference: Use current location (GPS)`);
      } else if (this.context.locationPreference === "specified") {
        contextInfo.push(`Location preference: Specified location - ${this.context.specifiedLocation}`);
      }
    } else if (specialtyToUse && !userLocation && !nluResult.entities?.location) {
      contextInfo.push(`⚠️ Location needed: Ask user if they want to use current location or specify a location`);
    }

    const systemPrompt = `You are a helpful AI assistant for booking doctor appointments. You have access to these tools:

1. search_doctors(specialty: string, near: {lat: number, lng: number}, radiusKm?: number) - Search for doctors
2. check_availability(doctorId: string, startUtc: string, endUtc: string, slotMinutes?: number) - Check doctor availability
3. book_appointment(doctorId: string, startUtc: string, user: {name: string, email: string, phone?: string}) - Quick booking when only minimal info is available
4. schedule_appointment(doctorId: string, startUtc: string, user: {...}, reason?: string, symptoms?: string[]) - Preferred booking flow that captures patient context
5. get_doctor_schedule(doctorId: string, startUtc: string, endUtc: string) - Retrieve upcoming appointments
6. get_appointment_stats(doctorId: string, startUtc: string, endUtc: string, groupBy?: "day"|"week"|"month") - Summarize workload
7. search_patients_by_symptom(symptom: string, doctorId?: string, startUtc?: string, endUtc?: string) - Find patients that match a clinical query

IMPORTANT RULES:
- When the user provides information like email, name, or time preference, use it immediately in your tool calls
- Don't ask for information that has already been provided in the context
- ALWAYS use database data directly - the system will automatically fetch doctors from the database
- If you have email, time, and specialty, the system will automatically find and book with an available doctor
- Use the user's email and name from context when calling booking tools
- The search_doctors tool queries the local database - no external searches needed
- When booking, if selectedDoctorId is in context, you can omit doctorId from the tool call - the system will use the selected doctor automatically
- If the user mentions a doctor name (e.g., "Dr. Emily Rodriguez"), match it to the foundDoctors list and use that doctor's ID
- When user confirms booking with "yes" or similar, use the selectedDoctorId from context if available

LOCATION HANDLING:
- If location is needed but not provided, ask the user: "Would you like me to find doctors near your current location, or would you prefer to specify a location (e.g., 'Algiers', 'New York')?"
- If user says "use my location", "near me", "current location", or similar, set locationPreference to "current"
- If user specifies a location name (e.g., "Algiers", "near Oran"), set locationPreference to "specified" and use that location
- Wait for user's location preference before searching for doctors

Current context:
${contextInfo.length > 0 ? contextInfo.join("\n") : "No context yet"}

Parsed intent: ${nluResult.intent}
Specialty (from this message): ${nluResult.entities?.specialty || "not specified"}
Specialty (from conversation): ${this.context.specialty || "not specified"}
Location: ${nluResult.entities?.location || "not specified"}
Date/Time: ${nluResult.entities?.dateRange ? nluResult.entities.dateRange.start : "not specified"}

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
          
          // After tool execution, check if we can auto-book
          if (toolCall.name === "search_doctors" && toolResult?.doctors && toolResult.doctors.length > 0) {
            // We found doctors, check if we can auto-book
            const hasEmail = this.context.userInfo?.email;
            const specialty = toolCall.arguments?.specialty || this.context.specialty;
            
            // Try to extract time from the original message (get last user message from context)
            let hasTime: string | undefined;
            const lastUserMessage = this.context.messages.filter(m => m.role === "user").pop()?.content || userMessage;
            try {
              const chrono = await import("chrono-node");
              const parsedDates = chrono.parse(lastUserMessage);
              if (parsedDates.length > 0) {
                hasTime = parsedDates[0].start.date().toISOString();
              }
            } catch (error) {
              // If chrono fails, try using nluResult
              hasTime = nluResult.entities?.dateRange?.start;
            }
            
            // If we have all required info, attempt auto-booking
            if (hasEmail && hasTime && specialty && !this.context.selectedDoctorId) {
              console.log(`[${new Date().toISOString()}] 🔄 POST-TOOL: Attempting auto-booking after doctor search...`);
              console.log(`[${new Date().toISOString()}] 🔄 POST-TOOL: Has email: ✓, Has time: ${hasTime ? '✓' : '✗'}, Has specialty: ✓`);
              
              // Get location for booking
              let locationForBooking = userLocation;
              if (!locationForBooking && this.context.locationPreference === "specified" && this.context.specifiedLocation) {
                try {
                  const { geocode } = await import("./geocode");
                  const geocodeResult = await geocode(this.context.specifiedLocation);
                  locationForBooking = { lat: geocodeResult.lat, lng: geocodeResult.lng };
                } catch (error) {
                  // Use tool result location if available
                  if (toolCall.arguments?.near) {
                    locationForBooking = toolCall.arguments.near;
                  }
                }
              } else if (toolCall.arguments?.near) {
                locationForBooking = toolCall.arguments.near;
              }
              
              const autoBookResult = await this.attemptAutoBooking(
                specialty,
                hasTime,
                locationForBooking
              );
              
              if (autoBookResult && autoBookResult.action !== "check_availability") {
                // Only return auto-booking result if it actually booked (not just checking availability)
                console.log(`[${new Date().toISOString()}] 🔄 POST-TOOL: ✓ Auto-booking successful after tool execution!`);
                return autoBookResult;
              } else {
                console.log(`[${new Date().toISOString()}] 🔄 POST-TOOL: ✗ Auto-booking failed or no availability, returning search results`);
              }
            }
          }
          
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
        const timestamp = new Date().toISOString();
        console.log(`\n[${timestamp}] 🔧 TOOL: search_doctors called`);
        console.log(`[${timestamp}] 🔧 TOOL: Arguments:`, args);
        
        // Use specialty from args, or fall back to context
        const specialty = args.specialty || this.context.specialty;
        if (!specialty) {
          console.log(`[${timestamp}] 🔧 TOOL: ✗ Specialty is required`);
          throw new Error("Specialty is required. Please specify a medical specialty.");
        }
        console.log(`[${timestamp}] 🔧 TOOL: Searching for specialty: ${specialty}`);
        
        let location = args.near || userLocation;
        
        // Handle location preference from context
        if (!location) {
          if (this.context.locationPreference === "specified" && this.context.specifiedLocation) {
            console.log(`[${timestamp}] 🔧 TOOL: Using specified location from context: ${this.context.specifiedLocation}`);
            try {
              const { geocode } = await import("./geocode");
              const geocodeResult = await geocode(this.context.specifiedLocation);
              location = { lat: geocodeResult.lat, lng: geocodeResult.lng };
              console.log(`[${timestamp}] 🔧 TOOL: ✓ Geocoded to:`, location);
            } catch (error) {
              console.log(`[${timestamp}] 🔧 TOOL: ✗ Geocoding failed:`, error);
              throw new Error(`Could not find location: ${this.context.specifiedLocation}`);
            }
          } else if (this.context.locationPreference === "current") {
            console.log(`[${timestamp}] 🔧 TOOL: User wants to use current location, but location not provided`);
            throw new Error("Current location not available. Please enable location access or specify a location.");
          }
        }
        
        // If location is provided as a string (location name), try to geocode it
        if (!location && args.location && typeof args.location === "string") {
          console.log(`[${timestamp}] 🔧 TOOL: Geocoding location string: ${args.location}`);
          try {
            const { geocode } = await import("./geocode");
            const geocodeResult = await geocode(args.location);
            location = { lat: geocodeResult.lat, lng: geocodeResult.lng };
            console.log(`[${timestamp}] 🔧 TOOL: ✓ Geocoded to:`, location);
          } catch (error) {
            console.log(`[${timestamp}] 🔧 TOOL: ✗ Geocoding failed:`, error);
            throw new Error(`Could not find location: ${args.location}`);
          }
        }
        
        if (!location) {
          console.log(`[${timestamp}] 🔧 TOOL: ✗ Location is required`);
          throw new Error("Location is required. Please provide coordinates, specify a location name, or use your current location.");
        }
        console.log(`[${timestamp}] 🔧 TOOL: Using location:`, location);

        // Normalize specialty to canonical form (e.g., "cardiologist" -> "cardiology")
        const normalizedSpecialty = normalizeSpecialty(specialty);
        console.log(`[${timestamp}] 🔧 TOOL: Normalized specialty: "${specialty}" -> "${normalizedSpecialty}"`);
        
        // SQLite doesn't support case-insensitive mode, so we fetch all and filter
        console.log(`[${timestamp}] 🔧 TOOL: Querying database for doctors...`);
        const allDoctors = await prismaClient.doctor.findMany();
        console.log(`[${timestamp}] 🔧 TOOL: Found ${allDoctors.length} total doctors in database`);
        
        // Filter by normalized specialty (case-insensitive)
        const doctors = allDoctors.filter((d) =>
          normalizeSpecialty(d.specialty) === normalizedSpecialty
        );
        console.log(`[${timestamp}] 🔧 TOOL: Filtered to ${doctors.length} doctors matching "${normalizedSpecialty}"`);

        // Calculate distances and filter by radius
        console.log(`[${timestamp}] 🔧 TOOL: Calculating distances from user location...`);
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

        console.log(`[${timestamp}] 🔧 TOOL: Found ${doctorsWithDistance.length} doctors within radius`);
        doctorsWithDistance.forEach((d, i) => {
          console.log(`[${timestamp}] 🔧 TOOL:   ${i + 1}. ${d.name} - ${d.specialty} (${d.distance.toFixed(2)} km)`);
        });

        this.context.foundDoctors = doctorsWithDistance;
        console.log(`[${timestamp}] 🔧 TOOL: ✓ Search complete, returning ${doctorsWithDistance.length} doctors\n`);
        return { doctors: doctorsWithDistance };
      }

      case "check_availability": {
        const timestamp = new Date().toISOString();
        console.log(`\n[${timestamp}] 🔧 TOOL: check_availability called`);
        console.log(`[${timestamp}] 🔧 TOOL: Arguments:`, args);
        
        if (!args.doctorId) {
          console.log(`[${timestamp}] 🔧 TOOL: ✗ Doctor ID is required`);
          throw new Error("Doctor ID is required");
        }
        if (!args.startUtc || !args.endUtc) {
          console.log(`[${timestamp}] 🔧 TOOL: ✗ Start and end times are required`);
          throw new Error("Start and end times are required");
        }

        console.log(`[${timestamp}] 🔧 TOOL: Checking availability for doctor ${args.doctorId}`);
        const slots = await checkAvailability(
          args.doctorId,
          new Date(args.startUtc),
          new Date(args.endUtc),
          args.slotMinutes || 30
        );
        console.log(`[${timestamp}] 🔧 TOOL: ✓ Found ${slots.length} available slots\n`);

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
        // Use doctorId from args, or fall back to selectedDoctorId from context
        const doctorId = args.doctorId || this.context.selectedDoctorId;
        if (!doctorId || !args.startUtc) {
          throw new Error("Doctor ID and start time are required. Please specify a doctor or select one from the search results.");
        }

        // Use provided user info or fall back to context
        const user = args.user || {
          name: this.context.userInfo?.name || "Patient",
          email: this.context.userInfo?.email || "",
          phone: this.context.userInfo?.phone,
        };

        if (!user.email) {
          throw new Error("User email is required. Please provide email in the user object or in your message.");
        }

        return this.createAppointmentBooking({
          doctorId,
          startUtc: args.startUtc,
          endUtc: args.endUtc,
          user,
          durationMinutes: args.durationMinutes,
        });
      }

      case "schedule_appointment": {
        // Use doctorId from args, or fall back to selectedDoctorId from context
        const doctorId = args.doctorId || this.context.selectedDoctorId;
        if (!doctorId || !args.startUtc) {
          throw new Error("Doctor ID and start time are required. Please specify a doctor or select one from the search results.");
        }

        // Use provided user info or fall back to context
        const user = args.user || {
          name: this.context.userInfo?.name || "Patient",
          email: this.context.userInfo?.email || "",
          phone: this.context.userInfo?.phone,
        };

        if (!user.email) {
          throw new Error("User email is required. Please provide email in the user object or in your message.");
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
          user,
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
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] 📝 BOOKING: Creating appointment booking`);
    console.log(`[${timestamp}] 📝 BOOKING: Doctor ID: ${args.doctorId}`);
    console.log(`[${timestamp}] 📝 BOOKING: Start: ${args.startUtc}`);
    console.log(`[${timestamp}] 📝 BOOKING: User:`, args.user);

    const doctor = await prismaClient.doctor.findUnique({
      where: { id: args.doctorId },
    });

    if (!doctor) {
      console.log(`[${timestamp}] 📝 BOOKING: ✗ Doctor not found`);
      throw new Error("Doctor not found");
    }

    console.log(`[${timestamp}] 📝 BOOKING: ✓ Doctor found: ${doctor.name} (${doctor.specialty})`);
    
    // No need to check for calendar credentials - we use local calendar

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

    const calendarResult = await createCalendarEvent(
      args.doctorId,
      startDate,
      endDate,
      args.user.name,
      args.user.email,
      args.user.phone,
      args.reason,
      args.symptoms
    );
    
    const { eventId, calendarLink } = calendarResult;

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
      googleCalendarLink: calendarResult.googleCalendarLink,
      outlookCalendarLink: calendarResult.outlookCalendarLink,
      appleCalendarLink: calendarResult.appleCalendarLink,
      icalContent: calendarResult.icalContent,
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

      // Check if location preference is needed
      if (!userLocation && !nluResult.entities?.location && !this.context.locationPreference) {
        return {
          response:
            "Would you like me to find doctors near your current location, or would you prefer to specify a location (e.g., 'Algiers', 'New York')?",
        };
      }

      // If user wants current location but it's not provided
      if (this.context.locationPreference === "current" && !userLocation) {
        return {
          response:
            "I need access to your current location. Please enable location access in your browser/device, or you can specify a location name instead.",
        };
      }

      // This will be handled by the AI agent or we can trigger search here
      const locationText = this.context.locationPreference === "current" 
        ? "near you" 
        : this.context.specifiedLocation 
          ? `in ${this.context.specifiedLocation}` 
          : "near you";
      
      return {
        response: `I'll search for ${nluResult.entities?.specialty} doctors ${locationText}. Let me find the best options...`,
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


