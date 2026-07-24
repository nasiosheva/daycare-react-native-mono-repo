import type { Child } from "@daycare/api-client";

export function resolveSelectedChildId(children: readonly Pick<Child, "id">[], currentChildId: string | null, routeChildId?: string): string | null {
  if (routeChildId && children.some((child) => child.id === routeChildId)) return routeChildId;
  if (currentChildId && children.some((child) => child.id === currentChildId)) return currentChildId;
  return children[0]?.id ?? null;
}
