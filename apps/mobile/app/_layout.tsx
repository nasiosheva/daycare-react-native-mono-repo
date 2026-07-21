import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, usePathname } from "expo-router";
import { BackHandler, Platform } from "react-native";
import { useEffect, useState, type PropsWithChildren } from "react";
import { AuthProvider } from "@/auth/AuthProvider";
import { I18nProvider } from "@/i18n/I18nProvider";
import { bottomNavigationPaths } from "@/navigation/RoleBottomNavigation";

  const bottomNavigationScreenNames = ["home", "platform-tenants", "tenant-detail", "children", "development", "booking-approvals", "billing-admin", "staff-admin", "staff-operations", "attendance", "parent-qr", "booking", "profile"];

function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}><I18nProvider><AuthProvider>{children}</AuthProvider></I18nProvider></QueryClientProvider>;
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
  return <Providers><BottomNavigationBackHandler><Stack screenOptions={{ headerShown: false }}>{bottomNavigationScreenNames.map((name) => <Stack.Screen key={name} name={name} options={{ animation: "none"}} />)}<Stack.Screen name="parent-enrollment" options={{ animation: "none" }} /><Stack.Screen name="sign-up" options={{ animation: "none" }} /></Stack></BottomNavigationBackHandler></Providers>;
}
