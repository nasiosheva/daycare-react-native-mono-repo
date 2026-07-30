import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChildInput } from "@daycare/core";
import type { ChildAssignmentRole, UpdateChildInput } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";

export function useChildProfile(childId: string | null) {
  const { api, organizationId } = useAuth();
  return useQuery({ queryKey: ["child-profile", organizationId, childId], queryFn: () => api.childProfile(childId!), enabled: Boolean(organizationId && childId) });
}

function useChildMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["children", organizationId] }); void queryClient.invalidateQueries({ queryKey: ["child-profile", organizationId] }); } });
}

export function useCreateChild() {
  const { api } = useAuth();
  return useChildMutation<ChildInput, Awaited<ReturnType<typeof api.createChild>>>((input) => api.createChild(input));
}

export function useUpdateChild(childId: string) {
  const { api } = useAuth();
  return useChildMutation<UpdateChildInput, Awaited<ReturnType<typeof api.updateChild>>>((input) => api.updateChild(childId, input));
}

export function useDeactivateChild(childId: string) {
  const { api } = useAuth();
  return useChildMutation<void, Awaited<ReturnType<typeof api.deactivateChild>>>(() => api.deactivateChild(childId));
}

export function useAddChildProgram(childId: string) {
  const { api } = useAuth();
  return useChildMutation<{ name: string; description?: string }, Awaited<ReturnType<typeof api.addChildProgram>>>((input) => api.addChildProgram(childId, input));
}

export function useRemoveChildProgram(childId: string) {
  const { api } = useAuth();
  return useChildMutation<string, Awaited<ReturnType<typeof api.removeChildProgram>>>((programId) => api.removeChildProgram(childId, programId));
}

export function useAssignChildStaff(childId: string) {
  const { api } = useAuth();
  return useChildMutation<{ userId: string; assignmentRole: ChildAssignmentRole }, Awaited<ReturnType<typeof api.assignChildStaff>>>((input) => api.assignChildStaff(childId, input));
}

export function useUnassignChildStaff(childId: string) {
  const { api } = useAuth();
  return useChildMutation<string, Awaited<ReturnType<typeof api.unassignChildStaff>>>((assignmentId) => api.unassignChildStaff(childId, assignmentId));
}

export function useBindChildGuardian(childId: string) {
  const { api } = useAuth();
  return useChildMutation<string, Awaited<ReturnType<typeof api.bindChildGuardian>>>((identifier) => api.bindChildGuardian(childId, identifier));
}

export function useUnbindChildGuardian(childId: string) {
  const { api } = useAuth();
  return useChildMutation<string, Awaited<ReturnType<typeof api.unbindChildGuardian>>>((userId) => api.unbindChildGuardian(childId, userId));
}
