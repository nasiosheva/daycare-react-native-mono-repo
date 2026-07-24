const storageKey = "umur-emas.reminders.installation-id";

function createInstallationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function getReminderInstallationId(): Promise<string> {
  const existing = globalThis.localStorage?.getItem(storageKey) ?? null;
  if (existing) return existing;
  const installationId = createInstallationId();
  globalThis.localStorage?.setItem(storageKey, installationId);
  return installationId;
}
