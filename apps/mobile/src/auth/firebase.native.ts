import { getAuth, getIdToken, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithPhoneNumber, signOut, updateProfile, type FirebaseAuthTypes } from "@react-native-firebase/auth";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import { env } from "@/config/env";
import type { AuthGateway, AuthUser, PhoneChallenge } from "./types";

function toUser(user: FirebaseAuthTypes.User | null): AuthUser | null {
  return user ? { uid: user.uid, email: user.email, phoneNumber: user.phoneNumber, displayName: user.displayName } : null;
}

function configureGoogleSignIn() {
  if (!env.googleWebClientId) throw new Error("Google Sign-In is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.");
  GoogleSignin.configure({ webClientId: env.googleWebClientId });
}

const authentication = getAuth();

export const firebaseAuth: AuthGateway = {
  observe(listener) { return onAuthStateChanged(authentication, (user) => listener(toUser(user))); },
  async signInWithGoogle() {
    configureGoogleSignIn();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return;
    const idToken = response.idToken;
    if (!idToken) throw new Error("Google did not return an ID token.");
    await signInWithCredential(authentication, GoogleAuthProvider.credential(idToken));
  },
  async sendPhoneCode(phoneNumber): Promise<PhoneChallenge> {
    const confirmation = await signInWithPhoneNumber(authentication, phoneNumber);
    return { confirmation: async (code) => { await confirmation.confirm(code); } };
  },
  async updateDisplayName(displayName) {
    const currentUser = authentication.currentUser;
    if (!currentUser) throw new Error("Tidak ada akun Firebase yang sedang masuk.");
    await updateProfile(currentUser, { displayName });
    const user = toUser(authentication.currentUser);
    if (!user) throw new Error("Profil Firebase tidak dapat diperbarui.");
    return user;
  },
  signOut: () => signOut(authentication),
  async getIdToken(forceRefresh = false) { return authentication.currentUser ? getIdToken(authentication.currentUser, forceRefresh) : null; },
};
