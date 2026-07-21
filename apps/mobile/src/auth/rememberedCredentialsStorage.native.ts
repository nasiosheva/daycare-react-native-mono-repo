import * as SecureStore from "expo-secure-store";

const identifierStorageKey = "daycare.auth.identifier";
const passwordStorageKey = "daycare.auth.password";

export type RememberedCredentials = {
  identifier: string;
  password: string;
};

export async function loadRememberedCredentials(): Promise<RememberedCredentials | null> {
  const [identifier, password] = await Promise.all([
    SecureStore.getItemAsync(identifierStorageKey),
    SecureStore.getItemAsync(passwordStorageKey),
  ]);
  if (!identifier || !password) return null;
  return { identifier, password };
}

export async function saveRememberedCredentials({ identifier, password }: RememberedCredentials): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(identifierStorageKey, identifier),
    SecureStore.setItemAsync(passwordStorageKey, password),
  ]);
}

export async function clearRememberedCredentials(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(identifierStorageKey),
    SecureStore.deleteItemAsync(passwordStorageKey),
  ]);
}
