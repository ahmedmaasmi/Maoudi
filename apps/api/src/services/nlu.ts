import * as chrono from "chrono-node";
import { NLUResult } from "@voice-appointment/shared";
import { nluCache } from "../utils/cache";

// Specialty mapping dictionary
const SPECIALTY_MAP: Record<string, string> = {
  cardiologist: "cardiology",
  cardiology: "cardiology",
  heart: "cardiology",
  dentist: "dentistry",
  dentistry: "dentistry",
  dental: "dentistry",
  orthodontist: "dentistry",
  dermatologist: "dermatology",
  dermatology: "dermatology",
  skin: "dermatology",
  pediatrician: "pediatrics",
  pediatrics: "pediatrics",
  pediatric: "pediatrics",
  child: "pediatrics",
  general: "general practice",
  "general practice": "general practice",
  "family doctor": "general practice",
  "family physician": "general practice",
  gp: "general practice",
  neurologist: "neurology",
  neurology: "neurology",
  brain: "neurology",
  ophthalmologist: "ophthalmology",
  ophthalmology: "ophthalmology",
  eye: "ophthalmology",
  optometrist: "ophthalmology",
  psychiatrist: "psychiatry",
  psychiatry: "psychiatry",
  mental: "psychiatry",
  psychologist: "psychiatry",
  therapist: "psychiatry",
};

export async function parseMessage(message: string): Promise<NLUResult> {
  // Check cache first
  const cacheKey = `nlu:${message.toLowerCase().trim()}`;
  const cached = nluCache.get<NLUResult>(cacheKey);
  if (cached) {
    return cached;
  }

  const lowerMessage = message.toLowerCase();

  // Extract specialty
  let specialty: string | undefined;
  for (const [key, value] of Object.entries(SPECIALTY_MAP)) {
    if (lowerMessage.includes(key)) {
      specialty = value;
      break;
    }
  }

  // Extract date range using chrono-node
  const parsedDates = chrono.parse(message);
  let dateRange: { start: string; end: string } | undefined;
  
  if (parsedDates.length > 0) {
    const firstDate = parsedDates[0];
    const start = firstDate.start.date();
    const end = firstDate.end ? firstDate.end.date() : new Date(start.getTime() + 30 * 60 * 1000); // Default 30 min slot
    
    dateRange = {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  // Extract location (simple: look for common location keywords or assume it's mentioned)
  let location: string | undefined;
  const locationKeywords = ["near", "in", "at", "around", "close to", "downtown", "uptown"];
  for (const keyword of locationKeywords) {
    const index = lowerMessage.indexOf(keyword);
    if (index !== -1) {
      // Extract text after location keyword
      const afterKeyword = message.substring(index + keyword.length).trim();
      // Take first few words as location
      const words = afterKeyword.split(/\s+/).slice(0, 3);
      if (words.length > 0) {
        location = words.join(" ");
        break;
      }
    }
  }

  // Determine intent
  let intent = "book_appointment";
  if (lowerMessage.includes("cancel") || lowerMessage.includes("reschedule")) {
    intent = "modify_appointment";
  } else if (lowerMessage.includes("check") || lowerMessage.includes("availability")) {
    intent = "check_availability";
  } else if (lowerMessage.includes("search") || lowerMessage.includes("find")) {
    intent = "search_doctors";
  }

  const result: NLUResult = {
    intent,
    entities: {
      specialty,
      location,
      dateRange,
    },
  };

  // Cache the result
  nluCache.set(cacheKey, result);

  // Optional: Try Ollama for ambiguous cases
  if (!specialty && !dateRange && process.env.OLLAMA_BASE_URL) {
    try {
      const ollamaResult = await enhanceWithOllama(message);
      if (ollamaResult) {
        return ollamaResult;
      }
    } catch (error) {
      console.warn("Ollama enhancement failed, using rule-based result:", error);
    }
  }

  return result;
}

async function enhanceWithOllama(message: string): Promise<NLUResult | null> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL;
  const model = process.env.OLLAMA_MODEL || "llama2";

  if (!ollamaUrl) {
    return null;
  }

  const prompt = `Extract medical appointment information from this message. Return JSON with: intent (book_appointment, search_doctors, check_availability, or modify_appointment), specialty (medical specialty name), location (location name or address), and dateRange (object with start and end as ISO8601 strings, or null if not mentioned).

Message: "${message}"

Return only valid JSON, no other text.`;

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const text = data.response || "";
    
    // Extract JSON from response (might have extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed as NLUResult;
    }
  } catch (error) {
    console.warn("Ollama request failed:", error);
  }

  return null;
}

