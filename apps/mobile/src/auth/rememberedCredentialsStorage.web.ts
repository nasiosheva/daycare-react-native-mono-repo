const identifierStorageKey = "daycare.auth.identifier";
const passwordStorageKey = "daycare.auth.password";

export type RememberedCredentials = {
  identifier: string;
  password: string;
};

export async function loadRememberedCredentials(): Promise<RememberedCredentials | null> {
  const identifier = globalThis.localStorage?.getItem(identifierStorageKey) ?? null;
  const password = globalThis.localStorage?.getItem(passwordStorageKey) ?? null;
  if (!identifier || !password) return null;
  return { identifier, password };
}

export async function saveRememberedCredentials({ identifier, password }: RememberedCredentials): Promise<void> {
  globalThis.localStorage?.setItem(identifierStorageKey, identifier);
  globalThis.localStorage?.setItem(passwordStorageKey, password);
}

export async function clearRememberedCredentials(): Promise<void> {
  globalThis.localStorage?.removeItem(identifierStorageKey);
  globalThis.localStorage?.removeItem(passwordStorageKey);
}
