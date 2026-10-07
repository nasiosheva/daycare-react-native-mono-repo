import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@daycare/api-client";
import { Stack, useNavigationContainerRef, usePathname, useRouter } from "expo-router";
import { Alert, BackHandler, Platform, StatusBar } from "react-native";
import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { I18nProvider } from "@/i18n/I18nProvider";
import { bottomNavigationPaths } from "@/navigation/RoleBottomNavigation";
import { canOpenNotificationRoute, isSelfServiceNotificationRoute, notificationRouteWithOrganizationId } from "@/navigation/notificationRouteAccess";
import { RealtimeConnection } from "@/realtime/RealtimeConnection";
import { colors, publishInlineFeedback } from "@daycare/ui";
import { BrandedSplash } from "@/splash/BrandedSplash";
import { InactiveStaffRouteBoundary } from "@/navigation/InactiveStaffRouteBoundary";
import { InactiveParentRouteBoundary } from "@/navigation/InactiveParentRouteBoundary";
import { OrganizationContextRouteBoundary } from "@/navigation/OrganizationContextRouteBoundary";
import { ParentSelfServiceRouteBoundary } from "@/navigation/ParentSelfServiceRouteBoundary";
import { ProfileContextRouteBoundary } from "@/navigation/ProfileContextRouteBoundary";
import { hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";
import { hasOperationalTenantSubscription } from "@/auth/tenantSubscription";
import { isDuplicateRemoteNotification } from "@/notifications/localNotificationContent";
import { getNativeNotificationPermission, nativeNotificationPlatform, registerNativePushDevice, requestNativeNotificationPermission, type NativeNotificationPermission } from "@/notifications/nativePush";

if (Platform.OS !== "web") {
  SplashScreen.setOptions({ duration: 250, fade: true });
  void SplashScreen.preventAutoHideAsync().catch(() => undefined);
}

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // A server push that repeats a notification already shown locally from the realtime event stays silent.
      const trigger = notification.request.trigger;
      const isRemote = Boolean(trigger && typeof trigger === "object" && "type" in trigger && trigger.type === "push");
      const show = !isDuplicateRemoteNotification(isRemote, notification.request.content.data);
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
    },
  });
} else {
  const nativeAlert = Alert.alert;
  Alert.alert = (title, message, buttons, options) => {
    if (buttons?.length) return nativeAlert(title, message, buttons, options);
    publishInlineFeedback(title, message);
  };
}

const bottomNavigationScreenNames = ["home", "platform-tenants", "platform-catalog", "tenant-detail", "children", "academic", "development", "booking-approvals", "billing-admin", "staff-admin", "staff-operations", "parent-qr", "booking", "operational-hours", "parent-enrollment", "profile"];

function NotificationRouteHandler() {
  const { organizationId, profile, selectOrganization } = useAuth();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const access = useUiAccessContext(Boolean(profile && organizationId && hasOperationalTenantSubscription(membership?.subscriptionStatus)));
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();
  const [pendingRoute, setPendingRoute] = useState<{ actionPath: string; organizationId: string | null } | null>(null);
  const openedNotificationIds = useRef(new Set<string>());
  useEffect(() => {
    if (Platform.OS === "web") return;
    const open = (data: Record<string, unknown>, notificationId: string) => {
      if (openedNotificationIds.current.has(notificationId)) return;
      const notificationOrganizationId = typeof data.organizationId === "string" ? data.organizationId : null;
      const actionPath = typeof data.actionPath === "string" ? data.actionPath : null;
      const isSelfServiceRoute = Boolean(actionPath && isSelfServiceNotificationRoute(actionPath));
      const targetOrganizationId = isSelfServiceRoute ? null : notificationOrganizationId ?? organizationId;
      if (!isSelfServiceRoute && notificationOrganizationId && !selectOrganization(notificationOrganizationId)) return;
      const isCurrentOrganization = !targetOrganizationId || targetOrganizationId === organizationId;
      if (!actionPath || !canOpenNotificationRoute(profile, targetOrganizationId, actionPath, !isCurrentOrganization || hasOfferingCapability(access.data, "DAYCARE_OPERATIONS"))) return;
      openedNotificationIds.current.add(notificationId);
      setPendingRoute({
        actionPath: notificationRouteWithOrganizationId(actionPath, notificationOrganizationId),
        organizationId: isSelfServiceRoute ? null : notificationOrganizationId,
      });
    };
    void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) open(response.notification.request.content.data, response.notification.request.identifier); });
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => open(response.notification.request.content.data, response.notification.request.identifier));
    return () => subscription.remove();
  }, [access.data, organizationId, profile, selectOrganization]);
  useEffect(() => {
    if (!pendingRoute || !navigationRef.current?.isReady()) return;
    if (pendingRoute.organizationId && pendingRoute.organizationId !== organizationId) return;
    if (access.isLoading) return;
    if (!canOpenNotificationRoute(profile, pendingRoute.organizationId ?? organizationId, pendingRoute.actionPath, hasOfferingCapability(access.data, "DAYCARE_OPERATIONS"))) {
      setPendingRoute(null);
      return;
    }
    router.push(pendingRoute.actionPath as never);
    setPendingRoute(null);
  }, [access.data, access.isLoading, navigationRef, organizationId, pendingRoute, profile, router]);
  return null;
}

function NativeNotificationRegistration() {
  const { api, organizationId, profile, user } = useAuth();
  const pathname = usePathname();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const subscriptionActive = hasOperationalTenantSubscription(membership?.subscriptionStatus);
  const [permissionStatus, setPermissionStatus] = useState<NativeNotificationPermission | null>(null);
  const promptedPath = useRef<string | null>(null);

  useEffect(() => {
    // This coordinator is intentionally native-only. Web permission is not
    // requested here: browsers require a user gesture and use the separate
    // Notification.requestPermission() adapter from the Notifications screen.
    const platform = nativeNotificationPlatform();
    if (!platform || (pathname !== "/sign-in" && pathname !== "/home") || promptedPath.current === pathname) return;
    promptedPath.current = pathname;
    let cancelled = false;
    const requestPermission = async () => {
      try {
        const requested = await requestNativeNotificationPermission();
        if (!cancelled && requested) setPermissionStatus(requested);
        if (requested) console.info(`[notifications] Native permission status: ${requested.status}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[notifications] Native permission request failed: ${message}`);
      }
    };
    void requestPermission();
    return () => { cancelled = true; };
  }, [pathname]);

  useEffect(() => {
    const platform = nativeNotificationPlatform();
    if (!platform || !organizationId || !profile || !user || !subscriptionActive) return;
    let cancelled = false;
    const register = async () => {
      try {
        const permission = permissionStatus ?? await getNativeNotificationPermission();
        if (!permission) return;
        if (permission.status !== "granted") {
          if (!permissionStatus && !cancelled) setPermissionStatus(permission);
          return;
        }
        if (cancelled) return;
        await registerNativePushDevice(api, permission);
      } catch (error) {
        // A simulator may not support push tokens, but configuration and API
        // failures must remain visible instead of silently disabling push.
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[notifications] Native push registration skipped: ${message}`);
      }
    };
    void register();
    return () => { cancelled = true; };
  }, [api, organizationId, permissionStatus, profile, subscriptionActive, user]);

  return null;
}

function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  }));
  return <QueryClientProvider client={queryClient}><I18nProvider><AuthProvider><NativeSplashGate><NotificationRouteHandler /><NativeNotificationRegistration /><RealtimeConnection />{children}</NativeSplashGate></AuthProvider></I18nProvider></QueryClientProvider>;
}

function NativeSplashGate({ children }: PropsWithChildren) {
  const { loading } = useAuth();
  const [splashAssetReady, setSplashAssetReady] = useState(Platform.OS === "web");
  const showBrandedSplash = Platform.OS !== "web" && (loading || !splashAssetReady);

  useEffect(() => {
    if (Platform.OS === "web" || !splashAssetReady) return;
    const frame = requestAnimationFrame(() => { void SplashScreen.hideAsync().catch(() => undefined); });
    return () => cancelAnimationFrame(frame);
  }, [splashAssetReady]);

  return <>
    {children}
    {showBrandedSplash && <BrandedSplash onLogoLoad={() => setSplashAssetReady(true)} />}
  </>;
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
  return <Providers>
    {/* Light status-bar content for the dark navy theme. */}
    <StatusBar barStyle="light-content" backgroundColor={colors.background} />
    <BottomNavigationBackHandler><Stack initialRouteName="home" screenOptions={{ headerShown: false }}>
      {bottomNavigationScreenNames.map((name) => <Stack.Screen key={name} name={name} options={{ animation: "none" }} />)}
      {[
        "tenant-readiness", "absence-requests", "staff-leave-requests", "staff-leave-approvals", "tenant-feedback", "tenant-feedback-inbox", "tenant-announcements", "payment-history", "parent-family-profile", "parent-child-profile", "pickup-authorizations", "emergency-contacts", "child-consents", "consent-definitions", "consent-information", "child-message-templates", "add-tenant", "institution-types", "branches", "branch-operating-hours", "overtime-charges", "global-curriculum", "global-development-programs", "global-learning-levels", "goals", "child-messages", "child-daily-timeline", "child-care-logs", "child-handovers", "development-categories", "notifications", "staff-reminders", "payment-instructions", "parent-enrollment-form", "parent-payment", "context-selection", "sign-up", "verify-phone",
      ].map((name) => <Stack.Screen key={name} name={name} options={{ animation: "none" }} />)}
    </Stack></BottomNavigationBackHandler>
    {/* Keep Stack mounted while guards dispatch redirects. Unmounting it here
        makes router.replace('/home') target a navigator that no longer exists. */}
    <ProfileContextRouteBoundary><></></ProfileContextRouteBoundary>
    <OrganizationContextRouteBoundary><></></OrganizationContextRouteBoundary>
    <ParentSelfServiceRouteBoundary><></></ParentSelfServiceRouteBoundary>
    <InactiveStaffRouteBoundary><></></InactiveStaffRouteBoundary>
    <InactiveParentRouteBoundary><></></InactiveParentRouteBoundary>
  </Providers>;
}
