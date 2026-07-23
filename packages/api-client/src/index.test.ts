import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiNetworkError, realtimeUrl } from "./index";

describe("ApiClient", () => {
  it("normalizes a transport failure into ApiNetworkError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network request failed")));
    const client = new ApiClient({
      baseUrl: "http://192.168.1.5:8080/api/v1",
      getToken: async () => "local-token",
      getOrganizationId: () => null,
      getLanguage: () => "id",
    });

    await expect(client.createTenant({
      tenantName: "Umur Emas",
      branchName: "Utama",
      institutionTypes: ["DAYCARE"],
      subscriptionPlan: "STARTER",
      trialMonths: 1,
      staffAdminName: "Admin Tenant",
      staffAdminEmail: "admin@tenant.test",
      staffAdminPassword: "123123",
    })).rejects.toBeInstanceOf(ApiNetworkError);
  });

  it("updates a Staff child-program permission through the tenant-scoped endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({
      baseUrl: "https://api.example.test/v1",
      getToken: async () => "token",
      getOrganizationId: () => "tenant-id",
      getLanguage: () => "id",
    });

    await client.updateTenantUserChildProgramPermission("staff-id", true);

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/tenant-users/staff-id/child-program-permission", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ canManageChildPrograms: true }) }));
  });

  it("sends the selected child hierarchy filters to the tenant endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({
      baseUrl: "https://api.example.test/v1",
      getToken: async () => "token",
      getOrganizationId: () => "tenant-id",
      getLanguage: () => "id",
    });

    await client.children({ branchId: "branch-id", learningLevelId: "level-id", classroomId: "classroom-id" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/children?branchId=branch-id&learningLevelId=level-id&classroomId=classroom-id", expect.anything());
  });

  it("records a daily child-goal outcome through the tenant-scoped endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({
      baseUrl: "https://api.example.test/v1",
      getToken: async () => "token",
      getOrganizationId: () => "tenant-id",
      getLanguage: () => "id",
    });

    await client.recordGoalCheckIn("goal-id", "2026-07-23", "YES");

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/child-goals/goal-id/check-ins/2026-07-23", expect.objectContaining({ method: "PUT", body: JSON.stringify({ outcome: "YES" }) }));
  });

  it("derives a secure websocket endpoint from the API URL", () => {
    expect(realtimeUrl("https://api.example.test/api/v1")).toBe("wss://api.example.test/api/v1/realtime");
    expect(realtimeUrl("http://localhost:8080/api/v1", "ws://realtime.example.test/socket")).toBe("ws://realtime.example.test/socket");
  });
});
