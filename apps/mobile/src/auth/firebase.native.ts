import auth, { type FirebaseAuthTypes } from "@react-native-firebase/auth";
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

export const firebaseAuth: AuthGateway = {
  observe(listener) { return auth().onAuthStateChanged((user) => listener(toUser(user))); },
  async signInWithEmail(email, password) { await auth().signInWithEmailAndPassword(email, password); },
  async signInWithGoogle() {
    configureGoogleSignIn();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return;
    const idToken = response.idToken;
    if (!idToken) throw new Error("Google did not return an ID token.");
    await auth().signInWithCredential(auth.GoogleAuthProvider.credential(idToken));
  },
  async sendPhoneCode(phoneNumber): Promise<PhoneChallenge> {
    const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
    return { confirmation: async (code) => { await confirmation.confirm(code); } };
  },
  signOut: () => auth().signOut(),
  async getIdToken() { return auth().currentUser?.getIdToken() ?? null; },
};
