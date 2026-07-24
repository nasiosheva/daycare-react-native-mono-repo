import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";
import type { StaffReminder } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";
import { getDeviceInstallationId } from "@/device/installationId";
import { reconcileLocalReminderSchedules } from "./localReminderScheduler";

export const staffReminderQueryKey = (organizationId: string | null) => ["staff-reminders", organizationId] as const;

export function useStaffReminders(enabled = true) {
  const { api, organizationId } = useAuth();
  const query = useQuery({ queryKey: staffReminderQueryKey(organizationId), queryFn: () => api.staffReminders(), enabled: Boolean(organizationId) && enabled });
  useEffect(() => {
    if (Platform.OS === "web" || !organizationId || !query.data) return;
    void syncLocalSchedules(api, organizationId, query.data).catch(() => undefined);
  }, [api, organizationId, query.data]);
  return query;
}

export async function syncLocalSchedules(api: { syncStaffReminderSchedules(input: { installationId: string; schedules: { reminderId: string; ruleVersion: number; scheduled: boolean }[] }): Promise<void> }, organizationId: string, reminders: readonly StaffReminder[]): Promise<void> {
  const [installationId, schedules] = await Promise.all([getDeviceInstallationId(), reconcileLocalReminderSchedules(reminders, organizationId)]);
  await api.syncStaffReminderSchedules({ installationId, schedules });
}

export function useRefreshStaffReminders() {
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();
  return () => queryClient.invalidateQueries({ queryKey: staffReminderQueryKey(organizationId) });
}
