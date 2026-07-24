import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { ApiClient, ApiError } from "@daycare/api-client";
import type { CurrentUser, Role } from "@daycare/core";
import { env } from "@/config/env";
import { useI18n } from "@/i18n/I18nProvider";
import { firebaseAuth } from "./firebase";
import { localAuth, type LocalAuthSession } from "./localAuth";
import { clearLocalSession, loadLocalSession, saveLocalSession } from "./localSessionStorage";
import { createSimulationSession, type SimulationSession } from "./simulation";
import type { AuthUser, PhoneChallenge } from "./types";

type AuthContextValue = {
  user: AuthUser | null;
  profile: CurrentUser | null;
  organizationId: string | null;
  loading: boolean;
  profileError: Error | null;
  isSimulationSession: boolean;
  api: ApiClient;
  getRealtimeToken: () => Promise<string | null>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPhoneCode: (phoneNumber: string) => Promise<PhoneChallenge>;
  verifyPhoneCode: (code: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signInAsSimulationRole: (role: Role) => void;
  selectOrganization: (organizationId: string) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const { locale, t } = useI18n();
  const [firebaseUser, setFirebaseUser] = useState<AuthUser | null>(null);
  const [firebaseProfile, setFirebaseProfile] = useState<CurrentUser | null>(null);
  const [localSession, setLocalSession] = useState<LocalAuthSession | null>(null);
  const [simulationSession, setSimulationSession] = useState<SimulationSession | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [phoneChallenge, setPhoneChallenge] = useState<PhoneChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<Error | null>(null);
  const api = useMemo(() => new ApiClient({
    baseUrl: env.apiUrl,
    getToken: async () => env.isLocalAuth ? localSession?.token ?? null : firebaseAuth.getIdToken(),
    getOrganizationId: () => organizationId,
    getLanguage: () => locale,
  }), [localSession, organizationId, locale]);
  const user = simulationSession?.user ?? localSession?.user ?? firebaseUser;
  const profile = simulationSession?.profile ?? firebaseProfile;

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
    if (env.isLocalAuth) {
      let active = true;
      void loadLocalSession()
        .then((session) => {
          if (!active) return;
          setLocalSession(session);
        })
        .catch(() => {
          if (!active) return;
          setLocalSession(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => { active = false; };
    }

    return firebaseAuth.observe((nextUser) => {
      setFirebaseUser(nextUser);
      setFirebaseProfile(null);
      setProfileError(null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!(localSession || firebaseUser) || simulationSession) return;
    void refreshProfile().catch((error: unknown) => {
      if (!(error instanceof ApiError) || error.status !== 401) return;
      if (env.isLocalAuth) {
        void clearLocalSession().catch(() => undefined);
        setLocalSession(null);
      } else void firebaseAuth.signOut();
      setFirebaseProfile(null);
      setOrganizationId(null);
    });
  }, [firebaseUser, localSession, refreshProfile, simulationSession]);

  const signInWithLocalCredentials = async (identifier: string, password: string) => {
    const session = await localAuth.signIn(env.apiUrl, identifier, password, t("common.error"));
    await saveLocalSession(session);
    setLocalSession(session);
  };
  const signUpWithLocalCredentials = async (email: string, password: string, displayName: string) => {
    const session = await localAuth.signUp(env.apiUrl, email, password, displayName, t("common.error"));
    await saveLocalSession(session);
    setLocalSession(session);
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
  };
  const signInAsSimulationRole = (role: Role) => {
    if (!env.isSimulation) throw new Error(t("auth.signInFailed"));
    const session = createSimulationSession(role);
    setSimulationSession(session);
    setOrganizationId(session.profile.memberships[0].organizationId);
  };
  const signOut = async () => {
    if (simulationSession) {
      setSimulationSession(null);
      setOrganizationId(null);
      setProfileError(null);
      return;
    }
    if (env.isLocalAuth) {
      await clearLocalSession();
      setLocalSession(null);
      setFirebaseProfile(null);
      setOrganizationId(null);
      setProfileError(null);
      return;
    }
    await firebaseAuth.signOut();
  };
  const updateDisplayName = async (displayName: string) => {
    const normalizedName = displayName.trim();
    if (!normalizedName) throw new Error(t("profile.name"));
    if (simulationSession) {
      setSimulationSession({ ...simulationSession, user: { ...simulationSession.user, displayName: normalizedName }, profile: { ...simulationSession.profile, displayName: normalizedName } });
      return;
    }
    if (env.isLocalAuth) {
      if (!localSession) throw new Error(t("auth.signInFailed"));
      const user = await localAuth.updateDisplayName(env.apiUrl, localSession.token, normalizedName, t("common.error"));
      const nextSession = { ...localSession, user };
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
  const changePassword = async (newPassword: string) => {
    if (simulationSession) throw new Error(t("profile.passwordSimulation"));
    if (env.isLocalAuth) {
      if (!localSession) throw new Error(t("auth.signInFailed"));
      await localAuth.changePassword(env.apiUrl, localSession.token, newPassword, t("common.error"));
      return;
    }
    await firebaseAuth.changePassword(newPassword);
  };
  const getRealtimeToken = useCallback(async () => {
    if (simulationSession) return null;
    return env.isLocalAuth ? localSession?.token ?? null : firebaseAuth.getIdToken();
  }, [localSession, simulationSession]);
  const value = { user, profile, organizationId, loading, profileError, isSimulationSession: Boolean(simulationSession), api, getRealtimeToken, signInWithEmail: env.isLocalAuth ? signInWithLocalCredentials : firebaseAuth.signInWithEmail, signUpWithEmail: env.isLocalAuth ? signUpWithLocalCredentials : firebaseAuth.signUpWithEmail, signInWithGoogle: firebaseAuth.signInWithGoogle, sendPhoneCode, verifyPhoneCode, updateDisplayName, changePassword, refreshProfile, signInAsSimulationRole, selectOrganization: setOrganizationId, signOut };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
