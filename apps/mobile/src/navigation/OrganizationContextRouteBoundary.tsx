import type { PropsWithChildren } from "react";
import { usePathname } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { SafeRedirect } from "./SafeRedirect";
import { shouldBlockNoMembershipRoute, shouldRedirectToOrganizationSelection } from "./organizationContextRouteAccess";

export function OrganizationContextRouteBoundary({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { profile, organizationId } = useAuth();

  if (shouldRedirectToOrganizationSelection(profile, organizationId, pathname)) return <SafeRedirect href="/context-selection" />;
  if (shouldBlockNoMembershipRoute(profile, pathname)) return <SafeRedirect href="/home" />;

  return children;
}
