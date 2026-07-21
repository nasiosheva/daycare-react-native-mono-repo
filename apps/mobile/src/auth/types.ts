export type AuthUser = { uid: string; email: string | null; phoneNumber: string | null; displayName: string | null };
export type PhoneChallenge = { confirmation: (code: string) => Promise<void> };
export type AuthGateway = {
  observe: (listener: (user: AuthUser | null) => void) => () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPhoneCode: (phoneNumber: string) => Promise<PhoneChallenge>;
  updateDisplayName: (displayName: string) => Promise<AuthUser>;
  changePassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
};
