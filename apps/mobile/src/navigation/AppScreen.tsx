import type { PropsWithChildren } from "react";
import type { Role } from "@daycare/core";
import { Screen, type ScreenProps } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { RoleBottomNavigation, type NavigationRole } from "./RoleBottomNavigation";

type Props = PropsWithChildren<ScreenProps & { showBottomNavigation?: boolean }>;

export function AppScreen({ children, showBottomNavigation = true, ...screenProps }: Props) {
  const { profile, organizationId } = useAuth();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const role: NavigationRole | null = profile?.isPlatformAdmin ? "ADMIN" : membership?.role ?? (profile?.registrationRole === "PARENT" ? "PARENT_ONBOARDING" : null);
  const footer = showBottomNavigation && role ? <RoleBottomNavigation role={role} capabilities={membership?.capabilities} /> : undefined;
  return <Screen {...screenProps} footer={footer}>{children}</Screen>;
}
