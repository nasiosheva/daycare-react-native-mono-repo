import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DevelopmentEntryInput } from "@daycare/core";
import { useAuth } from "@/auth/AuthProvider";

export function useDevelopmentEntries(childId: string | null, organizationId?: string) {
  const { api, organizationId: activeOrganizationId } = useAuth();
  const resolvedOrganizationId = organizationId ?? activeOrganizationId;
  return useQuery({ queryKey: ["development-entries", resolvedOrganizationId, childId], queryFn: () => api.developmentEntries(childId as string, resolvedOrganizationId ?? undefined), enabled: Boolean(childId && resolvedOrganizationId) });
}

export function useDevelopmentEntryPhoto(childId: string | null, entryId: string | null, organizationId?: string) {
  const { api, organizationId: activeOrganizationId } = useAuth();
  const resolvedOrganizationId = organizationId ?? activeOrganizationId;
  return useQuery({ queryKey: ["development-entry-photo", resolvedOrganizationId, childId, entryId], queryFn: () => api.developmentEntryPhoto(childId as string, entryId as string, resolvedOrganizationId ?? undefined), enabled: Boolean(childId && entryId && resolvedOrganizationId) });
}

export function useDevelopmentEntryMedia(childId: string | null, entryId: string | null, mediaId: string | null, organizationId?: string) {
  const { api, organizationId: activeOrganizationId } = useAuth();
  const resolvedOrganizationId = organizationId ?? activeOrganizationId;
  return useQuery({ queryKey: ["development-entry-media", resolvedOrganizationId, childId, entryId, mediaId], queryFn: () => api.developmentEntryMedia(childId as string, entryId as string, mediaId as string, resolvedOrganizationId ?? undefined), enabled: Boolean(childId && entryId && mediaId && resolvedOrganizationId) });
}

export function useDevelopmentCategories() {
  const { api, organizationId } = useAuth();
  return useQuery({ queryKey: ["development-categories", organizationId], queryFn: () => api.developmentCategories(), enabled: Boolean(organizationId) });
}

export function useCreateDevelopmentEntry(childId: string | null) {
  const { api, organizationId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DevelopmentEntryInput) => api.createDevelopmentEntry(childId as string, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["development-entries", organizationId, childId] }),
  });
}
