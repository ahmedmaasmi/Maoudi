import rateLimit from "express-rate-limit";

// Global rate limit: 100 requests/minute per IP
export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests, please try again later",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Geocoding rate limit: 1 request/second (Nominatim compliance)
export const geocodeRateLimit = rateLimit({
  windowMs: 1000, // 1 second
  max: 1,
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Geocoding rate limit exceeded. Please wait 1 second between requests.",
    },
  },
});

// Availability rate limit: 10 requests/minute per doctor
export const availabilityRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const doctorId = req.body?.doctorId || req.query?.doctorId || req.ip;
    return `availability:${doctorId}`;
  },
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many availability checks, please try again later",
    },
  },
});

// Booking rate limit: 5 requests/minute per IP
export const bookingRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many booking attempts, please try again later",
    },
  },
});

