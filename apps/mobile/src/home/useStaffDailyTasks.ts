import { useQueries } from "@tanstack/react-query";
import type { Child } from "@daycare/api-client";
import { formatIsoDate } from "@/date-picker/date";
import { useAuth } from "@/auth/AuthProvider";
import { createStaffChildDailyTasks, type StaffChildDailyTasks } from "./staffDailyTasks";

export type StaffChildDailyTaskStatus = StaffChildDailyTasks & { isLoading: boolean; isError: boolean };

export function useStaffDailyTasks(children: readonly Child[], enabled: boolean): Map<string, StaffChildDailyTaskStatus> {
  const { api, organizationId } = useAuth();
  const today = formatIsoDate(new Date());
  const developmentQueries = useQueries({ queries: children.map((child) => ({ queryKey: ["development-entries", organizationId, child.id], queryFn: () => api.developmentEntries(child.id), enabled: Boolean(organizationId) && enabled })) });
  const goalQueries = useQueries({ queries: children.map((child) => ({ queryKey: ["child-goals", organizationId, child.id], queryFn: () => api.childGoals(child.id), enabled: Boolean(organizationId) && enabled })) });
  return new Map(children.map((child, index) => {
    const development = developmentQueries[index];
    const goals = goalQueries[index];
    return [child.id, { ...createStaffChildDailyTasks(development?.data ?? [], goals?.data ?? [], today), isLoading: Boolean(development?.isLoading || goals?.isLoading), isError: Boolean(development?.isError || goals?.isError) }];
  }));
}
