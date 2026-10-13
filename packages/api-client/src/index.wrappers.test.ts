// Mories Deo Hutapea,S.E.,S.Kom
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "./index";

function createHarness() {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ "Content-Type": "application/pdf" }),
    json: async () => ({}),
    arrayBuffer: async () => new ArrayBuffer(0),
  } as Response);
  vi.stubGlobal("fetch", fetchMock);
  const client = new ApiClient({
    baseUrl: "https://api.example.test/api/v1",
    getToken: async () => "test-token",
    getOrganizationId: () => "active-tenant",
    getLanguage: () => "id",
  });
  return { client, fetchMock };
}

function requests(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  return fetchMock.mock.calls.map(([input, init]) => ({
    url: String(input),
    method: init?.method ?? "GET",
    body: init?.body,
    headers: new Headers(init?.headers),
  }));
}

describe("ApiClient API wrappers", () => {
  it("maps Parent screening and Platform screening-catalog workflows to their endpoints", async () => {
    const { client, fetchMock } = createHarness();
    const profile = { subjectName: "Anak", dateOfBirth: "2024-01-01", prematureBirth: false };
    const answers = [{ questionId: "question-1", answerCode: "YES", contextCode: "HOME", note: "Teramati" }];
    const template = { name: "Screening awal", locale: "id" };

    await client.parentFamilyProfile();
    await client.screeningProfiles();
    await client.screeningLinkedChildren();
    await client.createScreeningProfile(profile);
    await client.updateScreeningProfile("profile-1", profile);
    await client.archiveScreeningProfile("profile-1");
    await client.screeningTemplates();
    await client.screeningSessions();
    await client.startScreeningSession({ profileId: "profile-1", templateId: "template-1", locale: "id", consentVersion: "screening-v1", observationLanguage: "id", organizationId: "tenant-1", childId: "child-1" });
    await client.screeningQuestionnaire("session-1");
    await client.screeningAnswers("session-1");
    await client.saveScreeningAnswers("session-1", answers);
    await client.completeScreening("session-1");
    await client.screeningResult("session-1");
    await client.downloadScreeningResult("session-1");
    await client.screeningCatalogTemplates();
    await client.screeningSeedBatches();
    await client.previewScreeningSeedBatch("batch/one");
    await client.applyScreeningSeedBatch("batch-1");
    await client.screeningCatalogTemplate("template-1");
    await client.createScreeningCatalogTemplate(template);
    await client.updateScreeningCatalogTemplate("template-1", 3, template);
    await client.validateScreeningCatalogTemplate("template-1");
    await client.publishScreeningCatalogTemplate("template-1");
    await client.reviewScreeningCatalogTemplate("template-1", true);
    await client.retireScreeningCatalogTemplate("template-1");
    await client.deleteScreeningCatalogTemplate("template-1");

    const calls = requests(fetchMock);
    expect(calls.map(({ url, method }) => [url, method])).toEqual([
      ["https://api.example.test/api/v1/parent-family-profile", "GET"],
      ["https://api.example.test/api/v1/parent/screening/profiles", "GET"],
      ["https://api.example.test/api/v1/parent/screening/linked-children", "GET"],
      ["https://api.example.test/api/v1/parent/screening/profiles", "POST"],
      ["https://api.example.test/api/v1/parent/screening/profiles/profile-1", "PATCH"],
      ["https://api.example.test/api/v1/parent/screening/profiles/profile-1", "DELETE"],
      ["https://api.example.test/api/v1/parent/screening/templates", "GET"],
      ["https://api.example.test/api/v1/parent/screening/sessions", "GET"],
      ["https://api.example.test/api/v1/parent/screening/sessions", "POST"],
      ["https://api.example.test/api/v1/parent/screening/sessions/session-1/questionnaire", "GET"],
      ["https://api.example.test/api/v1/parent/screening/sessions/session-1/answers", "GET"],
      ["https://api.example.test/api/v1/parent/screening/sessions/session-1/answers", "PUT"],
      ["https://api.example.test/api/v1/parent/screening/sessions/session-1/complete", "POST"],
      ["https://api.example.test/api/v1/parent/screening/sessions/session-1/result", "GET"],
      ["https://api.example.test/api/v1/parent/screening/sessions/session-1/result.pdf", "GET"],
      ["https://api.example.test/api/v1/platform/screening/templates", "GET"],
      ["https://api.example.test/api/v1/platform/screening/seed-batches", "GET"],
      ["https://api.example.test/api/v1/platform/screening/seed-batches/batch%2Fone/preview", "POST"],
      ["https://api.example.test/api/v1/platform/screening/seed-batches/batch-1/apply", "POST"],
      ["https://api.example.test/api/v1/platform/screening/templates/template-1", "GET"],
      ["https://api.example.test/api/v1/platform/screening/templates", "POST"],
      ["https://api.example.test/api/v1/platform/screening/templates/template-1?expectedRevision=3", "PUT"],
      ["https://api.example.test/api/v1/platform/screening/templates/template-1/validate", "GET"],
      ["https://api.example.test/api/v1/platform/screening/templates/template-1/publish", "POST"],
      ["https://api.example.test/api/v1/platform/screening/templates/template-1/review", "POST"],
      ["https://api.example.test/api/v1/platform/screening/templates/template-1/retire", "POST"],
      ["https://api.example.test/api/v1/platform/screening/templates/template-1", "DELETE"],
    ]);
    expect(calls[3]!.body).toBe(JSON.stringify(profile));
    expect(calls[11]!.body).toBe(JSON.stringify({ answers }));
    expect(calls[17]!.headers.get("X-Organization-Id")).toBe("active-tenant");
    expect(calls[18]!.body).toBe(JSON.stringify({ confirmation: "APPLY" }));
    expect(calls[21]!.body).toBe(JSON.stringify(template));
  });

  it("maps Platform Admin tenant, branch, and subscription actions", async () => {
    const { client, fetchMock } = createHarness();
    const createTenant = { tenantName: "Lembaga", branchName: "Utama", institutionTypes: ["DAYCARE" as const], subscriptionPlan: "STARTER" as const, staffAdminName: "Admin", staffAdminEmail: "admin@example.test", staffAdminPassword: "safe-password" };
    const updateTenant = { tenantName: "Lembaga Baru", institutionTypes: ["DAYCARE" as const], subscriptionPlan: "PREMIUM" as const, monthlyFee: 100000 };

    await client.tenants("  nama lembaga  ");
    await client.platformParents("  parent@example.test ");
    await client.resetPlatformParentPassword("parent-1", "new-password");
    await client.tenantReadiness();
    await client.institutionTypes();
    await client.tenant("tenant-1");
    await client.createTenant(createTenant);
    await client.updateTenant("tenant-1", updateTenant);
    await client.createTenantStaffAdmin("tenant-1", { displayName: "Admin Dua", username: "admin.dua", email: "dua@example.test", password: "safe-password" });
    await client.updateTenantStaffAdmin("tenant-1", "membership-1", { displayName: "Admin Baru" });
    await client.removeTenantStaffAdmin("tenant-1", "membership-1");
    await client.resetTenantStaffAdminPassword("tenant-1", "membership-1", "new-password");
    await client.renewTenantSubscription("tenant-1", 200000);
    await client.setTenantSubscriptionStatus("tenant-1", "SUSPENDED");
    await client.markTenantPaymentPaid("tenant-1", "payment-1");
    await client.voidTenantPayment("tenant-1", "payment-1");
    await client.refreshTenantStaffAdminInvitation("tenant-1");
    await client.cancelTenantStaffAdminInvitation("tenant-1");
    const branch = { name: "Cabang Utama", timezone: "Asia/Jakarta", fullAddress: "Jalan Merdeka", googleMapsUrl: "https://maps.example.test" };
    const operatingHours = { hours: [], tiers: [], autoOvertimeBillingEnabled: true, overtimeGraceMinutes: 10 };
    const overtime = { childId: "child-1", operationalDate: "2026-10-13", pickedUpAt: "2026-10-13T17:15:00+07:00", dueDate: "2026-10-20" };
    await client.branches("  cabang  ");
    await client.createBranch({ name: "Cabang Utama", fullAddress: "Jalan Merdeka", googleMapsUrl: "https://maps.example.test" });
    await client.updateBranch("branch-1", branch);
    await client.setPrimaryBranch("branch-1");
    await client.archiveBranch("branch-1");
    await client.branchOperatingHours("branch-1");
    await client.updateBranchOperatingHours("branch-1", operatingHours);
    await client.serviceExpiryReminderSettings();
    await client.updateServiceExpiryReminderSettings([7, 3, 1]);
    await client.parentOperatingHours();
    await client.parentOperatingHoursAllTenants();
    await client.overtimeCharges();
    await client.createOvertimeCharge(overtime);
    await client.updateOvertimeCharge("charge-1", overtime);
    await client.voidOvertimeCharge("charge-1");

    const calls = requests(fetchMock);
    expect(calls.map(({ url, method }) => [url, method])).toEqual([
      ["https://api.example.test/api/v1/platform/tenants?search=nama+lembaga", "GET"],
      ["https://api.example.test/api/v1/platform/parents?search=parent%40example.test", "GET"],
      ["https://api.example.test/api/v1/platform/parents/parent-1/password", "POST"],
      ["https://api.example.test/api/v1/platform/tenant-readiness", "GET"],
      ["https://api.example.test/api/v1/platform/institution-types", "GET"],
      ["https://api.example.test/api/v1/platform/tenants/tenant-1", "GET"],
      ["https://api.example.test/api/v1/platform/tenants", "POST"],
      ["https://api.example.test/api/v1/platform/tenants/tenant-1", "PATCH"],
      ["https://api.example.test/api/v1/platform/tenants/tenant-1/staff-admins", "POST"],
      ["https://api.example.test/api/v1/platform/tenants/tenant-1/staff-admins/membership-1", "PATCH"],
      ["https://api.example.test/api/v1/platform/tenants/tenant-1/staff-admins/membership-1/remove", "POST"],
      ["https://api.example.test/api/v1/platform/tenants/tenant-1/staff-admins/membership-1/password", "POST"],
      ["https://api.example.test/api/v1/platform/tenants/tenant-1/subscription/renew", "POST"],
      ["https://api.example.test/api/v1/platform/tenants/tenant-1/subscription/SUSPENDED", "POST"],
      ["https://api.example.test/api/v1/platform/tenants/tenant-1/payments/payment-1/mark-paid", "POST"],
      ["https://api.example.test/api/v1/platform/tenants/tenant-1/payments/payment-1/void", "POST"],
      ["https://api.example.test/api/v1/platform/tenants/tenant-1/staff-admin-invitation/refresh", "POST"],
      ["https://api.example.test/api/v1/platform/tenants/tenant-1/staff-admin-invitation/cancel", "POST"],
      ["https://api.example.test/api/v1/branches?search=cabang", "GET"],
      ["https://api.example.test/api/v1/branches", "POST"],
      ["https://api.example.test/api/v1/branches/branch-1", "PATCH"],
      ["https://api.example.test/api/v1/branches/branch-1/primary", "POST"],
      ["https://api.example.test/api/v1/branches/branch-1/archive", "POST"],
      ["https://api.example.test/api/v1/branches/branch-1/operating-hours", "GET"],
      ["https://api.example.test/api/v1/branches/branch-1/operating-hours", "PUT"],
      ["https://api.example.test/api/v1/service-expiry-reminder-settings", "GET"],
      ["https://api.example.test/api/v1/service-expiry-reminder-settings", "PUT"],
      ["https://api.example.test/api/v1/parent/operating-hours", "GET"],
      ["https://api.example.test/api/v1/parent/operating-hours/all-tenants", "GET"],
      ["https://api.example.test/api/v1/overtime-charges", "GET"],
      ["https://api.example.test/api/v1/overtime-charges", "POST"],
      ["https://api.example.test/api/v1/overtime-charges/charge-1", "PATCH"],
      ["https://api.example.test/api/v1/overtime-charges/charge-1/void", "POST"],
    ]);
    expect(calls[6]!.body).toBe(JSON.stringify(createTenant));
    expect(calls[7]!.body).toBe(JSON.stringify(updateTenant));
    expect(calls[12]!.body).toBe(JSON.stringify({ monthlyFee: 200000 }));
    expect(calls[20]!.body).toBe(JSON.stringify(branch));
    expect(calls[24]!.body).toBe(JSON.stringify(operatingHours));
    expect(calls[26]!.body).toBe(JSON.stringify({ leadDays: [7, 3, 1] }));
    expect(calls[31]!.body).toBe(JSON.stringify(overtime));
  });

  it("maps child safety, consent, care-log, and handover calls with tenant scope", async () => {
    const { client, fetchMock } = createHarness();
    const organizationId = "source-tenant";
    const record = { allergies: "Kacang", emergencyInstructions: "Hubungi wali" };
    const incident = { severity: "MODERATE" as const, category: "INJURY" as const, description: "Terjatuh saat bermain", occurredAt: "2026-10-13T09:00:00+07:00" };
    const consent = { purpose: "OUTING" as const, title: "Kegiatan luar", content: "Izin kegiatan" };
    const careLog = { type: "MEAL" as const, occurredAt: "2026-10-13T10:00:00+07:00", mealType: "SNACK" as const, clientMutationId: "care-log-1" };

    await client.parentChildProfile("child-1", organizationId);
    await client.pickupAuthorizations("child-1", organizationId);
    await client.createPickupAuthorization("child-1", { pickupPersonName: "Budi", relationship: "Paman", verificationMethod: "PHOTO_ID" }, organizationId);
    await client.activatePickupAuthorization("child-1", "pickup-1", organizationId);
    await client.revokePickupAuthorization("child-1", "pickup-1", "Tidak berlaku", organizationId);
    await client.emergencyContacts("child-1", organizationId);
    await client.createEmergencyContact("child-1", { name: "Budi", relationship: "Paman", phoneNumber: "+628123456789" }, organizationId);
    await client.removeEmergencyContact("child-1", "contact-1", organizationId);
    await client.revokeEmergencyContact("child-1", "contact-1", "Nomor berubah", organizationId);
    await client.consentDefinitions();
    await client.managedConsentDefinitions();
    await client.createConsentDefinition(consent);
    await client.reviseConsentDefinition("consent-1", { title: "Izin kegiatan luar", content: "Revisi", expectedRevision: 1 });
    await client.setConsentDefinitionActive("consent-1", false, 2);
    await client.childConsents("child-1", organizationId);
    await client.decideConsent("child-1", "consent-1", true, organizationId);
    await client.withdrawConsent("child-1", "consent-1", organizationId);
    await client.childHealthRecord("child-1", organizationId);
    await client.upsertChildHealthRecord("child-1", record, organizationId);
    await client.childHealthNotes("child-1", organizationId);
    await client.createChildHealthNote("child-1", { note: "Kondisi baik" }, organizationId);
    await client.childIncidentReports("child-1", organizationId);
    await client.createChildIncidentReport("child-1", incident, organizationId);
    await client.acknowledgeChildIncidentReport("child-1", "incident-1", organizationId);
    await client.childIncidentReportPhoto("child-1", "incident-1", organizationId);
    await client.updateChildIncidentLifecycle("child-1", "incident-1", { incidentStatus: "IN_PROGRESS", guardianContactStatus: "ATTEMPTED" }, organizationId);
    await client.childIncidentFollowUps("child-1", "incident-1", organizationId);
    await client.createChildIncidentFollowUp("child-1", "incident-1", { title: "Pantau kondisi" }, organizationId);
    await client.completeChildIncidentFollowUp("child-1", "incident-1", "follow-up-1", organizationId);
    await client.childCareLogs("child-1", organizationId);
    await client.createChildCareLog("child-1", careLog, organizationId);
    await client.childHandovers("child-1", organizationId);
    await client.childHandoverRecipients("child-1", organizationId);
    await client.createChildHandover("child-1", { recipientUserId: "staff-2", summary: "Perlu observasi makan" }, organizationId);
    await client.acknowledgeChildHandover("child-1", "handover-1", organizationId);
    await client.developmentEntries("child-1", organizationId);
    await client.developmentEntryPhoto("child-1", "entry-1", organizationId);
    await client.developmentEntryMedia("child-1", "entry-1", "media-1", organizationId);

    const calls = requests(fetchMock);
    expect(calls).toHaveLength(38);
    expect(calls.every(({ headers }) => [organizationId, "active-tenant"].includes(headers.get("X-Organization-Id") ?? ""))).toBe(true);
    expect(calls.map(({ url, method }) => [url.replace("https://api.example.test/api/v1", ""), method])).toEqual(expect.arrayContaining([
      ["/parent/children/child-1/profile", "GET"],
      ["/children/child-1/pickup-authorizations/pickup-1/revoke", "POST"],
      ["/children/child-1/emergency-contacts/contact-1/revoke", "POST"],
      ["/children/child-1/consents/consent-1/withdraw", "POST"],
      ["/children/child-1/health-record", "PUT"],
      ["/children/child-1/development-entries/entry-1/media/media-1", "GET"],
      ["/children/child-1/incident-reports/incident-1/lifecycle", "PATCH"],
      ["/children/child-1/incident-reports/incident-1/follow-ups/follow-up-1/complete", "POST"],
      ["/children/child-1/care-logs", "POST"],
      ["/children/child-1/handovers/handover-1/acknowledge", "POST"],
    ]));
    expect(calls.find(({ url, method }) => url.endsWith("/care-logs") && method === "POST")?.body).toBe(JSON.stringify({ type: "MEAL", occurredAt: careLog.occurredAt, mealType: "SNACK" }));
    expect(calls.find(({ url, method }) => url.endsWith("/care-logs") && method === "POST")?.headers.get("Idempotency-Key")).toBe("care-log-1");
  });

  it("encodes optional branch/search filters and report export parameters", async () => {
    const { client, fetchMock } = createHarness();

    await client.branches();
    await client.branches("   ");
    await client.branches("  Cabang Timur ");
    await client.pendingBookings();
    await client.pendingBookings({ branchId: "branch-1" }, "  Anak ");
    await client.pendingBookings({ branchId: "branch-2" }, "   ");
    await client.bookings({ branchId: "branch-3" });
    await client.downloadChildrenReport("XLSX", {
      branchId: "branch-1",
      learningLevelId: "level-1",
      classroomId: "classroom-1",
      guardianStatus: "LINKED",
    });
    const pdfReport = await client.downloadChildrenReport("PDF");

    const calls = requests(fetchMock);
    expect(calls.map(({ url }) => url.replace("https://api.example.test/api/v1", ""))).toEqual([
      "/branches",
      "/branches",
      "/branches?search=Cabang+Timur",
      "/bookings/pending-approval",
      "/bookings/pending-approval?branchId=branch-1&search=Anak",
      "/bookings/pending-approval?branchId=branch-2",
      "/bookings?branchId=branch-3",
      "/reports/children/export?format=XLSX&branchId=branch-1&learningLevelId=level-1&classroomId=classroom-1&guardianStatus=LINKED",
      "/reports/children/export?format=PDF",
    ]);
    expect(calls[7]!.headers.get("Accept")).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(pdfReport).toMatchObject({ fileName: "report", contentType: "application/pdf" });
  });

  it("maps parent enrollment, payment instructions, and private tutoring workflows", async () => {
    const { client, fetchMock } = createHarness();
    const enrollment = { organizationId: "tenant-1", branchId: "branch-1", childId: "child-1", servicePlanId: "plan-1" };
    const instruction = { bankName: "Bank", accountName: "Lembaga", accountNumber: "123" };
    const tutoringService = { name: "Calistung", description: "Belajar membaca", active: true };
    const tutor = { displayName: "Tutor", bio: "Pengajar", active: true };

    await client.parentEnrollmentCatalog("  daycare  ");
    await client.parentEnrollments();
    await client.checkoutParentEnrollment({ enrollments: [enrollment] } as never);
    await client.transferChildEnrollment({ childId: "child-1", fromOrganizationId: "tenant-1", toOrganizationId: "tenant-2" } as never);
    await client.pendingParentEnrollments({ branchId: "branch-1" }, " Anak ");
    await client.approveParentEnrollment("enrollment-1", true);
    await client.retryParentEnrollment("enrollment-1", ["2026-10-20"]);
    await client.cancelParentEnrollment("enrollment-1");
    await client.paymentInstructions("tenant-1");
    await client.managedPaymentInstructions();
    await client.createPaymentInstruction(instruction as never);
    await client.updatePaymentInstruction("instruction-1", instruction as never);
    await client.deletePaymentInstruction("instruction-1");
    await client.privateTutoringServices();
    await client.createPrivateTutoringService(tutoringService as never);
    await client.updatePrivateTutoringService("service-1", tutoringService as never);
    await client.privateTutors();
    await client.createPrivateTutor(tutor as never);
    await client.updatePrivateTutor("tutor-1", tutor as never);
    await client.privateTutoringRequests();
    await client.decidePrivateTutoringRequest("request-1", { approved: true, tutorId: "tutor-1" });
    await client.parentPrivateTutoringServices("child-1", "tenant-1");
    await client.parentPrivateTutoringRequests("tenant-1");
    await client.createParentPrivateTutoringRequest("service-1", { childId: "child-1", pricingType: "MONTHLY" }, "tenant-1");
    await client.cancelParentPrivateTutoringRequest("request-1", "tenant-1");

    const calls = requests(fetchMock);
    expect(calls.map(({ url, method }) => [url.replace("https://api.example.test/api/v1", ""), method])).toEqual([
      ["/parent-enrollment/catalog?search=daycare", "GET"],
      ["/parent-enrollment", "GET"],
      ["/parent-enrollment/checkout", "POST"],
      ["/parent-enrollment/transfer", "POST"],
      ["/parent-enrollment/pending-approval?branchId=branch-1&search=Anak", "GET"],
      ["/parent-enrollment/enrollment-1/approval", "POST"],
      ["/parent-enrollment/enrollment-1/retry", "POST"],
      ["/parent-enrollment/enrollment-1/cancel", "POST"],
      ["/payment-instructions", "GET"],
      ["/payment-instructions/manage", "GET"],
      ["/payment-instructions", "POST"],
      ["/payment-instructions/instruction-1", "PATCH"],
      ["/payment-instructions/instruction-1", "DELETE"],
      ["/private-tutoring/manage/services", "GET"],
      ["/private-tutoring/manage/services", "POST"],
      ["/private-tutoring/manage/services/service-1", "PATCH"],
      ["/private-tutoring/manage/tutors", "GET"],
      ["/private-tutoring/manage/tutors", "POST"],
      ["/private-tutoring/manage/tutors/tutor-1", "PATCH"],
      ["/private-tutoring/manage/requests", "GET"],
      ["/private-tutoring/manage/requests/request-1/decision", "POST"],
      ["/private-tutoring/parent/services?childId=child-1", "GET"],
      ["/private-tutoring/parent/requests", "GET"],
      ["/private-tutoring/parent/services/service-1/requests", "POST"],
      ["/private-tutoring/parent/requests/request-1/cancel", "POST"],
    ]);
    expect(calls[2]!.body).toBe(JSON.stringify({ enrollments: [enrollment] }));
    expect(calls[8]!.headers.get("X-Organization-Id")).toBe("tenant-1");
    expect(calls[23]!.headers.get("X-Organization-Id")).toBe("tenant-1");
  });

  it("maps curriculum, classroom, and child goal workflows", async () => {
    const { client, fetchMock } = createHarness();
    const activity = { name: "Bermain warna", description: "Mengenal warna" };
    const level = { name: "Kelompok Bermain", branchId: "branch-1" };
    const classroom = { name: "Rombel A", learningLevelId: "level-1", branchId: "branch-1" };
    const program = { name: "Motorik", indicators: [] };

    await client.academicYears();
    await client.createAcademicYear({ name: "2026/2027", startsOn: "2026-07-01", endsOn: "2027-06-30" } as never);
    await client.curriculumPrograms("Merdeka", true);
    await client.createCurriculumProgram({ name: "Kurikulum", active: true } as never);
    await client.updateCurriculumProgram("curriculum-1", { name: "Kurikulum Baru" } as never);
    await client.setCurriculumProgramActive("curriculum-1", false);
    await client.curriculumActivities();
    await client.createCurriculumActivity(activity as never);
    await client.updateCurriculumActivity("activity-1", activity as never);
    await client.archiveCurriculumActivity("activity-1");
    await client.curriculumActivityAssessments("activity-1");
    await client.createCurriculumActivityAssessment("activity-1", { title: "Observasi" } as never);
    await client.removeCurriculumActivityAssessment("activity-1", "assessment-1");
    await client.learningLevelTemplates();
    await client.learningBranches();
    await client.learningLevels();
    await client.createLearningLevel(level as never);
    await client.updateLearningLevel("level-1", level as never);
    await client.archiveLearningLevel("level-1");
    await client.classrooms({ branchId: "branch-1" });
    await client.createClassroom(classroom as never);
    await client.updateClassroom("classroom-1", classroom as never);
    await client.archiveClassroom("classroom-1");
    await client.classroomStaffAssignments("classroom-1");
    await client.assignClassroomStaff("classroom-1", { userId: "staff-1", assignmentRole: "STAFF" });
    await client.unassignClassroomStaff("classroom-1", "assignment-1");
    await client.classroomPrograms("classroom-1");
    await client.createClassroomProgram("classroom-1", { name: "Program" });
    await client.removeClassroomProgram("classroom-1", "program-1");
    await client.developmentPrograms("  motorik ", "curriculum-1");
    await client.createDevelopmentProgram(program as never);
    await client.updateDevelopmentProgram("program-1", program as never);
    await client.deleteDevelopmentProgram("program-1");
    await client.createGoalIndicator("program-1", { title: "Melompat" } as never);
    await client.updateGoalIndicator("program-1", "indicator-1", { title: "Melompat jauh" } as never);
    await client.archiveGoalIndicator("program-1", "indicator-1");
    await client.childGoals("child-1", "tenant-1");
    await client.assignChildGoal("child-1", { curriculumProgramId: "curriculum-1", programId: "program-1" });
    await client.recordGoalCheckIn("goal-1", "2026-10-13", "indicator-1", "YES", { note: "Teramati" });
    await client.recordGoalCheckInBatch("goal-1", "2026-10-13", [{ indicatorId: "indicator-1", outcome: "NO" }]);
    await client.goalCheckInPhoto("goal-1", "2026-10-13", "indicator-1");
    await client.goalCheckInAudio("goal-1", "2026-10-13", "indicator-1");
    await client.finalizeChildGoal("goal-1", { outcome: "ACHIEVED", summary: "Tercapai" });
    await client.correctChildGoalConclusion("goal-1", { outcome: "NOT_ACHIEVED", summary: "Koreksi", reason: "Review" });

    const calls = requests(fetchMock);
    expect(calls.map(({ url, method }) => [url.replace("https://api.example.test/api/v1", ""), method])).toEqual(expect.arrayContaining([
      ["/academic-years", "POST"],
      ["/curriculum-programs?search=Merdeka&includeArchived=true", "GET"],
      ["/curriculum-activities/activity-1/assessments/assessment-1", "DELETE"],
      ["/learning-levels/level-1/archive", "POST"],
      ["/classrooms?branchId=branch-1", "GET"],
      ["/classrooms/classroom-1/staff-assignments", "POST"],
      ["/development-programs?search=motorik&curriculumProgramId=curriculum-1", "GET"],
      ["/children/child-1/goals", "POST"],
      ["/child-goals/goal-1/check-ins/2026-10-13/batch", "PUT"],
      ["/child-goals/goal-1/finalize", "POST"],
      ["/child-goals/goal-1/conclusion-corrections", "POST"],
    ]));
    expect(calls).toHaveLength(44);
  });

  it("maps tenant messaging, notification, reminder, leave, and announcement actions", async () => {
    const { client, fetchMock } = createHarness();
    const message = { body: "Mohon kabari perkembangan hari ini" };
    const reminder = { title: "Periksa kelas", target: "ALL_STAFF", active: true };
    const leave = { startsOn: "2026-10-20", endsOn: "2026-10-20", type: "PERSONAL" };
    const announcement = { audience: "TENANT", title: "Info", body: "Informasi lembaga" };

    await client.childMessages("child-1", "tenant-1");
    await client.childMessageSummary("child-1", "tenant-1");
    await client.childMessageTemplates();
    await client.createChildMessageTemplate(message.body);
    await client.updateChildMessageTemplate("template-1", "Pesan baru");
    await client.deleteChildMessageTemplate("template-1");
    await client.childMessageUnreadSummary("tenant-1");
    await client.sendChildMessage("child-1", message.body, "tenant-1", "message-0");
    await client.childMessagePhoto("child-1", "message-1", "tenant-1");
    await client.markChildMessagesRead("child-1", "tenant-1");
    await client.analyticsOccupancy();
    await client.analyticsParentRetention(6);
    await client.analyticsDevelopmentTrend();
    await client.notifications("  unread  ", "tenant-1", 2, 10);
    await client.markNotificationRead("notification-1", "tenant-1");
    await client.markAllNotificationsRead("tenant-1");
    await client.staffReminders();
    await client.createStaffReminder(reminder as never);
    await client.updateStaffReminder("reminder-1", reminder as never);
    await client.setStaffReminderActive("reminder-1", false);
    await client.deleteStaffReminder("reminder-1");
    await client.syncStaffReminderSchedules({ installationId: "install-1", schedules: [] });
    await client.staffLeaveRequests();
    await client.createStaffLeaveRequest(leave as never);
    await client.cancelStaffLeaveRequest("leave-1");
    await client.pendingStaffLeaveRequests();
    await client.decideStaffLeaveRequest("leave-1", { approved: false, rejectionReason: "Jadwal padat" });
    await client.createTenantFeedback({ category: "FEATURE_REQUEST", message: "Masukan" } as never, "tenant-1");
    await client.myTenantFeedback("tenant-1");
    await client.tenantFeedbackInbox();
    await client.updateTenantFeedbackStatus("feedback-1", "RESOLVED");
    await client.announcements("tenant-1");
    await client.managedAnnouncements();
    await client.createAnnouncement(announcement as never);
    await client.updateAnnouncement("announcement-1", announcement as never);
    await client.publishAnnouncement("announcement-1", "2026-10-20T09:00:00Z");
    await client.closeAnnouncement("announcement-1");
    await client.acknowledgeAnnouncement("announcement-1", "tenant-1");

    const calls = requests(fetchMock);
    expect(calls.map(({ url, method }) => [url.replace("https://api.example.test/api/v1", ""), method])).toEqual(expect.arrayContaining([
      ["/children/child-1/messages", "GET"],
      ["/children/child-1/messages/summary", "GET"],
      ["/child-messages/unread-summary", "GET"],
      ["/children/child-1/messages", "POST"],
      ["/notifications?page=2&size=10&search=unread", "GET"],
      ["/notifications/read-all", "PATCH"],
      ["/staff-reminders/local-schedules", "PUT"],
      ["/staff-leave-requests/leave-1/approval", "POST"],
      ["/tenant-feedback/feedback-1/status", "POST"],
      ["/announcements/announcement-1/publish", "POST"],
    ]));
    expect(calls).toHaveLength(38);
    expect(calls.every(({ headers }) => ["tenant-1", "active-tenant"].includes(headers.get("X-Organization-Id") ?? ""))).toBe(true);
  });

  it("maps institution setup, tenant staff access, and child/classroom placement workflows", async () => {
    const { client, fetchMock } = createHarness();
    const institutionType = { code: "PAUD", name: "PAUD", description: "Pendidikan anak usia dini" };
    const staff = { displayName: "Guru", email: "guru@example.test", role: "STAFF" };
    const child = { fullName: "Anak", dateOfBirth: "2022-01-01", gender: "UNSPECIFIED", branchId: "branch-1" };
    const absence = { childId: "child-1", purpose: "ILLNESS", startDate: "2026-10-13", endDate: "2026-10-14" };
    const program = { name: "Kemandirian", description: "Latihan mandiri", parentVisible: true };

    await client.organizationReadiness();
    await client.createInstitutionType(institutionType as never);
    await client.updateInstitutionType("PAUD", institutionType as never);
    await client.deleteInstitutionType("PAUD");
    await client.globalDevelopmentPrograms("  bahasa ");
    await client.createGlobalDevelopmentProgram(program as never);
    await client.updateGlobalDevelopmentProgram("program-1", program as never);
    await client.reviseGlobalDevelopmentProgram("program-1", program as never);
    await client.deleteGlobalDevelopmentProgram("program-1");
    await client.globalLearningLevels();
    await client.createGlobalLearningLevel({ name: "Usia 3-4 tahun" } as never);
    await client.updateGlobalLearningLevel("level-1", { name: "Usia 4-5 tahun" } as never);
    await client.deleteGlobalLearningLevel("level-1");
    await client.createGlobalCurriculumProgram({ name: "Kurikulum" } as never);
    await client.updateGlobalCurriculumProgram("curriculum-1", { name: "Kurikulum terbaru" } as never);
    await client.setGlobalCurriculumProgramActive("curriculum-1", true);
    await client.seedGlobalCurriculum();
    await client.inviteTenantUser({ email: "guru@example.test", role: "STAFF" } as never);
    await client.createTenantUser(staff as never);
    await client.tenantUsers({ branchId: "branch-1" });
    await client.updateTenantUser("user-1", { displayName: "Guru Baru" } as never);
    await client.deactivateTenantUser("user-1");
    await client.updateTenantUserChildProgramPermission("user-1", true);
    await client.updateTenantUserDevelopmentCategoryPermission("user-1", false);
    await client.changeTenantUserPassword("user-1", "new-password");
    await client.registerDevice({ token: "push-token", platform: "android", installationId: "install-1", timeZone: "Asia/Jakarta" });
    await client.deviceNotificationPreference("install-1");
    await client.updateDeviceNotificationPreference({ installationId: "install-1", muteDuration: "ONE_HOUR" } as never);
    await client.children({ branchId: "branch-1", learningLevelId: "level-1", classroomId: "classroom-1", guardianStatus: "LINKED" }, "tenant-1");
    await client.childAbsenceRequests({ childId: "child-1", branchId: "branch-1" }, "tenant-1");
    await client.createChildAbsenceRequest(absence as never, "tenant-1");
    await client.decideChildAbsenceRequest("absence-1", { approved: false, rejectionReason: "Mohon revisi" }, "tenant-1");
    await client.cancelChildAbsenceRequest("absence-1", "tenant-1");
    await client.createChild(child as never);
    await client.childProfile("child-1");
    await client.childProgramsSummary();
    await client.parentChildProgramsSummary("tenant-1");
    await client.updateChild("child-1", child as never);
    await client.deactivateChild("child-1");
    await client.addChildProgram("child-1", program as never);
    await client.updateChildProgram("child-1", "program-1", { ...program, status: "ACTIVE" } as never);
    await client.removeChildProgram("child-1", "program-1");
    await client.childProgramTemplates();
    await client.createChildProgramTemplate({ name: "Template", steps: [] });
    await client.updateChildProgramTemplate("template-1", { name: "Template baru", steps: [] });
    await client.removeChildProgramTemplate("template-1");
    await client.createChildProgramFromTemplate("child-1", "template-1");
    await client.addChildProgramStep("child-1", "program-1", { title: "Merapikan mainan" });
    await client.updateChildProgramStep("child-1", "program-1", "step-1", { title: "Merapikan mainan", parentVisible: true, completed: false, displayOrder: 1 });
    await client.removeChildProgramStep("child-1", "program-1", "step-1");
    await client.addChildProgramStaffNote("child-1", "program-1", { note: "Mulai mandiri" });
    await client.assignChildStaff("child-1", { userId: "user-1", assignmentRole: "STAFF" });
    await client.unassignChildStaff("child-1", "assignment-1");
    await client.bindChildGuardian("child-1", "parent@example.test");
    await client.unbindChildGuardian("child-1", "parent-1");
    await client.recordAttendance("child-1", { action: "CHECK_IN", method: "QR", idempotencyKey: "attendance-1", qrToken: "qr-token" });
    await client.issueAttendanceQr("child-1", "tenant-1");
    await client.childPlacements("child-1");
    await client.childPlacementOptions("child-1");
    await client.placeChild("child-1", { classroomId: "classroom-1", startsOn: "2026-10-14" });

    const calls = requests(fetchMock);
    expect(calls.map(({ url, method }) => [url.replace("https://api.example.test/api/v1", ""), method])).toEqual(expect.arrayContaining([
      ["/platform/institution-types/PAUD", "PATCH"],
      ["/platform/global-curriculum-seed", "POST"],
      ["/tenant-users/user-1/child-program-permission", "PATCH"],
      ["/device-notification-preference?installationId=install-1", "GET"],
      ["/children?branchId=branch-1&learningLevelId=level-1&classroomId=classroom-1&guardianStatus=LINKED", "GET"],
      ["/child-absence-requests/absence-1/decision", "POST"],
      ["/children/child-1/programs/from-template/template-1", "POST"],
      ["/children/child-1/guardians/parent-1", "DELETE"],
      ["/children/child-1/attendance", "POST"],
      ["/children/child-1/attendance-qr", "GET"],
      ["/children/child-1/placements", "POST"],
    ]));
    expect(calls.length).toBeGreaterThan(55);
    expect(calls.find(({ url }) => url.endsWith("/children?branchId=branch-1&learningLevelId=level-1&classroomId=classroom-1&guardianStatus=LINKED"))?.headers.get("X-Organization-Id")).toBe("tenant-1");
  });

});
