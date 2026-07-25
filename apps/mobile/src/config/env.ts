function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing required public environment variable: ${name}`);
  return value;
}

const isLocalAuth = process.env.EXPO_PUBLIC_LOCAL_AUTH_ENABLED === "true";
const firebaseValue = (value: string | undefined, name: string): string => isLocalAuth ? value ?? "" : required(value, name);

export const env = {
  apiUrl: required(process.env.EXPO_PUBLIC_API_URL, "EXPO_PUBLIC_API_URL"),
  realtimeUrl: process.env.EXPO_PUBLIC_REALTIME_URL,
  isSimulation: process.env.EXPO_PUBLIC_APP_ENV === "simulation",
  isProduction: process.env.EXPO_PUBLIC_APP_ENV === "production",
  isLocalAuth,
  firebase: {
    apiKey: firebaseValue(process.env.EXPO_PUBLIC_FIREBASE_API_KEY, "EXPO_PUBLIC_FIREBASE_API_KEY"),
    authDomain: firebaseValue(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: firebaseValue(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, "EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
    appId: firebaseValue(process.env.EXPO_PUBLIC_FIREBASE_APP_ID, "EXPO_PUBLIC_FIREBASE_APP_ID"),
  },
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
} as const;
