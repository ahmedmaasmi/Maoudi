import { useCallback, useRef } from "react";
import { GEOLOCATION_TIMEOUT, GEOLOCATION_CACHE_AGE, LOCATION_RACE_TIMEOUT } from "@/lib/constants";

export interface Location {
  lat: number;
  lng: number;
}

interface CachedLocation {
  location: Location;
  timestamp: number;
}

/**
 * Hook for getting user geolocation with caching
 */
export function useGeolocation() {
  const cacheRef = useRef<CachedLocation | null>(null);

  const getLocation = useCallback(async (): Promise<Location | undefined> => {
    if (!navigator.geolocation) {
      return undefined;
    }

    // Check cache first
    const cached = cacheRef.current;
    if (cached && Date.now() - cached.timestamp < GEOLOCATION_CACHE_AGE) {
      return cached.location;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          { timeout: GEOLOCATION_TIMEOUT, maximumAge: GEOLOCATION_CACHE_AGE }
        );
      });

      const location: Location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      // Update cache
      cacheRef.current = { location, timestamp: Date.now() };
      return location;
    } catch (error) {
      console.log("[useGeolocation] Location not available:", error);
      return undefined;
    }
  }, []);

  const getLocationWithTimeout = useCallback(async (): Promise<Location | undefined> => {
    const locationPromise = new Promise<Location | undefined>((resolve) => {
      if (!navigator.geolocation) {
        resolve(undefined);
        return;
      }

      const timeoutId = setTimeout(() => {
        resolve(undefined);
      }, GEOLOCATION_TIMEOUT);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          const location: Location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          cacheRef.current = { location, timestamp: Date.now() };
          resolve(location);
        },
        () => {
          clearTimeout(timeoutId);
          resolve(undefined);
        },
        { timeout: GEOLOCATION_TIMEOUT, maximumAge: GEOLOCATION_CACHE_AGE }
      );
    });

    // Race with a shorter timeout to avoid blocking
    return Promise.race([
      locationPromise,
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), LOCATION_RACE_TIMEOUT)),
    ]);
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current = null;
  }, []);

  return { getLocation, getLocationWithTimeout, clearCache };
}

