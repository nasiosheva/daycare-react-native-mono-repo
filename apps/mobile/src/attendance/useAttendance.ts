import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AttendanceAction, AttendanceMethod } from "@daycare/core";
import { useAuth } from "@/auth/AuthProvider";

export function useChildren(enabled = true) {
  const { api, organizationId } = useAuth();
  return useQuery({ queryKey: ["children", organizationId], queryFn: () => api.children(), enabled: Boolean(organizationId) && enabled });
}

export function useRecordAttendance() {
  const { api, organizationId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, action, method, qrToken }: { childId: string; action: AttendanceAction; method: AttendanceMethod; qrToken?: string }) => api.recordAttendance(childId, { action, method, qrToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["children", organizationId] }),
  });
}

export function useAttendanceQr(childId: string) {
  const { api } = useAuth();
  return useQuery({ queryKey: ["attendance-qr", childId], queryFn: () => api.issueAttendanceQr(childId), enabled: Boolean(childId), staleTime: 30_000 });
}
