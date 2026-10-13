// Mories Deo Hutapea,S.E.,S.Kom
import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "@daycare/api-client";
import { AuthProvider, useAuth } from "./AuthProvider";
import type { AuthUser } from "./types";

const mocks = vi.hoisted(() => {
  const api = {
    me: vi.fn(),
    identityCheck: vi.fn(),
    logout: vi.fn(),
    updateMyUsername: vi.fn(),
    updateMyProfile: vi.fn(),
    updateParentFamilyProfile: vi.fn(),
  };
  const firebaseAuth = {
    observe: vi.fn(),
    getIdToken: vi.fn(),
    signOut: vi.fn(),
    signInWithGoogle: vi.fn(),
    sendPhoneCode: vi.fn(),
    updateDisplayName: vi.fn(),
  };
  const localAuth = {
    signIn: vi.fn(),
    signUp: vi.fn(),
    changePassword: vi.fn(),
    updateDisplayName: vi.fn(),
  };
  return {
    api,
    firebaseAuth,
    localAuth,
    queryClient: { clear: vi.fn() },
    loadLocalSession: vi.fn(),
    saveLocalSession: vi.fn(),
    clearLocalSession: vi.fn(),
    cancelOperationalCloseReminderSchedules: vi.fn(),
    markNetworkOffline: vi.fn(),
    markNetworkOnline: vi.fn(),
    locale: "id",
    t: (key: string) => key,
    platformOS: "web",
    apiUrl: "https://api.example.test/api/v1",
    observeIdentity: undefined as ((user: AuthUser | null) => void) | undefined,
  };
});

vi.mock("@daycare/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@daycare/api-client")>();
  return { ...actual, ApiClient: vi.fn().mockImplementation(() => mocks.api) };
});
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => mocks.queryClient }));
vi.mock("react-native", () => ({ Platform: { get OS() { return mocks.platformOS; } } }));
vi.mock("@/config/env", () => ({ env: { get apiUrl() { return mocks.apiUrl; } } }));
vi.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ locale: mocks.locale, t: mocks.t }) }));
vi.mock("./firebase", () => ({ firebaseAuth: mocks.firebaseAuth }));
vi.mock("./localAuth", () => ({ localAuth: mocks.localAuth }));
vi.mock("./localSessionStorage", () => ({
  loadLocalSession: mocks.loadLocalSession,
  saveLocalSession: mocks.saveLocalSession,
  clearLocalSession: mocks.clearLocalSession,
}));
vi.mock("@/reminders/operationalCloseReminderScheduler", () => ({ cancelOperationalCloseReminderSchedules: mocks.cancelOperationalCloseReminderSchedules }));
vi.mock("@/offline/networkSignal", () => ({ markNetworkOffline: mocks.markNetworkOffline, markNetworkOnline: mocks.markNetworkOnline }));

type Profile = {
  id: string;
  displayName: string;
  gender: "UNSPECIFIED";
  isPlatformAdmin: boolean;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    role: "STAFF" | "PARENT";
    active: boolean;
    canManageChildPrograms: boolean;
    canManageDevelopmentCategories: boolean;
    institutionTypes: [];
    capabilities: [];
  }>;
};

function makeProfile(organizationIds: string[] = ["tenant-1"]): Profile {
  return {
    id: "profile-1",
    displayName: "Nasia",
    gender: "UNSPECIFIED",
    isPlatformAdmin: false,
    memberships: organizationIds.map((organizationId, index) => ({
      organizationId,
      organizationName: organizationId,
      role: "STAFF",
      active: index === 0,
      canManageChildPrograms: false,
      canManageDevelopmentCategories: false,
      institutionTypes: [],
      capabilities: [],
    })),
  };
}

const firebaseUser: AuthUser = { uid: "firebase-user", email: "parent@example.test", phoneNumber: null, displayName: "Parent" };
const localSession = { token: "local-token", user: { uid: "local-user", email: "staff@example.test", phoneNumber: null, displayName: "Staff" } };
const mounted = new Set<ReturnType<typeof create>>();
let currentAuth: ReturnType<typeof useAuth> | null = null;

function AuthValueCapture() {
  currentAuth = useAuth();
  return null;
}

function renderAuthProvider() {
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(<AuthProvider><AuthValueCapture /></AuthProvider>);
  });
  mounted.add(renderer);
  return {
    unmount: () => {
      mounted.delete(renderer);
      act(() => renderer.unmount());
    },
  };
}

async function flushEffects() {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

function authValue() {
  if (!currentAuth) throw new Error("AuthProvider did not render its context value");
  return currentAuth;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("React", React);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    mocks.platformOS = "web";
    mocks.locale = "id";
    mocks.queryClient.clear.mockReset();
    mocks.loadLocalSession.mockResolvedValue(null);
    mocks.saveLocalSession.mockResolvedValue(undefined);
    mocks.clearLocalSession.mockResolvedValue(undefined);
    mocks.cancelOperationalCloseReminderSchedules.mockResolvedValue(undefined);
    mocks.firebaseAuth.observe.mockImplementation((listener: (user: AuthUser | null) => void) => {
      mocks.observeIdentity = listener;
      listener(null);
      return vi.fn();
    });
    mocks.firebaseAuth.getIdToken.mockResolvedValue("firebase-token");
    mocks.firebaseAuth.signOut.mockResolvedValue(undefined);
    mocks.firebaseAuth.signInWithGoogle.mockResolvedValue(undefined);
    mocks.api.me.mockResolvedValue(makeProfile());
    mocks.api.identityCheck.mockResolvedValue({ exists: true, email: "parent@example.test" });
    mocks.api.logout.mockResolvedValue(undefined);
    mocks.localAuth.signIn.mockResolvedValue(localSession);
    mocks.localAuth.signUp.mockResolvedValue(localSession);
    currentAuth = null;
  });

  afterEach(() => {
    for (const renderer of mounted) act(() => renderer.unmount());
    mounted.clear();
    vi.unstubAllGlobals();
  });

  it("loads a local session and scopes API tokens to that session", async () => {
    mocks.loadLocalSession.mockResolvedValue(localSession);
    const rendered = renderAuthProvider();
    await flushEffects();

    expect(authValue()).toMatchObject({ user: localSession.user, usesPassword: true, loading: false, profile: makeProfile(), organizationId: "tenant-1" });
    expect(mocks.api.me).toHaveBeenCalledOnce();
    expect(mocks.queryClient.clear).toHaveBeenCalled();
    rendered.unmount();
  });

  it("signs in with local credentials and supports local profile and password updates", async () => {
    const rendered = renderAuthProvider();
    await flushEffects();

    await act(async () => authValue().signInWithEmail("staff@example.test", "password"));
    await flushEffects();
    expect(mocks.localAuth.signIn).toHaveBeenCalledWith(mocks.apiUrl, "staff@example.test", "password", "common.error", "id");
    expect(mocks.saveLocalSession).toHaveBeenCalledWith(localSession);
    expect(await authValue().getRealtimeToken()).toBe("local-token");

    mocks.localAuth.updateDisplayName.mockResolvedValue({ ...localSession.user, displayName: "Updated" });
    mocks.api.updateMyProfile.mockResolvedValue(makeProfile());
    mocks.api.updateMyUsername.mockResolvedValue(makeProfile());
    mocks.api.updateParentFamilyProfile.mockResolvedValue({ familyName: "Family" });
    await act(async () => {
      await authValue().updateDisplayName("  Updated  ");
      await authValue().updatePersonalDetails("FEMALE", "1990-01-01");
      await authValue().updateUsername("  staff  ");
      await authValue().updateParentFamilyProfile({} as never);
      await authValue().changePassword("new-password");
    });

    expect(mocks.localAuth.updateDisplayName).toHaveBeenCalledWith(mocks.apiUrl, "local-token", "Updated", "common.error", "id");
    expect(mocks.api.updateMyProfile).toHaveBeenCalledWith({ gender: "FEMALE", dateOfBirth: "1990-01-01" });
    expect(mocks.api.updateMyUsername).toHaveBeenCalledWith("staff");
    expect(mocks.api.updateParentFamilyProfile).toHaveBeenCalledOnce();
    expect(mocks.localAuth.changePassword).toHaveBeenCalledWith(mocks.apiUrl, "local-token", "new-password", "common.error", "id");
    rendered.unmount();
  });

  it("returns a username warning when signup completes but the optional username update fails", async () => {
    mocks.api.identityCheck.mockResolvedValue({ exists: false, email: firebaseUser.email });
    mocks.api.updateMyUsername.mockRejectedValueOnce("username service unavailable");
    const rendered = renderAuthProvider();
    await flushEffects();
    await act(async () => mocks.observeIdentity?.(firebaseUser));
    await flushEffects();
    mocks.firebaseAuth.getIdToken.mockResolvedValue("verification-token");

    let result: { usernameWarning: string | null } | undefined;
    await act(async () => { result = await authValue().signUpWithEmail("staff@example.test", "password", "Staff", " staff "); });
    await flushEffects();

    expect(mocks.localAuth.signUp).toHaveBeenCalledWith(mocks.apiUrl, "staff@example.test", "password", "Staff", "common.error", "verification-token", "id");
    expect(mocks.firebaseAuth.signOut).toHaveBeenCalledOnce();
    expect(result).toEqual({ usernameWarning: "auth.tryAgain" });
    expect(authValue().usesPassword).toBe(true);
    rendered.unmount();
  });

  it("signs up without a username when no linked Firebase identity needs verification", async () => {
    const rendered = renderAuthProvider();
    await flushEffects();

    await act(async () => { await expect(authValue().signUpWithEmail("staff@example.test", "password", "Staff")).resolves.toEqual({ usernameWarning: null }); });

    expect(mocks.localAuth.signUp).toHaveBeenCalledWith(mocks.apiUrl, "staff@example.test", "password", "Staff", "common.error", null, "id");
    expect(mocks.api.updateMyUsername).not.toHaveBeenCalled();
    expect(mocks.firebaseAuth.signOut).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it("checks Firebase identity and exposes registration-required state for a new account", async () => {
    mocks.api.identityCheck.mockResolvedValue({ exists: false, email: firebaseUser.email });
    const rendered = renderAuthProvider();
    await flushEffects();
    await act(async () => mocks.observeIdentity?.(firebaseUser));
    await flushEffects();

    expect(mocks.api.identityCheck).toHaveBeenCalledOnce();
    expect(authValue()).toMatchObject({ user: firebaseUser, profile: null, registrationRequired: true });
    await act(async () => {
      await expect(authValue().signInWithGoogle()).resolves.toEqual({ needsRegistration: true, email: firebaseUser.email });
    });
    rendered.unmount();
  });

  it("exposes Firebase identity-check failures without treating them as a linked account", async () => {
    mocks.api.identityCheck.mockRejectedValue(new Error("identity service unavailable"));
    const rendered = renderAuthProvider();
    await flushEffects();
    await act(async () => mocks.observeIdentity?.(firebaseUser));
    await flushEffects();

    expect(authValue()).toMatchObject({ user: firebaseUser, profile: null, registrationRequired: true });
    expect(authValue().profileError).toMatchObject({ message: "identity service unavailable" });
    rendered.unmount();
  });

  it("sends and verifies phone challenges before checking the account identity", async () => {
    const challenge = { confirmation: vi.fn().mockResolvedValue(undefined) };
    mocks.firebaseAuth.sendPhoneCode.mockResolvedValue(challenge);
    mocks.api.identityCheck.mockResolvedValue({ exists: true, email: "parent@example.test" });
    const rendered = renderAuthProvider();
    await flushEffects();

    await expect(authValue().verifyPhoneCode("123456")).rejects.toThrow("auth.otpUnavailable");
    await act(async () => expect(authValue().sendPhoneCode("+628123")).resolves.toBe(challenge));
    let result: { needsRegistration: boolean } | undefined;
    await act(async () => { result = await authValue().verifyPhoneCode("123456"); });

    expect(challenge.confirmation).toHaveBeenCalledWith("123456");
    expect(mocks.api.identityCheck).toHaveBeenCalledOnce();
    expect(result).toEqual({ needsRegistration: false });
    rendered.unmount();
  });

  it("requires an organization choice for multi-tenant staff and only accepts memberships", async () => {
    mocks.api.me.mockResolvedValue(makeProfile(["tenant-1", "tenant-2"]));
    const rendered = renderAuthProvider();
    await flushEffects();
    await act(async () => mocks.observeIdentity?.(firebaseUser));
    await flushEffects();

    expect(authValue()).toMatchObject({ requiresOrganizationSelection: true, organizationId: null });
    const cacheClearCount = mocks.queryClient.clear.mock.calls.length;
    await act(async () => expect(authValue().selectOrganization("tenant-missing")).toBe(false));
    expect(mocks.queryClient.clear).toHaveBeenCalledTimes(cacheClearCount);
    await act(async () => expect(authValue().selectOrganization("tenant-2")).toBe(true));
    expect(authValue()).toMatchObject({ requiresOrganizationSelection: false, organizationId: "tenant-2" });
    expect(mocks.queryClient.clear).toHaveBeenCalledTimes(cacheClearCount + 1);
    rendered.unmount();
  });

  it("deduplicates concurrent profile refreshes and clears scoped cache after success", async () => {
    const render = renderAuthProvider();
    await flushEffects();
    await act(async () => mocks.observeIdentity?.(firebaseUser));
    await flushEffects();
    mocks.api.me.mockClear();
    let resolveProfile!: (profile: Profile) => void;
    mocks.api.me.mockReturnValueOnce(new Promise<Profile>((resolve) => { resolveProfile = resolve; }));

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      first = authValue().refreshProfile();
      second = authValue().refreshProfile();
      resolveProfile(makeProfile());
      await Promise.all([first, second]);
    });

    expect(first).toBe(second);
    expect(mocks.api.me).toHaveBeenCalledOnce();
    expect(mocks.queryClient.clear).toHaveBeenCalled();
    render.unmount();
  });

  it("clears a local session and auth scope on sign out", async () => {
    mocks.loadLocalSession.mockResolvedValue(localSession);
    const rendered = renderAuthProvider();
    await flushEffects();
    mocks.queryClient.clear.mockClear();

    await act(async () => authValue().signOut());
    await flushEffects();

    expect(mocks.api.logout).toHaveBeenCalledWith("local-token");
    expect(mocks.clearLocalSession).toHaveBeenCalledOnce();
    expect(mocks.firebaseAuth.signOut).toHaveBeenCalledOnce();
    expect(mocks.cancelOperationalCloseReminderSchedules).toHaveBeenCalledOnce();
    expect(mocks.queryClient.clear).toHaveBeenCalled();
    expect(authValue()).toMatchObject({ user: null, profile: null, organizationId: null, usesPassword: false, loading: false });
    rendered.unmount();
  });

  it("rejects invalid profile updates and requires a local account for password changes", async () => {
    const rendered = renderAuthProvider();
    await flushEffects();

    await expect(authValue().updateDisplayName("   ")).rejects.toThrow("profile.name");
    await expect(authValue().changePassword("new-password")).rejects.toThrow("auth.passwordUnavailable");
    rendered.unmount();
  });

  it("updates the Firebase display name and refreshes the authenticated profile", async () => {
    mocks.firebaseAuth.updateDisplayName.mockResolvedValue({ ...firebaseUser, displayName: "Nama baru" });
    const rendered = renderAuthProvider();
    await flushEffects();
    await act(async () => mocks.observeIdentity?.(firebaseUser));
    await flushEffects();

    await act(async () => authValue().updateDisplayName(" Nama baru "));
    expect(mocks.firebaseAuth.updateDisplayName).toHaveBeenCalledWith("Nama baru");
    expect(mocks.firebaseAuth.getIdToken).toHaveBeenCalledWith(true);
    expect(mocks.api.me).toHaveBeenCalledTimes(2);
    rendered.unmount();
  });

  it("enables local Android API request logging only for localhost builds", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    mocks.platformOS = "android";
    mocks.apiUrl = "http://localhost:8080/api/v1";
    const rendered = renderAuthProvider();
    await flushEffects();

    const options = vi.mocked(ApiClient).mock.calls.at(-1)?.[0];
    expect(options?.onRequestLog).toBeTypeOf("function");
    options?.onRequestLog?.({ phase: "RESPONSE", method: "GET", url: "http://localhost:8080/api/v1/me", status: 200, durationMs: 12 });
    expect(log).toHaveBeenCalledWith("[API] RESPONSE GET http://localhost:8080/api/v1/me 200 12ms");
    log.mockRestore();
    rendered.unmount();
  });

  it("normalizes a failed profile load and exposes its error instead of stale profile data", async () => {
    mocks.loadLocalSession.mockResolvedValue(localSession);
    mocks.api.me.mockRejectedValue("offline");
    const rendered = renderAuthProvider();
    await flushEffects();

    expect(authValue().profile).toBeNull();
    expect(authValue().profileError).toBeInstanceOf(Error);
    expect(mocks.queryClient.clear).toHaveBeenCalled();
    rendered.unmount();
  });

  it("uses refreshed Firebase tokens for local logout only when no local token exists", async () => {
    const rendered = renderAuthProvider();
    await flushEffects();
    await act(async () => mocks.observeIdentity?.(firebaseUser));
    await flushEffects();

    await act(async () => authValue().signOut());

    expect(mocks.firebaseAuth.getIdToken).toHaveBeenCalled();
    expect(mocks.api.logout).toHaveBeenCalledWith("firebase-token");
    rendered.unmount();
  });

  it("signs out a Firebase session when its profile request returns unauthorized", async () => {
    mocks.api.me.mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "Unauthorized"));
    const rendered = renderAuthProvider();
    await flushEffects();
    await act(async () => mocks.observeIdentity?.(firebaseUser));
    await flushEffects();

    expect(mocks.firebaseAuth.signOut).toHaveBeenCalled();
    expect(authValue().profile).toBeNull();
    rendered.unmount();
  });

  it("cleans up the Firebase observer when the provider unmounts", async () => {
    const unsubscribe = vi.fn();
    mocks.firebaseAuth.observe.mockImplementation((listener: (user: AuthUser | null) => void) => {
      mocks.observeIdentity = listener;
      listener(null);
      return unsubscribe;
    });
    const rendered = renderAuthProvider();
    await flushEffects();

    rendered.unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
