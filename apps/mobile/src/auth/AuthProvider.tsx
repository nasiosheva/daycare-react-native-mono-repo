import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { ApiClient, ApiError, type ApiRequestLogEntry } from "@daycare/api-client";
import type { ChildGender, CurrentUser, ParentFamilyProfileInput } from "@daycare/core";
import { useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";
import { env } from "@/config/env";
import { useI18n } from "@/i18n/I18nProvider";
import { firebaseAuth } from "./firebase";
import { localAuth, type LocalAuthSession } from "./localAuth";
import { clearLocalSession, loadLocalSession, saveLocalSession } from "./localSessionStorage";
import { hasOrganizationMembership, requiresOrganizationSelection, selectedOrganizationId } from "./organizationContext";
import { profileForCurrentIdentity, profileIdentityChanged } from "./profileIdentity";
import type { AuthUser, PhoneChallenge } from "./types";

type AuthContextValue = {
  user: AuthUser | null;
  profile: CurrentUser | null;
  organizationId: string | null;
  requiresOrganizationSelection: boolean;
  loading: boolean;
  profileError: Error | null;
  usesPassword: boolean;
  registrationRequired: boolean;
  api: ApiClient;
  getRealtimeToken: () => Promise<string | null>;
  signInWithEmail: (identifier: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string, username?: string) => Promise<{ usernameWarning: string | null }>;
  signInWithGoogle: () => Promise<{ needsRegistration: boolean; email: string | null }>;
  sendPhoneCode: (phoneNumber: string) => Promise<PhoneChallenge>;
  verifyPhoneCode: (code: string) => Promise<{ needsRegistration: boolean }>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
  updatePersonalDetails: (gender: ChildGender, dateOfBirth: string) => Promise<void>;
  updateParentFamilyProfile: (input: ParentFamilyProfileInput) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  refreshProfile: () => Promise<CurrentUser>;
  selectOrganization: (organizationId: string) => boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
type FirebaseIdentityState = "idle" | "checking" | "existing" | "registrationRequired";
const localAndroidApiUrlPrefix = "http://localhost:";

function logLocalAndroidApi(entry: ApiRequestLogEntry) {
  const duration = entry.durationMs == null ? "" : ` ${entry.durationMs}ms`;
  const status = entry.status == null ? entry.failure ?? "" : String(entry.status);
  console.info(`[API] ${entry.phase} ${entry.method} ${entry.url}${status ? ` ${status}` : ""}${duration}`);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const { locale, t } = useI18n();
  const queryClient = useQueryClient();
  const [firebaseUser, setFirebaseUser] = useState<AuthUser | null>(null);
  const [firebaseProfile, setFirebaseProfile] = useState<CurrentUser | null>(null);
  const [localSession, setLocalSession] = useState<LocalAuthSession | null>(null);
  const [localSessionLoaded, setLocalSessionLoaded] = useState(false);
  const [firebaseObserved, setFirebaseObserved] = useState(false);
  const [firebaseIdentityState, setFirebaseIdentityState] = useState<FirebaseIdentityState>("idle");
  const [firebaseIdentityVersion, setFirebaseIdentityVersion] = useState(0);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [phoneChallenge, setPhoneChallenge] = useState<PhoneChallenge | null>(null);
  const [profileError, setProfileError] = useState<Error | null>(null);
  const [profileIdentityKey, setProfileIdentityKey] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const organizationIdRef = useRef<string | null>(null);
  organizationIdRef.current = organizationId;
  const loading = !localSessionLoaded || !firebaseObserved;
  const api = useMemo(() => new ApiClient({
    baseUrl: env.apiUrl,
    getToken: async () => localSession?.token ?? firebaseAuth.getIdToken(),
    getOrganizationId: () => organizationIdRef.current,
    getLanguage: () => locale,
    onRequestLog: Platform.OS === "android" && env.apiUrl.startsWith(localAndroidApiUrlPrefix) ? logLocalAndroidApi : undefined,
  }), [localSession, organizationId, locale]);
  const user = localSession?.user ?? firebaseUser;
  const profileLoadKey = isSigningOut ? null : localSession?.token ?? (firebaseUser && firebaseIdentityState === "existing" ? `firebase:${firebaseUser.uid}:${firebaseIdentityVersion}` : null);
  const profile = profileForCurrentIdentity(firebaseProfile, profileIdentityKey, profileLoadKey);
  const localSessionRef = useRef<LocalAuthSession | null>(null);
  localSessionRef.current = localSession;
  const rememberedOrganizationIdRef = useRef<string | null>(null);
  const observedProfileIdentityKeyRef = useRef<string | null | undefined>(undefined);
  const profileContextVersionRef = useRef(0);
  const profileRefreshPromiseRef = useRef<Promise<CurrentUser> | null>(null);
  const refreshProfileRef = useRef<(() => Promise<CurrentUser>) | null>(null);
  const clearScopedCache = useCallback(() => {
    queryClient.clear();
  }, [queryClient]);
  const clearProfileContext = useCallback((forgetOrganization = false) => {
    profileContextVersionRef.current += 1;
    profileRefreshPromiseRef.current = null;
    clearScopedCache();
    setFirebaseProfile(null);
    setProfileIdentityKey(null);
    organizationIdRef.current = null;
    setOrganizationId(null);
    if (forgetOrganization) rememberedOrganizationIdRef.current = null;
  }, [clearScopedCache]);

  useEffect(() => {
    if (profileIdentityChanged(observedProfileIdentityKeyRef.current, profileLoadKey)) {
      setProfileError(null);
      clearProfileContext(true);
    }
    observedProfileIdentityKeyRef.current = profileLoadKey;
  }, [clearProfileContext, profileLoadKey]);

  const refreshProfile = useCallback(() => {
    const pendingRefresh = profileRefreshPromiseRef.current;
    if (pendingRefresh) return pendingRefresh;
    setProfileError(null);
    const contextVersion = profileContextVersionRef.current;
    const identityKey = profileLoadKey;
    const profileRefresh = api.me()
      .then((nextProfile) => {
        if (contextVersion !== profileContextVersionRef.current) return nextProfile;
        const nextOrganizationId = selectedOrganizationId(nextProfile, organizationIdRef.current ?? rememberedOrganizationIdRef.current);
        clearScopedCache();
        setFirebaseProfile(nextProfile);
        setProfileIdentityKey(identityKey);
        organizationIdRef.current = nextOrganizationId;
        setOrganizationId(nextOrganizationId);
        rememberedOrganizationIdRef.current = nextOrganizationId;
        return nextProfile;
      })
      .catch((error: unknown) => {
        const failure = error instanceof Error ? error : new Error(t("auth.tryAgain"));
        if (contextVersion === profileContextVersionRef.current) {
          clearProfileContext();
          setProfileError(failure);
        }
        throw failure;
      })
      .finally(() => {
        if (profileRefreshPromiseRef.current === profileRefresh) profileRefreshPromiseRef.current = null;
      });
    profileRefreshPromiseRef.current = profileRefresh;
    return profileRefresh;
  }, [api, clearProfileContext, clearScopedCache, profileLoadKey, t]);

  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
  }, [refreshProfile]);

  useEffect(() => {
    let active = true;
    void loadLocalSession()
      .then((session) => { if (active) setLocalSession(session); })
      .catch(() => { if (active) setLocalSession(null); })
      .finally(() => { if (active) setLocalSessionLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => firebaseAuth.observe((nextUser) => {
    if (!localSessionRef.current) {
      setProfileError(null);
      clearProfileContext(true);
    }
    setFirebaseUser(nextUser);
    setFirebaseIdentityState(nextUser ? "idle" : "existing");
    setFirebaseIdentityVersion((current) => current + 1);
    setFirebaseObserved(true);
  }), [clearProfileContext]);

  useEffect(() => {
    if (!firebaseUser || localSession || firebaseIdentityState !== "idle") return;
    setFirebaseIdentityState("checking");
    void api.identityCheck()
      .then((status) => setFirebaseIdentityState(status.exists ? "existing" : "registrationRequired"))
      .catch((error: unknown) => {
        const failure = error instanceof Error ? error : new Error(t("auth.tryAgain"));
        setProfileError(failure);
        setFirebaseIdentityState("registrationRequired");
      });
  }, [api, firebaseIdentityState, firebaseUser, localSession, t]);

  useEffect(() => {
    if (!profileLoadKey) return;
    let active = true;
    void refreshProfileRef.current?.().catch((error: unknown) => {
      if (!active) return;
      if (!(error instanceof ApiError) || error.status !== 401) return;
      if (localSession) {
        void clearLocalSession().catch(() => undefined);
        setLocalSession(null);
      } else {
        void firebaseAuth.signOut();
      }
      clearProfileContext(true);
    });
    return () => { active = false; };
  }, [clearProfileContext, localSession, profileLoadKey]);

  const resolveFirebaseIdentity = async () => {
    setFirebaseIdentityState("checking");
    const status = await api.identityCheck();
    setFirebaseIdentityState(status.exists ? "existing" : "registrationRequired");
    return status;
  };

  const signInWithLocalCredentials = async (identifier: string, password: string) => {
    const session = await localAuth.signIn(env.apiUrl, identifier, password, t("common.error"), locale);
    await saveLocalSession(session);
    setIsSigningOut(false);
    setLocalSession(session);
  };
  const signUpWithLocalCredentials = async (email: string, password: string, displayName: string, username?: string) => {
    const verificationToken = firebaseIdentityState === "registrationRequired" ? await firebaseAuth.getIdToken() : null;
    const session = await localAuth.signUp(env.apiUrl, email, password, displayName, t("common.error"), verificationToken, locale);
    let usernameWarning: string | null = null;
    if (username?.trim()) {
      try {
        await new ApiClient({ baseUrl: env.apiUrl, getToken: async () => session.token, getOrganizationId: () => null, getLanguage: () => locale }).updateMyUsername(username.trim());
      } catch (error) {
        usernameWarning = error instanceof Error ? error.message : t("auth.tryAgain");
      }
    }
    await saveLocalSession(session);
    setIsSigningOut(false);
    setLocalSession(session);
    if (verificationToken) await firebaseAuth.signOut();
    return { usernameWarning };
  };

  const sendPhoneCode = async (phoneNumber: string) => {
    const challenge = await firebaseAuth.sendPhoneCode(phoneNumber);
    setPhoneChallenge(challenge);
    return challenge;
  };
  const verifyPhoneCode = async (code: string) => {
    if (!phoneChallenge) throw new Error(t("auth.otpUnavailable"));
    await phoneChallenge.confirmation(code);
    setPhoneChallenge(null);
    const status = await resolveFirebaseIdentity();
    return { needsRegistration: !status.exists };
  };
  const signInWithGoogle = async () => {
    await firebaseAuth.signInWithGoogle();
    const status = await resolveFirebaseIdentity();
    return { needsRegistration: !status.exists, email: status.email };
  };
  const signOut = async () => {
    setIsSigningOut(true);
    clearProfileContext(true);
    const localAccessToken = localSession?.token ?? null;
    const firebaseAccessToken = localAccessToken ? null : await firebaseAuth.getIdToken().catch(() => null);
    const accessToken = localAccessToken ?? firebaseAccessToken;
    if (accessToken) void api.logout(accessToken).catch(() => undefined);
    if (localSession) {
      setLocalSession(null);
      void clearLocalSession().catch(() => undefined);
    }
    setProfileError(null);
    await firebaseAuth.signOut().catch(() => undefined);
    setFirebaseUser(null);
    setFirebaseIdentityState("existing");
    setFirebaseIdentityVersion((current) => current + 1);
    setIsSigningOut(false);
  };
  const selectOrganization = useCallback((nextOrganizationId: string) => {
    if (!hasOrganizationMembership(profile, nextOrganizationId)) return false;
    if (nextOrganizationId === organizationId) return true;
    profileContextVersionRef.current += 1;
    profileRefreshPromiseRef.current = null;
    clearScopedCache();
    rememberedOrganizationIdRef.current = nextOrganizationId;
    organizationIdRef.current = nextOrganizationId;
    setOrganizationId(nextOrganizationId);
    return true;
  }, [clearScopedCache, organizationId, profile]);
  const updateDisplayName = async (displayName: string) => {
    const normalizedName = displayName.trim();
    if (!normalizedName) throw new Error(t("profile.name"));
    if (localSession) {
      const nextUser = await localAuth.updateDisplayName(env.apiUrl, localSession.token, normalizedName, t("common.error"), locale);
      const nextSession = { ...localSession, user: nextUser };
      await saveLocalSession(nextSession);
      setLocalSession(nextSession);
      setFirebaseProfile((current) => current ? { ...current, displayName: normalizedName } : current);
      return;
    }
    setFirebaseUser(await firebaseAuth.updateDisplayName(normalizedName));
    setFirebaseProfile((current) => current ? { ...current, displayName: normalizedName } : current);
    await firebaseAuth.getIdToken(true);
    await refreshProfile().catch(() => undefined);
  };
  const updatePersonalDetails = async (gender: ChildGender, dateOfBirth: string) => {
    const nextProfile = await api.updateMyProfile({ gender, dateOfBirth });
    setFirebaseProfile(nextProfile);
  };
  const updateUsername = async (username: string) => {
    const nextProfile = await api.updateMyUsername(username.trim() || undefined);
    setFirebaseProfile(nextProfile);
  };
  const updateParentFamilyProfile = async (input: ParentFamilyProfileInput) => {
    const parentFamilyProfile = await api.updateParentFamilyProfile(input);
    setFirebaseProfile((current) => current ? { ...current, parentFamilyProfile } : current);
  };
  const changePassword = async (newPassword: string) => {
    if (!localSession) throw new Error(t("auth.passwordUnavailable"));
    await localAuth.changePassword(env.apiUrl, localSession.token, newPassword, t("common.error"), locale);
  };
  const getRealtimeToken = useCallback(async () => localSession?.token ?? firebaseAuth.getIdToken(), [localSession]);
  const needsOrganizationSelection = requiresOrganizationSelection(profile, organizationId);
  const value: AuthContextValue = {
    user,
    profile,
    organizationId,
    requiresOrganizationSelection: needsOrganizationSelection,
    loading,
    profileError,
    usesPassword: Boolean(localSession),
    registrationRequired: firebaseIdentityState === "registrationRequired",
    api,
    getRealtimeToken,
    signInWithEmail: signInWithLocalCredentials,
    signUpWithEmail: signUpWithLocalCredentials,
    signInWithGoogle,
    sendPhoneCode,
    verifyPhoneCode,
    updateDisplayName,
    updateUsername,
    updatePersonalDetails,
    updateParentFamilyProfile,
    changePassword,
    refreshProfile,
    selectOrganization,
    signOut,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
