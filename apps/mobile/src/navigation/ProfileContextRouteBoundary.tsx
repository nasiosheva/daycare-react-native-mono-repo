import type { PropsWithChildren } from "react";
import { usePathname } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { SafeRedirect } from "./SafeRedirect";
import { shouldRedirectUntilProfileLoaded } from "./profileContextRouteAccess";

export function ProfileContextRouteBoundary({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { profile, user } = useAuth();

  if (shouldRedirectUntilProfileLoaded(Boolean(user), Boolean(profile), pathname)) return <SafeRedirect href="/home" />;

  return children;
}
