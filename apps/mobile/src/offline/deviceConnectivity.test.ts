// Mories Deo Hutapea,S.E.,S.Kom

import { describe, expect, it, vi } from "vitest";
import * as Network from "expo-network";
import { isDeviceConnected } from "./deviceConnectivity";

vi.mock("expo-network", () => ({
  NetworkStateType: { NONE: "NONE", UNKNOWN: "UNKNOWN", WIFI: "WIFI" },
  addNetworkStateListener: vi.fn(),
  getNetworkStateAsync: vi.fn(),
}));

describe("device connectivity", () => {
  it("reports disconnected only when the operating system confirms no active network", () => {
    expect(isDeviceConnected({ type: Network.NetworkStateType.NONE, isConnected: false })).toBe(false);
    expect(isDeviceConnected({ type: Network.NetworkStateType.UNKNOWN, isConnected: false })).toBe(true);
    expect(isDeviceConnected({ type: Network.NetworkStateType.WIFI, isConnected: true })).toBe(true);
    expect(isDeviceConnected({ isConnected: false })).toBe(true);
    expect(isDeviceConnected({})).toBe(true);
  });
});
