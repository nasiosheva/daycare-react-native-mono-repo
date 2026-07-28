import { describe, expect, it } from "vitest";
import { can, attendanceCommandSchema, capabilitiesForInstitutionTypes, childSchema, developmentEntrySchema, hasInstitutionCapability, parentFamilyProfileSchema, purchaseServiceSchema } from "./index";

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
    expect(developmentEntrySchema.safeParse({ category: "07d3bc4b-137d-4a92-b8dd-6b56224f02b7", title: "Komunikasi", content: "Mampu mengikuti instruksi sederhana." }).success).toBe(true);
    expect(developmentEntrySchema.safeParse({ category: "", title: "Catatan", content: "..." }).success).toBe(false);
  });

  it("requires a supported gender when creating a child", () => {
    const child = { firstName: "Alya", gender: "FEMALE", dateOfBirth: "2022-01-01" };
    expect(childSchema.safeParse(child).success).toBe(true);
    expect(childSchema.safeParse({ ...child, gender: "UNSPECIFIED" }).success).toBe(false);
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

  it("permits an optional Parent family profile with supported dropdown values", () => {
    expect(parentFamilyProfileSchema.safeParse({ husbandOccupation: "PNS", husbandIncomeRange: "THREE_TO_FIVE_MILLION", wifeDateOfBirth: null }).success).toBe(true);
    expect(parentFamilyProfileSchema.safeParse({ husbandOccupation: "UNKNOWN" }).success).toBe(false);
  });
});
