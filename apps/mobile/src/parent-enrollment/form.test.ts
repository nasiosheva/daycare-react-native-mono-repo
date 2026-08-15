import { describe, expect, it } from "vitest";
import {
  MAX_ENROLLMENT_CHILDREN,
  emptyEnrollmentChild,
  enrollmentChildDraftErrors,
  isEnrollmentChildrenStepComplete,
  planAfterOrganizationChange,
} from "./form";

const today = "2026-08-15";
const validChild = { firstName: "Ayu", lastName: "Putri", gender: "FEMALE" as const, dateOfBirth: "2022-04-03" };

describe("parent enrollment form", () => {
  it("requires the child's first name, gender, and valid non-future birth date", () => {
    expect(enrollmentChildDraftErrors(emptyEnrollmentChild(), today)).toEqual({ firstName: "REQUIRED", gender: "REQUIRED", dateOfBirth: "REQUIRED" });
    expect(enrollmentChildDraftErrors({ ...validChild, dateOfBirth: "2026-08-16" }, today)).toEqual({ dateOfBirth: "INVALID" });
    expect(enrollmentChildDraftErrors(validChild, today)).toEqual({});
  });

  it("accepts one to ten complete children", () => {
    expect(isEnrollmentChildrenStepComplete([validChild], today)).toBe(true);
    expect(isEnrollmentChildrenStepComplete(Array.from({ length: MAX_ENROLLMENT_CHILDREN }, () => ({ ...validChild })), today)).toBe(true);
    expect(isEnrollmentChildrenStepComplete([], today)).toBe(false);
    expect(isEnrollmentChildrenStepComplete(Array.from({ length: MAX_ENROLLMENT_CHILDREN + 1 }, () => ({ ...validChild })), today)).toBe(false);
  });

  it("preserves a package only while the selected organization stays the same", () => {
    expect(planAfterOrganizationChange("tenant-a", "tenant-a", "plan-a")).toBe("plan-a");
    expect(planAfterOrganizationChange("tenant-a", "tenant-b", "plan-a")).toBeUndefined();
  });
});
