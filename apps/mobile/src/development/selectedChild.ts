import type { Child } from "@daycare/api-client";

export function resolveSelectedChildId(children: readonly Pick<Child, "id">[], currentChildId: string | null, routeChildId?: string, lockToRoute = false): string | null {
  if (routeChildId) {
    if (children.some((child) => child.id === routeChildId)) return routeChildId;
    if (lockToRoute) return null;
  }
  if (currentChildId && children.some((child) => child.id === currentChildId)) return currentChildId;
  return children[0]?.id ?? null;
}
