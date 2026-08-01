import type { PropsWithChildren } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { SafeRedirect } from "./SafeRedirect";
import { hasLegacyDaycareRouteAccess, type LegacyDaycareRoutePolicy } from "./legacyDaycareRouteAccess";

type LegacyDaycareRouteGuardProps = PropsWithChildren<{
  policy: LegacyDaycareRoutePolicy;
}>;

export function LegacyDaycareRouteGuard({ children, policy }: LegacyDaycareRouteGuardProps) {
  const { organizationId, profile, profileError } = useAuth();

  if (!profile) return profileError ? <SafeRedirect href="/home" /> : null;
  if (!hasLegacyDaycareRouteAccess(profile, organizationId, policy)) return <SafeRedirect href="/home" />;

  return children;
}
