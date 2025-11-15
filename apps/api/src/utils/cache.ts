import NodeCache from "node-cache";

// Doctor search cache: 5 minutes
export const doctorSearchCache = new NodeCache({
  stdTTL: 300, // 5 minutes
  checkperiod: 60,
});

// Geocoding cache: 1 hour
export const geocodeCache = new NodeCache({
  stdTTL: 3600, // 1 hour
  checkperiod: 300,
});

// Availability cache: 30 seconds
export const availabilityCache = new NodeCache({
  stdTTL: 30,
  checkperiod: 10,
});

// NLU cache: 5 minutes
export const nluCache = new NodeCache({
  stdTTL: 300, // 5 minutes
  checkperiod: 60,
});

