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

// Basic input sanitization - remove potentially dangerous characters
function sanitizeInput(input: string): string {
  // Remove null bytes and control characters (except newlines and tabs)
  return input
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, 1000); // Limit length to prevent DoS
}

export async function parseMessage(message: string): Promise<NLUResult> {
  // Sanitize input
  const sanitized = sanitizeInput(message);
  
  if (!sanitized) {
    throw new Error("Message cannot be empty");
  }

  // Check cache first
  const cacheKey = `nlu:${sanitized.toLowerCase()}`;
  const cached = nluCache.get<NLUResult>(cacheKey);
  if (cached) {
    return cached;
  }

  const lowerMessage = sanitized.toLowerCase();

  // Extract specialty
  let specialty: string | undefined;
  for (const [key, value] of Object.entries(SPECIALTY_MAP)) {
    if (lowerMessage.includes(key)) {
      specialty = value;
      break;
    }
  }

  // Extract date range using chrono-node
  const parsedDates = chrono.parse(sanitized);
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
      const afterKeyword = sanitized.substring(index + keyword.length).trim();
      // Take first few words as location, but stop at stop words like "and", "my", "for", "tomorrow"
      const stopWords = /\s+(and|my|for|tomorrow|tomorow|today|email|phone|name|is|a|an|the)\s+/i;
      const stopIndex = afterKeyword.search(stopWords);
      const locationText = stopIndex > 0 ? afterKeyword.substring(0, stopIndex) : afterKeyword;
      // Take first 1-2 words as location (city names are usually 1-2 words)
      const words = locationText.split(/\s+/).slice(0, 2).filter(w => w.length > 0);
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

  // Use OpenRouter API for better understanding, especially for ambiguous cases
  // Only use if rule-based parsing didn't find key information
  const needsEnhancement = !specialty && !dateRange && !location;
  if (process.env.OPENROUTER_API_KEY && needsEnhancement) {
    try {
      const openRouterResult = await enhanceWithOpenRouter(sanitized);
      if (openRouterResult) {
        // Cache and return the enhanced result
        nluCache.set(cacheKey, openRouterResult);
        return openRouterResult;
      }
    } catch (error) {
      console.warn("OpenRouter enhancement failed, using rule-based result:", error);
    }
  }

  return result;
}

async function enhanceWithOpenRouter(message: string): Promise<NLUResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = "openai/gpt-4o-mini"; // Use faster, cheaper model

  if (!apiKey) {
    return null;
  }

  // Escape message for JSON to prevent injection
  const escapedMessage = message.replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");

  const prompt = `Extract medical appointment information from this message. Return JSON with: intent (book_appointment, search_doctors, check_availability, or modify_appointment), specialty (medical specialty name), location (location name or address), and dateRange (object with start and end as ISO8601 strings, or null if not mentioned).

Message: "${escapedMessage}"

Return only valid JSON, no other text.`;

  try {
    // Single API call - removed the slow second verification call for better performance
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 200, // Limit response size
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("OpenRouter API error:", errorText);
      return null;
    }

    const result = await response.json();
    const text = result.choices[0]?.message?.content || "";
    
    // Extract JSON from response (might have extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed as NLUResult;
      } catch {
        return null;
      }
    }
  } catch (error) {
    console.warn("OpenRouter request failed:", error);
  }

  return null;
}

