import { describe, expect, it } from "vitest";
import { createCurrentLocation, mapWebGeolocationErrorCode } from "./types";

describe("createCurrentLocation", () => {
  it("returns the coordinate and address shape", () => {
    const location = createCurrentLocation(-6.2, 106.8, 12, 1_753_000_000_000, "Jl. Sudirman, Jakarta");

    expect(location).toEqual({
      latitude: -6.2,
      longitude: 106.8,
      accuracy: 12,
      timestamp: 1_753_000_000_000,
      address: "Jl. Sudirman, Jakarta",
    });
  });

  it("allows null accuracy and null address", () => {
    const location = createCurrentLocation(-6.2, 106.8, null, 1_753_000_000_000, null);

    expect(location.accuracy).toBeNull();
    expect(location.address).toBeNull();
  });
});

describe("mapWebGeolocationErrorCode", () => {
  it("maps the standard GeolocationPositionError codes", () => {
    expect(mapWebGeolocationErrorCode(1)).toBe("permission_denied");
    expect(mapWebGeolocationErrorCode(2)).toBe("position_unavailable");
    expect(mapWebGeolocationErrorCode(3)).toBe("timeout");
  });

  it("falls back to location_failed for an unrecognized code", () => {
    expect(mapWebGeolocationErrorCode(0)).toBe("location_failed");
    expect(mapWebGeolocationErrorCode(99)).toBe("location_failed");
  });
});
