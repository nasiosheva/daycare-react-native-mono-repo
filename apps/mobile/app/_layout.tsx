import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, usePathname } from "expo-router";
import { BackHandler, Platform } from "react-native";
import { useEffect, useState, type PropsWithChildren } from "react";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { I18nProvider } from "@/i18n/I18nProvider";
import { bottomNavigationPaths } from "@/navigation/RoleBottomNavigation";

const bottomNavigationScreenNames = ["home", "platform-tenants", "tenant-detail", "children", "development", "booking-approvals", "billing-admin", "staff-admin", "staff-operations", "attendance", "parent-qr", "booking", "profile"];

function NotificationRouteHandler() {
  const { selectOrganization } = useAuth();
  useEffect(() => {
    if (Platform.OS === "web") return;
    const open = (data: Record<string, unknown>) => {
      const organizationId = typeof data.organizationId === "string" ? data.organizationId : null;
      const actionPath = typeof data.actionPath === "string" ? data.actionPath : null;
      if (organizationId) selectOrganization(organizationId);
      if (actionPath?.startsWith("/")) router.push(actionPath as never);
    };
    void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) open(response.notification.request.content.data); });
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => open(response.notification.request.content.data));
    return () => subscription.remove();
  }, [selectOrganization]);
  return null;
}

function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}><I18nProvider><AuthProvider><NotificationRouteHandler />{children}</AuthProvider></I18nProvider></QueryClientProvider>;
}

function BottomNavigationBackHandler({ children }: PropsWithChildren) {
  const pathname = usePathname();

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (pathname !== "/home" && bottomNavigationPaths.has(pathname)) {
        router.replace("/home");
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [pathname]);

  return children;
}

export default function RootLayout() {
  return <Providers><BottomNavigationBackHandler><Stack screenOptions={{ headerShown: false }}>{bottomNavigationScreenNames.map((name) => <Stack.Screen key={name} name={name} options={{ animation: "none"}} />)}<Stack.Screen name="branches" options={{ animation: "none" }} /><Stack.Screen name="parent-enrollment" options={{ animation: "none" }} /><Stack.Screen name="sign-up" options={{ animation: "none" }} /></Stack></BottomNavigationBackHandler></Providers>;
}
