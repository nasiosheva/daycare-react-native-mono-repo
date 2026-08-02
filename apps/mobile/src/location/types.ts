export const LOCATION_FETCH_TIMEOUT_MS = 15_000;

export type CurrentLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
  address: string | null;
};

export type LocationStatus = "idle" | "requesting_permission" | "locating" | "completed" | "error" | "unsupported";

export type LocationErrorCode = "permission_denied" | "position_unavailable" | "timeout" | "location_failed" | "unsupported";

export type LocationError = {
  code: LocationErrorCode;
  message: string;
};

export type LocationController = {
  status: LocationStatus;
  location: CurrentLocation | null;
  error: LocationError | null;
  getCurrentLocation: () => Promise<CurrentLocation | null>;
  clear: () => void;
};

export function createCurrentLocation(latitude: number, longitude: number, accuracy: number | null, timestamp: number, address: string | null): CurrentLocation {
  return { latitude, longitude, accuracy, timestamp, address };
}

const WEB_GEOLOCATION_ERROR_CODES: Record<number, LocationErrorCode> = {
  1: "permission_denied",
  2: "position_unavailable",
  3: "timeout",
};

export function mapWebGeolocationErrorCode(code: number): LocationErrorCode {
  return WEB_GEOLOCATION_ERROR_CODES[code] ?? "location_failed";
}
