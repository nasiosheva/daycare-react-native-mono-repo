import type { PropsWithChildren } from "react";
import { usePathname } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { SafeRedirect } from "./SafeRedirect";
import { shouldBlockInactiveParentRoute } from "./inactiveParentRouteAccess";

export function InactiveParentRouteBoundary({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { profile, organizationId } = useAuth();

  if (shouldBlockInactiveParentRoute(profile, organizationId, pathname)) return <SafeRedirect href="/home" />;

  return children;
}
