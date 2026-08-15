import type { ChildGender } from "@daycare/core";
import { isIsoDate } from "../date-picker/date";

export const MAX_ENROLLMENT_CHILDREN = 10;

export type EnrollmentChildDraft = {
  firstName: string;
  lastName?: string;
  gender?: ChildGender;
  dateOfBirth: string;
};

export type EnrollmentChildDraftErrors = {
  firstName?: "REQUIRED";
  gender?: "REQUIRED";
  dateOfBirth?: "REQUIRED" | "INVALID";
};

export function emptyEnrollmentChild(): EnrollmentChildDraft {
  return { firstName: "", lastName: "", dateOfBirth: "" };
}

export function enrollmentChildDraftErrors(child: EnrollmentChildDraft, today: string): EnrollmentChildDraftErrors {
  return {
    ...(!child.firstName.trim() ? { firstName: "REQUIRED" as const } : {}),
    ...(!child.gender ? { gender: "REQUIRED" as const } : {}),
    ...(!child.dateOfBirth
      ? { dateOfBirth: "REQUIRED" as const }
      : !isIsoDate(child.dateOfBirth) || child.dateOfBirth > today
        ? { dateOfBirth: "INVALID" as const }
        : {}),
  };
}

export function isEnrollmentChildrenStepComplete(children: EnrollmentChildDraft[], today: string): boolean {
  return children.length >= 1
    && children.length <= MAX_ENROLLMENT_CHILDREN
    && children.every((child) => Object.keys(enrollmentChildDraftErrors(child, today)).length === 0);
}

export function planAfterOrganizationChange(currentOrganizationId: string | undefined, nextOrganizationId: string, planId: string | undefined): string | undefined {
  return currentOrganizationId === nextOrganizationId ? planId : undefined;
}
