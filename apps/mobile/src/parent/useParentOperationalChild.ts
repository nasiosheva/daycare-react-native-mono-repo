import { useAuth } from "@/auth/AuthProvider";
import { useEntitlements } from "@/booking/useBooking";

/**
 * A guardian link is enough for read-only child data, but service mutations and
 * the Parent attendance QR require an active entitlement for that child.
 * Keeping this check in one hook prevents screens from showing actions that the
 * API will reject for a direct-linked Parent.
 */
export function useParentOperationalChild(childId?: string, organizationId?: string) {
  const { profile, organizationId: activeOrganizationId } = useAuth();
  const resolvedOrganizationId = organizationId ?? activeOrganizationId ?? undefined;
  const membership = profile?.memberships.find((item) => item.organizationId === resolvedOrganizationId);
  const isParent = membership?.role === "PARENT";
  const hasDaycareCapability = membership?.capabilities.includes("DAYCARE_OPERATIONS") ?? false;
  const entitlements = useEntitlements({}, isParent && membership?.active === true && hasDaycareCapability, resolvedOrganizationId);
  const hasActiveEntitlement = Boolean(childId && entitlements.data?.some((item) => item.childId === childId && item.status === "ACTIVE"));
  return { ...entitlements, membership, hasActiveEntitlement };
}
