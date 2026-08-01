import type { PropsWithChildren } from "react";
import { usePathname } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { SafeRedirect } from "./SafeRedirect";
import { shouldBlockInactiveStaffRoute } from "./inactiveStaffRouteAccess";

export function InactiveStaffRouteBoundary({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { profile, organizationId } = useAuth();

  if (shouldBlockInactiveStaffRoute(profile, organizationId, pathname)) return <SafeRedirect href="/home" />;

  return children;
}
