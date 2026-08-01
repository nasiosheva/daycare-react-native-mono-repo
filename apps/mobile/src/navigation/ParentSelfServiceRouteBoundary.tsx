import type { PropsWithChildren } from "react";
import { usePathname } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { SafeRedirect } from "./SafeRedirect";
import { shouldBlockParentSelfServiceRoute } from "./parentSelfServiceRouteAccess";

export function ParentSelfServiceRouteBoundary({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { profile } = useAuth();

  if (shouldBlockParentSelfServiceRoute(profile, pathname)) return <SafeRedirect href="/home" />;

  return children;
}
