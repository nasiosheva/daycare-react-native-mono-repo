import type { PropsWithChildren } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { SafeRedirect } from "./SafeRedirect";
import { hasLegacyDaycareRouteAccess, type LegacyDaycareRoutePolicy } from "./legacyDaycareRouteAccess";
import { hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

type LegacyDaycareRouteGuardProps = PropsWithChildren<{
  policy: LegacyDaycareRoutePolicy;
}>;

export function LegacyDaycareRouteGuard({ children, policy }: LegacyDaycareRouteGuardProps) {
  const { organizationId, profile, profileError } = useAuth();
  const access = useUiAccessContext(Boolean(profile && organizationId));

  if (!profile) return profileError ? <SafeRedirect href="/home" /> : null;
  if (access.isLoading) return null;
  if (!hasLegacyDaycareRouteAccess(profile, organizationId, policy, hasOfferingCapability(access.data, "DAYCARE_OPERATIONS"))) return <SafeRedirect href="/home" />;

  return children;
}
