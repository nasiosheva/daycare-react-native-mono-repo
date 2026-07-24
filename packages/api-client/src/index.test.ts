import { describe, expect, it, vi } from "vitest";
import { API_REQUEST_TIMEOUT_MS, ApiClient, ApiNetworkError, ApiTimeoutError, realtimeUrl } from "./index";

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

  it("stops an unreachable request after the API timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));
    const client = new ApiClient({ baseUrl: "http://192.168.1.5:8080/api/v1", getToken: async () => "local-token", getOrganizationId: () => null, getLanguage: () => "id" });

    const rejection = expect(client.me()).rejects.toBeInstanceOf(ApiTimeoutError);
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);

    await rejection;
    vi.useRealTimers();
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

  it("sends one branch filter to every branch-scoped operational list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => "tenant-id", getLanguage: () => "id" });

    await Promise.all([
      client.tenantUsers({ branchId: "branch-id" }),
      client.classrooms({ branchId: "branch-id" }),
      client.pendingParentEnrollments({ branchId: "branch-id" }),
      client.pendingBookings({ branchId: "branch-id" }),
      client.entitlements({ branchId: "branch-id" }),
      client.invoices({ branchId: "branch-id" }),
    ]);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining([
      "https://api.example.test/v1/tenant-users?branchId=branch-id",
      "https://api.example.test/v1/classrooms?branchId=branch-id",
      "https://api.example.test/v1/parent-enrollment/pending-approval?branchId=branch-id",
      "https://api.example.test/v1/bookings/pending-approval?branchId=branch-id",
      "https://api.example.test/v1/service-entitlements?branchId=branch-id",
      "https://api.example.test/v1/invoices?branchId=branch-id",
    ]));
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

    await client.recordGoalCheckIn("goal-id", "2026-07-23", "indicator-id", "YES");

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/child-goals/goal-id/check-ins/2026-07-23", expect.objectContaining({ method: "PUT", body: JSON.stringify({ indicatorId: "indicator-id", outcome: "YES" }) }));
  });

  it("downloads a backend-built child report as a binary file", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers({ "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=children.pdf" }), arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => "tenant-id", getLanguage: () => "id" });

    const report = await client.downloadChildrenReport("PDF", { branchId: "branch-id" });

    expect(report).toEqual({ fileName: "children.pdf", contentType: "application/pdf", dataBase64: "AQID" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/reports/children/export?format=PDF&branchId=branch-id", expect.anything());
  });

  it("derives a secure websocket endpoint from the API URL", () => {
    expect(realtimeUrl("https://api.example.test/api/v1")).toBe("wss://api.example.test/api/v1/realtime");
    expect(realtimeUrl("http://localhost:8080/api/v1", "ws://realtime.example.test/socket")).toBe("ws://realtime.example.test/socket");
  });
});
