function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing required public environment variable: ${name}`);
  return value;
}

export const env = {
  apiUrl: required(process.env.EXPO_PUBLIC_API_URL, "EXPO_PUBLIC_API_URL"),
  realtimeUrl: process.env.EXPO_PUBLIC_REALTIME_URL,
  isProduction: process.env.EXPO_PUBLIC_APP_ENV === "production",
  firebase: {
    apiKey: required(process.env.EXPO_PUBLIC_FIREBASE_API_KEY, "EXPO_PUBLIC_FIREBASE_API_KEY"),
    authDomain: required(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: required(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, "EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
    appId: required(process.env.EXPO_PUBLIC_FIREBASE_APP_ID, "EXPO_PUBLIC_FIREBASE_APP_ID"),
  },
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  googleMapsGeocodingApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_GEOCODING_API_KEY ?? "",
} as const;
