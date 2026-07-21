import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, RecaptchaVerifier, signInWithEmailAndPassword, signInWithPhoneNumber, signInWithPopup, signOut, updatePassword, updateProfile, type User } from "firebase/auth";
import { env } from "@/config/env";
import type { AuthGateway, AuthUser } from "./types";

const app = getApps()[0] ?? initializeApp(env.firebase);
const auth = getAuth(app);
function toUser(user: User | null): AuthUser | null {
  return user ? { uid: user.uid, email: user.email, phoneNumber: user.phoneNumber, displayName: user.displayName } : null;
}

export const firebaseAuth: AuthGateway = {
  observe(listener) { return onAuthStateChanged(auth, (user) => listener(toUser(user))); },
  async signInWithEmail(email, password) { await signInWithEmailAndPassword(auth, email, password); },
  async signInWithGoogle() { await signInWithPopup(auth, new GoogleAuthProvider()); },
  async sendPhoneCode(phoneNumber) {
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
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Tidak ada akun Firebase yang sedang masuk.");
    await updateProfile(currentUser, { displayName });
    const user = toUser(auth.currentUser);
    if (!user) throw new Error("Profil Firebase tidak dapat diperbarui.");
    return user;
  },
  async changePassword(newPassword) {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Tidak ada akun Firebase yang sedang masuk.");
    await updatePassword(currentUser, newPassword);
  },
  signOut: () => signOut(auth),
  async getIdToken(forceRefresh = false) { return auth.currentUser?.getIdToken(forceRefresh) ?? null; },
};
