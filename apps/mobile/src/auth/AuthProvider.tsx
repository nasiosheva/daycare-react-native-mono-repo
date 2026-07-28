import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { ApiClient, ApiError, type ApiRequestLogEntry } from "@daycare/api-client";
import type { ChildGender, CurrentUser, ParentFamilyProfileInput } from "@daycare/core";
import { Platform } from "react-native";
import { env } from "@/config/env";
import { useI18n } from "@/i18n/I18nProvider";
import { firebaseAuth } from "./firebase";
import { localAuth, type LocalAuthSession } from "./localAuth";
import { clearLocalSession, loadLocalSession, saveLocalSession } from "./localSessionStorage";
import type { AuthUser, PhoneChallenge } from "./types";

type AuthContextValue = {
  user: AuthUser | null;
  profile: CurrentUser | null;
  organizationId: string | null;
  loading: boolean;
  profileError: Error | null;
  usesPassword: boolean;
  registrationRequired: boolean;
  api: ApiClient;
  getRealtimeToken: () => Promise<string | null>;
  signInWithEmail: (identifier: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<{ needsRegistration: boolean; email: string | null }>;
  sendPhoneCode: (phoneNumber: string) => Promise<PhoneChallenge>;
  verifyPhoneCode: (code: string) => Promise<{ needsRegistration: boolean }>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updatePersonalDetails: (gender: ChildGender, dateOfBirth: string) => Promise<void>;
  updateParentFamilyProfile: (input: ParentFamilyProfileInput) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  selectOrganization: (organizationId: string) => void;
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
  const [firebaseUser, setFirebaseUser] = useState<AuthUser | null>(null);
  const [firebaseProfile, setFirebaseProfile] = useState<CurrentUser | null>(null);
  const [localSession, setLocalSession] = useState<LocalAuthSession | null>(null);
  const [localSessionLoaded, setLocalSessionLoaded] = useState(false);
  const [firebaseObserved, setFirebaseObserved] = useState(false);
  const [firebaseIdentityState, setFirebaseIdentityState] = useState<FirebaseIdentityState>("idle");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [phoneChallenge, setPhoneChallenge] = useState<PhoneChallenge | null>(null);
  const [profileError, setProfileError] = useState<Error | null>(null);
  const loading = !localSessionLoaded || !firebaseObserved;
  const api = useMemo(() => new ApiClient({
    baseUrl: env.apiUrl,
    getToken: async () => localSession?.token ?? firebaseAuth.getIdToken(),
    getOrganizationId: () => organizationId,
    getLanguage: () => locale,
    onRequestLog: Platform.OS === "android" && env.apiUrl.startsWith(localAndroidApiUrlPrefix) ? logLocalAndroidApi : undefined,
  }), [localSession, organizationId, locale]);
  const user = localSession?.user ?? firebaseUser;

  const refreshProfile = useCallback(async () => {
    setProfileError(null);
    try {
      const nextProfile = await api.me();
      setFirebaseProfile(nextProfile);
      setOrganizationId((current) => current ?? nextProfile.memberships[0]?.organizationId ?? null);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(t("auth.tryAgain"));
      setProfileError(failure);
      throw failure;
    }
  }, [api, t]);

  useEffect(() => {
    let active = true;
    void loadLocalSession()
      .then((session) => { if (active) setLocalSession(session); })
      .catch(() => { if (active) setLocalSession(null); })
      .finally(() => { if (active) setLocalSessionLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => firebaseAuth.observe((nextUser) => {
    setFirebaseUser(nextUser);
    setFirebaseIdentityState(nextUser ? "idle" : "existing");
    setFirebaseObserved(true);
  }), []);

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
    if (!(localSession || (firebaseUser && firebaseIdentityState === "existing"))) return;
    void refreshProfile().catch((error: unknown) => {
      if (!(error instanceof ApiError) || error.status !== 401) return;
      if (localSession) {
        void clearLocalSession().catch(() => undefined);
        setLocalSession(null);
      } else {
        void firebaseAuth.signOut();
      }
      setFirebaseProfile(null);
      setOrganizationId(null);
    });
  }, [firebaseIdentityState, firebaseUser, localSession, refreshProfile]);

  const resolveFirebaseIdentity = async () => {
    setFirebaseIdentityState("checking");
    const status = await api.identityCheck();
    setFirebaseIdentityState(status.exists ? "existing" : "registrationRequired");
    return status;
  };

  const signInWithLocalCredentials = async (identifier: string, password: string) => {
    const session = await localAuth.signIn(env.apiUrl, identifier, password, t("common.error"));
    await saveLocalSession(session);
    setLocalSession(session);
  };
  const signUpWithLocalCredentials = async (email: string, password: string, displayName: string) => {
    const verificationToken = firebaseIdentityState === "registrationRequired" ? await firebaseAuth.getIdToken() : null;
    const session = await localAuth.signUp(env.apiUrl, email, password, displayName, t("common.error"), verificationToken);
    await saveLocalSession(session);
    setLocalSession(session);
    if (verificationToken) await firebaseAuth.signOut();
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
    const localAccessToken = localSession?.token ?? null;
    const firebaseAccessToken = localAccessToken ? null : await firebaseAuth.getIdToken().catch(() => null);
    const accessToken = localAccessToken ?? firebaseAccessToken;
    if (accessToken) void api.logout(accessToken).catch(() => undefined);
    if (localSession) {
      setLocalSession(null);
      void clearLocalSession().catch(() => undefined);
    }
    setFirebaseProfile(null);
    setOrganizationId(null);
    setProfileError(null);
    await firebaseAuth.signOut().catch(() => undefined);
  };
  const updateDisplayName = async (displayName: string) => {
    const normalizedName = displayName.trim();
    if (!normalizedName) throw new Error(t("profile.name"));
    if (localSession) {
      const nextUser = await localAuth.updateDisplayName(env.apiUrl, localSession.token, normalizedName, t("common.error"));
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
  const updateParentFamilyProfile = async (input: ParentFamilyProfileInput) => {
    const parentFamilyProfile = await api.updateParentFamilyProfile(input);
    setFirebaseProfile((current) => current ? { ...current, parentFamilyProfile } : current);
  };
  const changePassword = async (newPassword: string) => {
    if (!localSession) throw new Error(t("auth.passwordUnavailable"));
    await localAuth.changePassword(env.apiUrl, localSession.token, newPassword, t("common.error"));
  };
  const getRealtimeToken = useCallback(async () => localSession?.token ?? firebaseAuth.getIdToken(), [localSession]);
  const value: AuthContextValue = {
    user,
    profile: firebaseProfile,
    organizationId,
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
    updatePersonalDetails,
    updateParentFamilyProfile,
    changePassword,
    refreshProfile,
    selectOrganization: setOrganizationId,
    signOut,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
