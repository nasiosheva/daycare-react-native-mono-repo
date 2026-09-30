import type { PropsWithChildren } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { SafeRedirect } from "./SafeRedirect";
import { hasLegacyDaycareRouteAccess, type LegacyDaycareRoutePolicy } from "./legacyDaycareRouteAccess";
import { hasOfferingCapability, useAnyMembershipHasOffering, useUiAccessContext } from "@/education/useUiAccessContext";

type LegacyDaycareRouteGuardProps = PropsWithChildren<{
  policy: LegacyDaycareRoutePolicy;
}>;

export function LegacyDaycareRouteGuard({ children, policy }: LegacyDaycareRouteGuardProps) {
  const { organizationId, profile, profileError } = useAuth();
  const activeAccess = useUiAccessContext(Boolean(profile && organizationId) && !policy.crossTenant);
  // A cross-tenant route (its own content already aggregates across every tenant) is gated on
  // whether ANY role-matching membership has the capability, not just the active tenant's — see
  // the note on LegacyDaycareRoutePolicy.crossTenant.
  const eligibleMemberships = (profile?.memberships ?? []).filter((item) => policy.roles.includes(item.role) && (!policy.requireActiveMembership || item.active));
  const crossTenantAccess = useAnyMembershipHasOffering(eligibleMemberships, "DAYCARE_OPERATIONS", Boolean(policy.crossTenant && profile));
  const isLoading = policy.crossTenant ? crossTenantAccess.isLoading : activeAccess.isLoading;
  const hasDaycareOffering = policy.crossTenant ? crossTenantAccess.hasCapability : hasOfferingCapability(activeAccess.data, "DAYCARE_OPERATIONS");

  if (!profile) return profileError ? <SafeRedirect href="/home" /> : null;
  if (isLoading) return null;
  if (!hasLegacyDaycareRouteAccess(profile, organizationId, policy, hasDaycareOffering)) return <SafeRedirect href="/home" />;

  return children;
}
