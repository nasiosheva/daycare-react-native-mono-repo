import { useCallback, useRef, useState } from "react";
import * as Location from "expo-location";
import { createCurrentLocation, LOCATION_FETCH_TIMEOUT_MS, type CurrentLocation, type LocationController, type LocationError, type LocationErrorCode, type LocationStatus } from "./types";

const LOCATION_TIMEOUT = Symbol("location_timeout");

function toError(code: LocationErrorCode, error?: unknown): LocationError {
  return { code, message: error instanceof Error ? error.message : "Getting the current location is unavailable." };
}

async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const first = results[0];
    if (!first) return null;
    return [first.street, first.city, first.region, first.country].filter(Boolean).join(", ") || null;
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
    busyRef.current = true;
    setStatus("requesting_permission");
    setError(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError(toError("permission_denied", new Error("Location permission was denied.")));
        setStatus("error");
        return null;
      }

      setStatus("locating");
      const result = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<typeof LOCATION_TIMEOUT>((resolve) => setTimeout(() => resolve(LOCATION_TIMEOUT), LOCATION_FETCH_TIMEOUT_MS)),
      ]);

      if (result === LOCATION_TIMEOUT) {
        setError(toError("timeout", new Error("Getting your location took too long.")));
        setStatus("error");
        return null;
      }

      const address = await reverseGeocode(result.coords.latitude, result.coords.longitude);
      const nextLocation = createCurrentLocation(result.coords.latitude, result.coords.longitude, result.coords.accuracy, result.timestamp, address);
      setLocation(nextLocation);
      setError(null);
      setStatus("completed");
      return nextLocation;
    } catch (nextError) {
      setError(toError("position_unavailable", nextError));
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
