import type { CreateTenantInput } from "@daycare/api-client";
import type { TenantSubscriptionPlan } from "@daycare/core";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type TenantCreationDraft = {
  tenantName: string;
  branchName: string;
  institutionTypes: string[];
  staffAdminName: string;
  staffAdminUsername: string;
  staffAdminEmail: string;
  staffAdminPassword: string;
  subscriptionPlan: TenantSubscriptionPlan;
  hasTrial: boolean;
  trialMonths: number;
  monthlyFee: string;
};

export type TenantDetailsErrors = {
  tenantName?: "REQUIRED";
  branchName?: "REQUIRED";
  institutionTypes?: "REQUIRED";
};

export type TenantStaffAdminErrors = {
  name?: "REQUIRED" | "INVALID";
  username?: "INVALID";
  email?: "REQUIRED" | "INVALID";
  password?: "INVALID";
};

export type TenantSubscriptionErrors = {
  monthlyFee?: "INVALID";
};

export function tenantDetailsErrors(draft: TenantCreationDraft): TenantDetailsErrors {
  return {
    ...(!draft.tenantName.trim() ? { tenantName: "REQUIRED" as const } : {}),
    ...(!draft.branchName.trim() ? { branchName: "REQUIRED" as const } : {}),
    ...(draft.institutionTypes.length === 0 ? { institutionTypes: "REQUIRED" as const } : {}),
  };
}

export function tenantStaffAdminErrors(draft: TenantCreationDraft): TenantStaffAdminErrors {
  const nameLength = draft.staffAdminName.trim().length;
  const usernameLength = draft.staffAdminUsername.trim().length;
  const email = draft.staffAdminEmail.trim();
  return {
    ...(!nameLength ? { name: "REQUIRED" as const } : nameLength < 2 ? { name: "INVALID" as const } : {}),
    ...(usernameLength > 0 && usernameLength < 2 ? { username: "INVALID" as const } : {}),
    ...(!email ? { email: "REQUIRED" as const } : !emailPattern.test(email) ? { email: "INVALID" as const } : {}),
    ...(draft.staffAdminPassword.length < 6 || draft.staffAdminPassword.length > 128 ? { password: "INVALID" as const } : {}),
  };
}

export function tenantSubscriptionErrors(draft: TenantCreationDraft): TenantSubscriptionErrors {
  if (draft.hasTrial) return {};
  const fee = Number(draft.monthlyFee);
  return Number.isFinite(fee) && fee > 0 ? {} : { monthlyFee: "INVALID" };
}

export function tenantCreationPayload(draft: TenantCreationDraft): CreateTenantInput {
  return {
    tenantName: draft.tenantName.trim(),
    branchName: draft.branchName.trim(),
    institutionTypes: draft.institutionTypes,
    subscriptionPlan: draft.subscriptionPlan,
    ...(draft.hasTrial ? { trialMonths: draft.trialMonths } : { monthlyFee: Number(draft.monthlyFee) }),
    staffAdminName: draft.staffAdminName.trim(),
    ...(draft.staffAdminUsername.trim() ? { staffAdminUsername: draft.staffAdminUsername.trim() } : {}),
    staffAdminEmail: draft.staffAdminEmail.trim(),
    staffAdminPassword: draft.staffAdminPassword,
  };
}

export function tenantCreationReview(draft: TenantCreationDraft): Omit<CreateTenantInput, "staffAdminPassword"> {
  const payload = tenantCreationPayload(draft);
  return {
    tenantName: payload.tenantName,
    branchName: payload.branchName,
    institutionTypes: payload.institutionTypes,
    subscriptionPlan: payload.subscriptionPlan,
    ...(payload.trialMonths != null ? { trialMonths: payload.trialMonths } : {}),
    ...(payload.monthlyFee != null ? { monthlyFee: payload.monthlyFee } : {}),
    staffAdminName: payload.staffAdminName,
    ...(payload.staffAdminUsername ? { staffAdminUsername: payload.staffAdminUsername } : {}),
    staffAdminEmail: payload.staffAdminEmail,
  };
}
