import type { OperationalCloseReminderSource } from "./operationalCloseReminder";
import type { NativeNotificationPermission } from "@/notifications/nativePush";

export async function reconcileOperationalCloseReminderSchedules(
  _sources: readonly OperationalCloseReminderSource[],
  _permission: NativeNotificationPermission | null,
  _content: (input: { branchName: string; closesAt: string; date: string }) => { title: string; body: string },
  _now?: Date,
): Promise<void> {}

export async function cancelOperationalCloseReminderSchedules(): Promise<void> {}
