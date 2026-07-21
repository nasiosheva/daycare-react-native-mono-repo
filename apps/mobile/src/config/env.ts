function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required public environment variable: ${name}`);
  return value;
}

export const env = {
  apiUrl: required("EXPO_PUBLIC_API_URL"),
  firebase: {
    apiKey: required("EXPO_PUBLIC_FIREBASE_API_KEY"),
    authDomain: required("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: required("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
    appId: required("EXPO_PUBLIC_FIREBASE_APP_ID"),
  },
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
} as const;
