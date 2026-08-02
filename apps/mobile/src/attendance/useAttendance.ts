import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AttendanceAction, AttendanceMethod } from "@daycare/core";
import type { ChildListFilter } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";

export function useChildren(filterOrEnabled: ChildListFilter | boolean = {}, enabled = true) {
  const { api, organizationId } = useAuth();
  const filter = typeof filterOrEnabled === "boolean" ? {} : filterOrEnabled;
  const queryEnabled = typeof filterOrEnabled === "boolean" ? filterOrEnabled : enabled;
  return useQuery({ queryKey: ["children", organizationId, filter], queryFn: () => api.children(filter), enabled: Boolean(organizationId) && queryEnabled });
}

export function useRecordAttendance() {
  const { api, organizationId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, action, method, qrToken, at }: { childId: string; action: AttendanceAction; method: AttendanceMethod; qrToken?: string; at?: string }) => api.recordAttendance(childId, { action, method, qrToken, at }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["children", organizationId] }),
  });
}

export function useAttendanceQr(childId: string) {
  const { api, organizationId } = useAuth();
  return useQuery({ queryKey: ["attendance-qr", organizationId, childId], queryFn: () => api.issueAttendanceQr(childId), enabled: Boolean(organizationId && childId), staleTime: 30_000 });
}
