import { geocodeCache } from "../utils/cache";

export interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
}

export async function geocode(query: string): Promise<GeocodeResult> {
  // Check cache first
  const cacheKey = `geocode:${query.toLowerCase().trim()}`;
  const cached = geocodeCache.get<GeocodeResult>(cacheKey);
  if (cached) {
    return cached;
  }

  // Use Nominatim (OpenStreetMap) - free, but rate limited to 1 req/sec
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "VoiceAppointmentMVP/1.0", // Required by Nominatim
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No results found for location: ${query}`);
  }

  const result: GeocodeResult = {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    address: data[0].display_name,
  };

  // Cache the result
  geocodeCache.set(cacheKey, result);

  return result;
}

