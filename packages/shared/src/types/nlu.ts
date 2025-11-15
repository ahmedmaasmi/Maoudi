export interface NLUResult {
  intent: string;
  entities: {
    specialty?: string;
    location?: string;
    dateRange?: {
      start: string; // ISO8601
      end: string; // ISO8601
    };
  };
}

export interface NLUParseRequest {
  message: string;
}

