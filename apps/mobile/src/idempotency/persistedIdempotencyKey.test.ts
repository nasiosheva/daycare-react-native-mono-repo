// Mories Deo Hutapea,S.E.,S.Kom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOrCreateIdempotencyKey, removeIdempotencyKey } from "./persistedIdempotencyKey";

const secureStore = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
const platform = vi.hoisted(() => ({ OS: "android" }));

vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("expo-secure-store", () => secureStore);

describe("persisted idempotency keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platform.OS = "android";
    secureStore.getItemAsync.mockResolvedValue(null);
    secureStore.setItemAsync.mockResolvedValue(undefined);
    secureStore.deleteItemAsync.mockResolvedValue(undefined);
  });

  it("maps booking storage keys to SecureStore-safe keys consistently", async () => {
    const logicalKey = "parent-service-purchase:tenant-1:child-1:plan-1:2026-10-20,2026-10-21:";

    const idempotencyKey = await getOrCreateIdempotencyKey(logicalKey);
    await removeIdempotencyKey(logicalKey);

    const secureKey = secureStore.getItemAsync.mock.calls[0]?.[0];
    expect(secureKey).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(secureKey, idempotencyKey);
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(secureKey);
  });

  it("reuses an existing idempotency value from its mapped storage key", async () => {
    secureStore.getItemAsync.mockResolvedValueOnce("stable-idempotency-value");

    await expect(getOrCreateIdempotencyKey("parent-service-booking:tenant:entitlement:2026-10-20,2026-10-21"))
      .resolves.toBe("stable-idempotency-value");

    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
    expect(secureStore.getItemAsync.mock.calls[0]?.[0]).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it("preserves existing iOS SecureStore keys for safe retries", async () => {
    platform.OS = "ios";
    const logicalKey = "parent-service-purchase:tenant-1:child-1:plan-1:2026-10-20,2026-10-21:";
    secureStore.getItemAsync.mockResolvedValueOnce("existing-ios-idempotency-value");

    await expect(getOrCreateIdempotencyKey(logicalKey)).resolves.toBe("existing-ios-idempotency-value");
    await removeIdempotencyKey(logicalKey);

    expect(secureStore.getItemAsync).toHaveBeenCalledWith(logicalKey);
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(logicalKey);
  });
});
