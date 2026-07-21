import { describe, expect, it } from "vitest";
import { can, attendanceCommandSchema, capabilitiesForInstitutionTypes, developmentEntrySchema, hasInstitutionCapability, purchaseServiceSchema } from "./index";

describe("permissions", () => {
  it("only permits staff to record attendance", () => {
    expect(can("STAFF", "recordAttendance")).toBe(true);
    expect(can("ADMIN", "recordAttendance")).toBe(false);
    expect(can("STAFF_ADMIN", "manageTenantUsers")).toBe(true);
    expect(can("ADMIN", "manageTenantUsers")).toBe(false);
    expect(can("PARENT", "recordAttendance")).toBe(false);
  });

  it("requires an allowed attendance action", () => {
    expect(attendanceCommandSchema.safeParse({ action: "CHECK_IN", method: "QR" }).success).toBe(true);
    expect(attendanceCommandSchema.safeParse({ action: "REMOVE", method: "QR" }).success).toBe(false);
  });

  it("validates a parent-visible development entry", () => {
    expect(developmentEntrySchema.safeParse({ category: "OBSERVATION", title: "Komunikasi", content: "Mampu mengikuti instruksi sederhana." }).success).toBe(true);
    expect(developmentEntrySchema.safeParse({ category: "OTHER", title: "Catatan", content: "..." }).success).toBe(false);
  });

  it("permits monthly purchases without booking dates and keeps booking permissions parent-only", () => {
    expect(purchaseServiceSchema.safeParse({ planId: "07d3bc4b-137d-4a92-b8dd-6b56224f02b7", childId: "28c3ce51-24f2-4e76-8449-3ee2b16531b4", bookingDates: [] }).success).toBe(true);
    expect(can("PARENT", "bookServices")).toBe(true);
    expect(can("STAFF", "bookServices")).toBe(false);
  });

  it("derives reusable institution capabilities from one or more institution types", () => {
    expect(capabilitiesForInstitutionTypes(["DAYCARE"])).toEqual(["DAYCARE_OPERATIONS"]);
    expect(capabilitiesForInstitutionTypes(["PAUD", "TK"])).toEqual(["ACADEMIC_CURRICULUM"]);
    expect(hasInstitutionCapability(capabilitiesForInstitutionTypes(["DAYCARE", "TK"]), "ACADEMIC_CURRICULUM")).toBe(true);
  });
});
