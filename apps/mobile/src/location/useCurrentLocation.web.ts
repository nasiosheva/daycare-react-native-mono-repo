import { useCallback, useRef, useState } from "react";
import { env } from "@/config/env";
import { createCurrentLocation, LOCATION_FETCH_TIMEOUT_MS, mapWebGeolocationErrorCode, type CurrentLocation, type LocationController, type LocationError, type LocationStatus } from "./types";

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: LOCATION_FETCH_TIMEOUT_MS, maximumAge: 0 });
  });
}

async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  if (!env.googleMapsGeocodingApiKey) return null;
  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${env.googleMapsGeocodingApiKey}`);
    if (!response.ok) return null;
    const body = await response.json();
    return body?.results?.[0]?.formatted_address ?? null;
  } catch {
    return null;
  }
}

export function useCurrentLocation(): LocationController {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [location, setLocation] = useState<CurrentLocation | null>(null);
  const [error, setError] = useState<LocationError | null>(null);
  const busyRef = useRef(false);

  const getCurrentLocation = useCallback(async (): Promise<CurrentLocation | null> => {
    if (busyRef.current) return location;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError({ code: "unsupported", message: "Getting the current location is not supported in this browser." });
      setStatus("unsupported");
      return null;
    }

    busyRef.current = true;
    setStatus("locating");
    setError(null);

    try {
      const position = await getPosition();
      const address = await reverseGeocode(position.coords.latitude, position.coords.longitude);
      const nextLocation = createCurrentLocation(position.coords.latitude, position.coords.longitude, position.coords.accuracy, position.timestamp, address);
      setLocation(nextLocation);
      setError(null);
      setStatus("completed");
      return nextLocation;
    } catch (nextError) {
      const code = typeof nextError === "object" && nextError !== null && "code" in nextError ? mapWebGeolocationErrorCode(Number((nextError as { code: number }).code)) : "location_failed";
      setError({ code, message: nextError instanceof Error ? nextError.message : "Getting the current location is unavailable." });
      setStatus("error");
      return null;
    } finally {
      busyRef.current = false;
    }
  }, [location]);

  const clear = useCallback(() => {
    setLocation(null);
    setError(null);
    setStatus("idle");
  }, []);

  return { status, location, error, getCurrentLocation, clear };
}
