import { describe, expect, it } from "vitest";
import {
  tenantCreationPayload,
  tenantCreationReview,
  tenantDetailsErrors,
  tenantStaffAdminErrors,
  tenantSubscriptionErrors,
  type TenantCreationDraft,
} from "./form";

const validDraft: TenantCreationDraft = {
  tenantName: "  Sekolah Usia Emas  ",
  branchName: "  Cabang Utama  ",
  institutionTypes: ["PAUD", "TK"],
  staffAdminName: "  Ayu Putri  ",
  staffAdminUsername: "  ayu.putri  ",
  staffAdminEmail: "  ayu@example.com  ",
  staffAdminPassword: "rahasia123",
  subscriptionPlan: "STANDARD",
  hasTrial: true,
  trialMonths: 3,
  monthlyFee: "",
};

describe("tenant creation form", () => {
  it("validates institution data before continuing", () => {
    expect(tenantDetailsErrors({ ...validDraft, tenantName: "", branchName: "", institutionTypes: [] })).toEqual({
      tenantName: "REQUIRED",
      branchName: "REQUIRED",
      institutionTypes: "REQUIRED",
    });
    expect(tenantDetailsErrors(validDraft)).toEqual({});
  });

  it("validates the initial Staff Admin identity", () => {
    expect(tenantStaffAdminErrors({ ...validDraft, staffAdminName: "A", staffAdminUsername: "x", staffAdminEmail: "invalid", staffAdminPassword: "123" })).toEqual({
      name: "INVALID",
      username: "INVALID",
      email: "INVALID",
      password: "INVALID",
    });
    expect(tenantStaffAdminErrors(validDraft)).toEqual({});
  });

  it("requires a positive monthly fee only when trial is disabled", () => {
    expect(tenantSubscriptionErrors({ ...validDraft, hasTrial: true, monthlyFee: "" })).toEqual({});
    expect(tenantSubscriptionErrors({ ...validDraft, hasTrial: false, monthlyFee: "0" })).toEqual({ monthlyFee: "INVALID" });
    expect(tenantSubscriptionErrors({ ...validDraft, hasTrial: false, monthlyFee: "250000" })).toEqual({});
  });

  it("normalizes the final payload and excludes the password from review", () => {
    expect(tenantCreationPayload(validDraft)).toEqual({
      tenantName: "Sekolah Usia Emas",
      branchName: "Cabang Utama",
      institutionTypes: ["PAUD", "TK"],
      subscriptionPlan: "STANDARD",
      trialMonths: 3,
      staffAdminName: "Ayu Putri",
      staffAdminUsername: "ayu.putri",
      staffAdminEmail: "ayu@example.com",
      staffAdminPassword: "rahasia123",
    });
    expect(tenantCreationReview(validDraft)).not.toHaveProperty("staffAdminPassword");
  });
});
