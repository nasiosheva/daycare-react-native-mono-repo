import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { ApiClient } from "@daycare/api-client";
import type { CurrentUser } from "@daycare/core";
import { env } from "@/config/env";
import { firebaseAuth } from "./firebase";
import type { AuthUser, PhoneChallenge } from "./types";

type AuthContextValue = {
  user: AuthUser | null;
  profile: CurrentUser | null;
  organizationId: string | null;
  loading: boolean;
  api: ApiClient;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPhoneCode: (phoneNumber: string) => Promise<PhoneChallenge>;
  verifyPhoneCode: (code: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  selectOrganization: (organizationId: string) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<CurrentUser | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [phoneChallenge, setPhoneChallenge] = useState<PhoneChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const api = useMemo(() => new ApiClient({ baseUrl: env.apiUrl, getToken: firebaseAuth.getIdToken, getOrganizationId: () => organizationId }), [organizationId]);

  const refreshProfile = async () => {
    const nextProfile = await api.me();
    setProfile(nextProfile);
    setOrganizationId((current) => current ?? nextProfile.memberships[0]?.organizationId ?? null);
  };

  useEffect(() => firebaseAuth.observe((nextUser) => {
    setUser(nextUser);
    setProfile(null);
    setLoading(false);
  }), []);

  useEffect(() => { if (user) void refreshProfile(); }, [user]);

  const sendPhoneCode = async (phoneNumber: string) => {
    const challenge = await firebaseAuth.sendPhoneCode(phoneNumber);
    setPhoneChallenge(challenge);
    return challenge;
  };
  const verifyPhoneCode = async (code: string) => {
    if (!phoneChallenge) throw new Error("Sesi OTP tidak ditemukan. Minta kode baru.");
    await phoneChallenge.confirmation(code);
    setPhoneChallenge(null);
  };
  const value = { user, profile, organizationId, loading, api, signInWithEmail: firebaseAuth.signInWithEmail, signInWithGoogle: firebaseAuth.signInWithGoogle, sendPhoneCode, verifyPhoneCode, refreshProfile, selectOrganization: setOrganizationId, signOut: firebaseAuth.signOut };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
