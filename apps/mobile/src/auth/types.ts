export type AuthUser = { uid: string; email: string | null; phoneNumber: string | null; displayName: string | null };
export type PhoneChallenge = { confirmation: (code: string) => Promise<void> };
export type AuthGateway = {
  observe: (listener: (user: AuthUser | null) => void) => () => void;
  signInWithGoogle: () => Promise<void>;
  sendPhoneCode: (phoneNumber: string) => Promise<PhoneChallenge>;
  updateDisplayName: (displayName: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
};
