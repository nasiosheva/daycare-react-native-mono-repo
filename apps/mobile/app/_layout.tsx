import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useNavigationContainerRef, usePathname, useRouter } from "expo-router";
import { Alert, BackHandler, Platform } from "react-native";
import { useEffect, useState, type PropsWithChildren } from "react";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { I18nProvider } from "@/i18n/I18nProvider";
import { bottomNavigationPaths } from "@/navigation/RoleBottomNavigation";
import { RealtimeConnection } from "@/realtime/RealtimeConnection";
import { getDeviceInstallationId } from "@/device/installationId";
import { publishInlineFeedback } from "@daycare/ui";

if (Platform.OS !== "web") {
  SplashScreen.setOptions({ duration: 250, fade: true });
  void SplashScreen.preventAutoHideAsync().catch(() => undefined);
}

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
} else {
  const nativeAlert = Alert.alert;
  Alert.alert = (title, message, buttons, options) => {
    if (buttons?.length) return nativeAlert(title, message, buttons, options);
    publishInlineFeedback(title, message);
  };
}

const bottomNavigationScreenNames = ["home", "platform-tenants", "platform-catalog", "tenant-detail", "academic", "development", "booking-approvals", "billing-admin", "staff-admin", "staff-operations", "parent-qr", "booking", "operational-hours", "parent-enrollment", "profile"];

function NotificationRouteHandler() {
  const { selectOrganization } = useAuth();
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();
  useEffect(() => {
    if (Platform.OS === "web") return;
    const open = (data: Record<string, unknown>) => {
      const organizationId = typeof data.organizationId === "string" ? data.organizationId : null;
      const actionPath = typeof data.actionPath === "string" ? data.actionPath : null;
      if (organizationId) selectOrganization(organizationId);
      if (actionPath?.startsWith("/") && navigationRef.current?.isReady()) router.push(actionPath as never);
    };
    void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) open(response.notification.request.content.data); });
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => open(response.notification.request.content.data));
    return () => subscription.remove();
  }, [navigationRef, router, selectOrganization]);
  return null;
}

function NativeNotificationRegistration() {
  const { api, organizationId, profile, user } = useAuth();

  useEffect(() => {
    const platform = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;
    if (!platform || !organizationId || !profile || !user) return;
    let cancelled = false;
    const register = async () => {
      try {
        if (platform === "android") await Notifications.setNotificationChannelAsync("default", { name: "Default", importance: Notifications.AndroidImportance.DEFAULT });
        const permission = await Notifications.getPermissionsAsync();
        const status = permission.status === "granted" ? permission.status : (await Notifications.requestPermissionsAsync()).status;
        if (status !== "granted" || cancelled) return;
        const [token, installationId] = await Promise.all([Notifications.getExpoPushTokenAsync(), getDeviceInstallationId()]);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        if (!cancelled) await api.registerDevice({ token: token.data, platform, installationId, timeZone });
      } catch {
        // A device may not support push tokens (for example, a simulator). The in-app inbox remains available.
      }
    };
    void register();
    return () => { cancelled = true; };
  }, [api, organizationId, profile, user]);

  return null;
}

function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}><I18nProvider><AuthProvider><NativeSplashGate><NotificationRouteHandler /><NativeNotificationRegistration /><RealtimeConnection />{children}</NativeSplashGate></AuthProvider></I18nProvider></QueryClientProvider>;
}

function NativeSplashGate({ children }: PropsWithChildren) {
  const { loading } = useAuth();

  useEffect(() => {
    if (Platform.OS === "web" || loading) return;
    const frame = requestAnimationFrame(() => { void SplashScreen.hideAsync().catch(() => undefined); });
    return () => cancelAnimationFrame(frame);
  }, [loading]);

  return children;
}

function BottomNavigationBackHandler({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (navigationRef.current?.isReady() && pathname !== "/home" && bottomNavigationPaths.has(pathname)) {
        router.replace("/home");
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [navigationRef, pathname, router]);

  return children;
}

export default function RootLayout() {
  return <Providers><BottomNavigationBackHandler><Stack initialRouteName="home" screenOptions={{ headerShown: false }}>
    {bottomNavigationScreenNames.map((name) => <Stack.Screen key={name} name={name} options={{ animation: "none" }} />)}
    {[
      "tenant-readiness", "absence-requests", "staff-leave-requests", "staff-leave-approvals", "parent-family-profile", "parent-child-profile", "add-tenant", "institution-types", "branches", "branch-operating-hours", "overtime-charges", "global-curriculum", "global-development-programs", "goals", "development-categories", "notifications", "staff-reminders", "payment-instructions", "parent-enrollment-form", "parent-payment", "sign-up", "verify-phone",
    ].map((name) => <Stack.Screen key={name} name={name} options={{ animation: "none" }} />)}
  </Stack></BottomNavigationBackHandler></Providers>;
}
