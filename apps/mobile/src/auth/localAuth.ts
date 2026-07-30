import { ApiError, ApiNetworkError, fetchWithTimeout, isApiTimeoutError } from "@daycare/api-client";
import type { AuthUser } from "./types";

export type LocalAuthSession = { token: string; user: AuthUser };

type LocalAuthResponse = { token: string; user: { uid: string; email: string | null; displayName: string } };

async function request<T>(apiUrl: string, path: string, init: RequestInit, fallbackMessage: string, locale: string): Promise<T> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${apiUrl}${path}`, {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json", "Accept-Language": locale, ...init.headers },
    });
  } catch (error) {
    if (isApiTimeoutError(error)) throw error;
    throw new ApiNetworkError();
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { code?: string; detail?: string };
    throw new ApiError(response.status, body.code ?? "LOCAL_AUTH_FAILED", body.detail ?? fallbackMessage);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const localAuth = {
  async signUp(apiUrl: string, email: string, password: string, displayName: string, fallbackMessage: string, verificationToken: string | null, locale: string): Promise<LocalAuthSession> {
    const headers = verificationToken ? { Authorization: `Bearer ${verificationToken}` } : undefined;
    const response = await request<LocalAuthResponse>(apiUrl, "/auth/local/register", { method: "POST", body: JSON.stringify({ email, password, displayName }), headers }, fallbackMessage, locale);
    return { token: response.token, user: { uid: response.user.uid, email: response.user.email, phoneNumber: null, displayName: response.user.displayName } };
  },
  async signIn(apiUrl: string, identifier: string, password: string, fallbackMessage: string, locale: string): Promise<LocalAuthSession> {
    const response = await request<LocalAuthResponse>(apiUrl, "/auth/local/login", { method: "POST", body: JSON.stringify({ identifier, password }) }, fallbackMessage, locale);
    return { token: response.token, user: { uid: response.user.uid, email: response.user.email, phoneNumber: null, displayName: response.user.displayName } };
  },
  changePassword(apiUrl: string, token: string, password: string, fallbackMessage: string, locale: string): Promise<void> {
    return request<void>(apiUrl, "/auth/local/password", { method: "POST", body: JSON.stringify({ password }), headers: { Authorization: `Bearer ${token}` } }, fallbackMessage, locale);
  },
  updateDisplayName(apiUrl: string, token: string, displayName: string, fallbackMessage: string, locale: string): Promise<AuthUser> {
    return request<{ uid: string; email: string | null; displayName: string }>(apiUrl, "/auth/local/profile", { method: "PATCH", body: JSON.stringify({ displayName }), headers: { Authorization: `Bearer ${token}` } }, fallbackMessage, locale)
      .then((user) => ({ uid: user.uid, email: user.email, phoneNumber: null, displayName: user.displayName }));
  },
};
