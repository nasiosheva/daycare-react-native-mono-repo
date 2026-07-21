import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { ApiClient } from "@daycare/api-client";
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
  isSimulationSession: boolean;
  api: ApiClient;
  signInWithEmail: (email: string, password: string) => Promise<void>;
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
  const api = useMemo(() => new ApiClient({
    baseUrl: env.apiUrl,
    getToken: async () => env.isLocalAuth ? localSession?.token ?? null : firebaseAuth.getIdToken(),
    getOrganizationId: () => organizationId,
    getLanguage: () => locale,
  }), [localSession, organizationId, locale]);
  const user = simulationSession?.user ?? localSession?.user ?? firebaseUser;
  const profile = simulationSession?.profile ?? firebaseProfile;

  const refreshProfile = useCallback(async () => {
    const nextProfile = await api.me();
    setFirebaseProfile(nextProfile);
    setOrganizationId((current) => current ?? nextProfile.memberships[0]?.organizationId ?? null);
  }, [api]);

  useEffect(() => {
    if (env.isLocalAuth) {
      let active = true;
      void loadLocalSession().then((session) => {
        if (!active) return;
        setLocalSession(session);
        setLoading(false);
      });
      return () => { active = false; };
    }

    return firebaseAuth.observe((nextUser) => {
      setFirebaseUser(nextUser);
      setFirebaseProfile(null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if ((localSession || firebaseUser) && !simulationSession) void refreshProfile();
  }, [firebaseUser, localSession, refreshProfile, simulationSession]);

  const signInWithLocalCredentials = async (identifier: string, password: string) => {
    const session = await localAuth.signIn(env.apiUrl, identifier, password);
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
      return;
    }
    if (env.isLocalAuth) {
      await clearLocalSession();
      setLocalSession(null);
      setFirebaseProfile(null);
      setOrganizationId(null);
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
      const user = await localAuth.updateDisplayName(env.apiUrl, localSession.token, normalizedName);
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
      await localAuth.changePassword(env.apiUrl, localSession.token, newPassword);
      return;
    }
    await firebaseAuth.changePassword(newPassword);
  };
  const value = { user, profile, organizationId, loading, isSimulationSession: Boolean(simulationSession), api, signInWithEmail: env.isLocalAuth ? signInWithLocalCredentials : firebaseAuth.signInWithEmail, signInWithGoogle: firebaseAuth.signInWithGoogle, sendPhoneCode, verifyPhoneCode, updateDisplayName, changePassword, refreshProfile, signInAsSimulationRole, selectOrganization: setOrganizationId, signOut };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
