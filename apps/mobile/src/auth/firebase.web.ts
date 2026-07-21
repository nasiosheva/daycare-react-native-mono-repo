import { initializeApp, getApps } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged, RecaptchaVerifier, signInWithEmailAndPassword, signInWithPhoneNumber, signInWithPopup, signOut, updatePassword, updateProfile, type User } from "firebase/auth";
import { env } from "@/config/env";
import type { AuthGateway, AuthUser } from "./types";

let firebaseAuthentication: ReturnType<typeof getAuth> | null = null;

function authentication() {
  if (firebaseAuthentication) return firebaseAuthentication;
  const app = getApps()[0] ?? initializeApp(env.firebase);
  firebaseAuthentication = getAuth(app);
  return firebaseAuthentication;
}

function toUser(user: User | null): AuthUser | null {
  return user ? { uid: user.uid, email: user.email, phoneNumber: user.phoneNumber, displayName: user.displayName } : null;
}

export const firebaseAuth: AuthGateway = {
  observe(listener) { return onAuthStateChanged(authentication(), (user) => listener(toUser(user))); },
  async signInWithEmail(email, password) { await signInWithEmailAndPassword(authentication(), email, password); },
  async signUpWithEmail(email, password, displayName) { const result = await createUserWithEmailAndPassword(authentication(), email, password); await updateProfile(result.user, { displayName }); },
  async signInWithGoogle() { await signInWithPopup(authentication(), new GoogleAuthProvider()); },
  async sendPhoneCode(phoneNumber) {
    const auth = authentication();
    const containerId = "firebase-phone-recaptcha";
    if (!document.getElementById(containerId)) {
      const element = document.createElement("div");
      element.id = containerId;
      document.body.appendChild(element);
    }
    const verifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
    const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    return { confirmation: async (code) => { await confirmation.confirm(code); verifier.clear(); } };
  },
  async updateDisplayName(displayName) {
    const auth = authentication();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Tidak ada akun Firebase yang sedang masuk.");
    await updateProfile(currentUser, { displayName });
    const user = toUser(auth.currentUser);
    if (!user) throw new Error("Profil Firebase tidak dapat diperbarui.");
    return user;
  },
  async changePassword(newPassword) {
    const auth = authentication();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Tidak ada akun Firebase yang sedang masuk.");
    await updatePassword(currentUser, newPassword);
  },
  signOut: () => signOut(authentication()),
  async getIdToken(forceRefresh = false) { return authentication().currentUser?.getIdToken(forceRefresh) ?? null; },
};
