import { z } from "zod";

export const NLUParseRequestSchema = z.object({
  message: z.string().min(1),
});

export const NLUResultSchema = z.object({
  intent: z.string(),
  entities: z.object({
    specialty: z.string().optional(),
    location: z.string().optional(),
    dateRange: z
      .object({
        start: z.string().datetime(),
        end: z.string().datetime(),
      })
      .optional(),
  }),
});

