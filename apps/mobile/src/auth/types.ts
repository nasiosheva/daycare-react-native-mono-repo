export type AuthUser = { uid: string; email: string | null; phoneNumber: string | null; displayName: string | null };
export type PhoneChallenge = { confirmation: (code: string) => Promise<void> };
export type AuthGateway = {
  observe: (listener: (user: AuthUser | null) => void) => () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPhoneCode: (phoneNumber: string) => Promise<PhoneChallenge>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
};
