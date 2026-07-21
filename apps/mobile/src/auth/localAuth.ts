import { ApiError } from "@daycare/api-client";
import type { AuthUser } from "./types";

export type LocalAuthSession = { token: string; user: AuthUser };

type LocalAuthResponse = { token: string; user: { uid: string; email: string | null; displayName: string } };

async function request<T>(apiUrl: string, path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { code?: string; detail?: string };
    throw new ApiError(response.status, body.code ?? "LOCAL_AUTH_FAILED", body.detail ?? "Local authentication failed");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const localAuth = {
  async signIn(apiUrl: string, identifier: string, password: string): Promise<LocalAuthSession> {
    const response = await request<LocalAuthResponse>(apiUrl, "/auth/local/login", { method: "POST", body: JSON.stringify({ identifier, password }) });
    return { token: response.token, user: { uid: response.user.uid, email: response.user.email, phoneNumber: null, displayName: response.user.displayName } };
  },
  changePassword(apiUrl: string, token: string, password: string): Promise<void> {
    return request<void>(apiUrl, "/auth/local/password", { method: "POST", body: JSON.stringify({ password }), headers: { Authorization: `Bearer ${token}` } });
  },
  updateDisplayName(apiUrl: string, token: string, displayName: string): Promise<AuthUser> {
    return request<{ uid: string; email: string | null; displayName: string }>(apiUrl, "/auth/local/profile", { method: "PATCH", body: JSON.stringify({ displayName }), headers: { Authorization: `Bearer ${token}` } })
      .then((user) => ({ uid: user.uid, email: user.email, phoneNumber: null, displayName: user.displayName }));
  },
};
