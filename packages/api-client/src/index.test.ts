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

  it("reports request and response metadata without inspecting credentials or payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    const onRequestLog = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({
      baseUrl: "http://localhost:8080/api/v1",
      getToken: async () => "secret-token",
      getOrganizationId: () => "tenant-id",
      getLanguage: () => "id",
      onRequestLog,
    });

    await client.me();

    expect(onRequestLog).toHaveBeenNthCalledWith(1, { phase: "REQUEST", method: "GET", url: "http://localhost:8080/api/v1/me" });
    expect(onRequestLog).toHaveBeenNthCalledWith(2, expect.objectContaining({ phase: "RESPONSE", method: "GET", url: "http://localhost:8080/api/v1/me", status: 200, durationMs: expect.any(Number) }));
    expect(JSON.stringify(onRequestLog.mock.calls)).not.toContain("secret-token");
  });

  it("revokes a supplied active token through the authenticated logout endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "current-token", getOrganizationId: () => null, getLanguage: () => "id" });

    await client.logout("token-to-revoke");

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/auth/logout", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer token-to-revoke" }) }));
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

  it("creates a staff account with its optional username", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => "tenant-id", getLanguage: () => "id" });

    await client.createTenantUser({ displayName: "Guru Baru", username: "guru.baru", email: "guru@tenant.test", password: "123123", role: "STAFF" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/tenant-users", expect.objectContaining({ method: "POST", body: JSON.stringify({ displayName: "Guru Baru", username: "guru.baru", email: "guru@tenant.test", password: "123123", role: "STAFF" }) }));
  });

  it("updates a staff account through the tenant-scoped endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => "tenant-id", getLanguage: () => "id" });
    const input = { displayName: "Guru Diperbarui", email: "guru@tenant.test", username: "guru.baru", branchId: "branch-id", canManageChildPrograms: true, canManageDevelopmentCategories: false };

    await client.updateTenantUser("staff-id", input);

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/tenant-users/staff-id", expect.objectContaining({ method: "PATCH", body: JSON.stringify(input) }));
  });

  it("checks whether the signed-in identity already has an account", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ exists: false, email: null, phoneNumber: "+6281234567890" }) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => null, getLanguage: () => "id" });

    await expect(client.identityCheck()).resolves.toEqual({ exists: false, email: null, phoneNumber: "+6281234567890" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/auth/identity-check", expect.anything());
  });

  it("updates the signed-in Parent family profile without an organization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => null, getLanguage: () => "id" });
    const input = { husbandOccupation: "PNS" as const, husbandIncomeRange: "THREE_TO_FIVE_MILLION" as const, wifeDateOfBirth: "1994-06-10" };

    await client.updateParentFamilyProfile(input);

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/parent-family-profile", expect.objectContaining({ method: "PUT", body: JSON.stringify(input), headers: expect.not.objectContaining({ "X-Organization-Id": expect.anything() }) }));
  });

  it("lists and creates Platform-managed institution types", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => null, getLanguage: () => "id" });

    await client.institutionTypes();
    await client.createInstitutionType({ name: "Taman Bermain", parentOccupationVisible: true, parentIncomeRangeVisible: false });
    await client.updateInstitutionType("TAMAN_BERMAIN", { name: "Kelompok Bermain", parentOccupationVisible: true, parentIncomeRangeVisible: true });
    await client.deleteInstitutionType("TAMAN_BERMAIN");

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/platform/institution-types", expect.anything());
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/platform/institution-types", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Taman Bermain", parentOccupationVisible: true, parentIncomeRangeVisible: false }) }));
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/platform/institution-types/TAMAN_BERMAIN", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Kelompok Bermain", parentOccupationVisible: true, parentIncomeRangeVisible: true }) }));
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/platform/institution-types/TAMAN_BERMAIN", expect.objectContaining({ method: "DELETE" }));
  });

  it("loads the Platform Admin tenant-readiness dashboard", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ readyCount: 1, needsAttentionCount: 1, tenants: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => null, getLanguage: () => "id" });

    await client.tenantReadiness();

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/platform/tenant-readiness", expect.anything());
  });

  it("updates a native device push-notification mute preference", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => "tenant-id", getLanguage: () => "id" });

    await client.updateDeviceNotificationPreference({ installationId: "installation-id", muteDuration: "ONE_HOUR" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/device-notification-preference", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ installationId: "installation-id", muteDuration: "ONE_HOUR" }) }));
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

  it("creates and decides a child absence request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => "tenant-id", getLanguage: () => "id" });

    await client.createChildAbsenceRequest({ childId: "child-id", purpose: "SICK", startDate: "2026-07-28", endDate: "2026-07-29" });
    await client.decideChildAbsenceRequest("request-id", { approved: false, rejectionReason: "Tanggal tidak sesuai" });
    await client.cancelChildAbsenceRequest("request-id");
    await client.childAbsenceRequests({ childId: "child-id" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/child-absence-requests", expect.objectContaining({ method: "POST", body: JSON.stringify({ childId: "child-id", purpose: "SICK", startDate: "2026-07-28", endDate: "2026-07-29" }) }));
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/child-absence-requests/request-id/decision", expect.objectContaining({ method: "POST", body: JSON.stringify({ approved: false, rejectionReason: "Tanggal tidak sesuai" }) }));
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/child-absence-requests/request-id/cancel", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/child-absence-requests?childId=child-id", expect.anything());
  });

  it("requests server-authorized placement options for a child", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => "tenant-id", getLanguage: () => "id" });

    await client.childPlacementOptions("child-id");

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/children/child-id/placement-options", expect.anything());
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

  it("sends the curriculum-program search query to the tenant endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => "tenant-id", getLanguage: () => "id" });

    await client.curriculumPrograms("  fondasi anak  ");

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/curriculum-programs?search=fondasi+anak", expect.anything());
  });

  it("includes archived curriculum programs only when requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => "tenant-id", getLanguage: () => "id" });

    await client.curriculumPrograms(undefined, true);

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/curriculum-programs?includeArchived=true", expect.anything());
  });

  it("updates a curriculum program with its Goal template links", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => "tenant-id", getLanguage: () => "id" });

    await client.updateCurriculumProgram("program-id", { name: "Bahasa awal", description: "", developmentProgramIds: ["goal-id"] });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/curriculum-programs/program-id", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Bahasa awal", description: "", developmentProgramIds: ["goal-id"] }) }));
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

  it("filters Development Programs by the selected curriculum program", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => "tenant-id", getLanguage: () => "id" });

    await client.developmentPrograms("bahasa", "curriculum-id");

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/development-programs?search=bahasa&curriculumProgramId=curriculum-id", expect.anything());
  });

  it("assigns a child Goal with its curriculum-program source", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => "tenant-id", getLanguage: () => "id" });

    await client.assignChildGoal("child-id", { curriculumProgramId: "curriculum-id", programId: "development-program-id" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/children/child-id/goals", expect.objectContaining({ method: "POST", body: JSON.stringify({ curriculumProgramId: "curriculum-id", programId: "development-program-id" }) }));
  });

  it("creates and reads a development entry photo through the scoped child endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => "tenant-id", getLanguage: () => "id" });
    const input = { category: "category-id", title: "Melukis", content: "Menggambar dengan krayon.", photo: { contentType: "image/jpeg" as const, dataBase64: "/9j/" } };

    await client.createDevelopmentEntry("child-id", input);
    await client.developmentEntryPhoto("child-id", "entry-id");

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/children/child-id/development-entries", expect.objectContaining({ method: "POST", body: JSON.stringify(input) }));
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/children/child-id/development-entries/entry-id/photo", expect.anything());
  });

  it("creates and decides Staff leave requests through tenant-scoped endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.test/v1", getToken: async () => "token", getOrganizationId: () => "tenant-id", getLanguage: () => "id" });
    const input = { type: "LEAVE" as const, startsOn: "2026-07-29", endsOn: "2026-07-30", reason: "Keperluan keluarga" };

    await client.createStaffLeaveRequest(input);
    await client.decideStaffLeaveRequest("request-id", { approved: false, rejectionReason: "Jadwal belum dapat diganti" });
    await client.staffLeaveRequestEvidence("request-id");

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/staff-leave-requests", expect.objectContaining({ method: "POST", body: JSON.stringify(input) }));
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/staff-leave-requests/request-id/approval", expect.objectContaining({ method: "POST", body: JSON.stringify({ approved: false, rejectionReason: "Jadwal belum dapat diganti" }) }));
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/staff-leave-requests/request-id/evidence", expect.anything());
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
