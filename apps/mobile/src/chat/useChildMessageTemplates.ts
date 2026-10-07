import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";

/** Mirrors the API limit on a quick reply body. */
export const CHILD_MESSAGE_TEMPLATE_MAX_LENGTH = 500;

export const childMessageTemplatesQueryKey = (organizationId?: string | null) => ["child-message-templates", organizationId] as const;

/** Tenant quick replies for the chat composer; only active Staff/Staff Admin may read them. */
export function useChildMessageTemplates(enabled: boolean) {
  const { api, organizationId } = useAuth();
  return useQuery({
    queryKey: childMessageTemplatesQueryKey(organizationId),
    queryFn: () => api.childMessageTemplates(),
    enabled: enabled && Boolean(organizationId),
  });
}
