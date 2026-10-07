import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { realtimeUrl, type RealtimeConnectRequest, type RealtimeEvent } from "@daycare/api-client";
import { Platform } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { env } from "@/config/env";
import { useI18n } from "@/i18n/I18nProvider";
import { allRealtimeFlags, invalidateRealtimeFlags } from "./queryInvalidation";
import { showBrowserNotification } from "../notifications/browserNotifications";
import { presentChildMessageLocalNotification } from "../notifications/childMessageLocalNotification";
import { presentInboxLocalNotification } from "../notifications/inboxLocalNotification";
import { loadDeviceNotificationMutedUntil } from "../notifications/deviceNotificationPreference";

const INITIAL_RECONNECT_DELAY_MILLIS = 1_000;
const MAX_RECONNECT_DELAY_MILLIS = 30_000;

export function RealtimeConnection() {
  const queryClient = useQueryClient();
  const { api, getRealtimeToken, organizationId, profile, refreshProfile, user } = useAuth();
  const hasProfile = Boolean(profile);
  const userId = user?.uid ?? null;
  const { t } = useI18n();
  // Read through a ref so a locale change does not reconnect the socket.
  const translateRef = useRef(t);
  translateRef.current = t;

  useEffect(() => {
    if (!hasProfile) return;
    let closed = false;
    let socket: WebSocket | null = null;
    let reconnectDelay = INITIAL_RECONNECT_DELAY_MILLIS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let connectionVerified = false;
    let profileRefreshInFlight = false;
    const pendingEvents: RealtimeEvent[] = [];

    const processEvent = (event: RealtimeEvent) => {
      invalidateRealtimeFlags(queryClient, event.flags, event.organizationId ?? organizationId, userId, event.payload);
      if (Platform.OS === "web" && event.flags.includes("NOTIFICATIONS")) void showBrowserNotification(() => api.notifications().then((page) => page.items), notificationId(event));
      if (Platform.OS !== "web") {
        const loadMutedUntil = () => loadDeviceNotificationMutedUntil(queryClient, api, organizationId);
        const eventOrganizationId = event.organizationId ?? organizationId ?? undefined;
        void presentChildMessageLocalNotification(event, {
          title: translateRef.current("childMessage.localNotificationTitle"),
          body: translateRef.current("childMessage.localNotificationBody"),
          loadMutedUntil,
        }).catch((error: unknown) => warnLocalNotificationSkipped("Chat", error));
        void presentInboxLocalNotification(event, {
          loadNotification: (id) => api.notifications(undefined, eventOrganizationId).then((page) => page.items.find((item) => item.id === id)),
          loadMutedUntil,
        }).catch((error: unknown) => warnLocalNotificationSkipped("Inbox", error));
      }
    };

    const revalidateConnectedProfile = () => {
      if (closed || profileRefreshInFlight) return;
      connectionVerified = false;
      profileRefreshInFlight = true;
      void refreshProfile()
        .then(() => {
          if (closed) return;
          connectionVerified = true;
          invalidateRealtimeFlags(queryClient, allRealtimeFlags, organizationId, userId);
          pendingEvents.splice(0).forEach(processEvent);
        })
        .catch(() => {
          // AuthProvider removes stale profile, tenant context, and cached data before exposing the failure state.
        })
        .finally(() => { profileRefreshInFlight = false; });
    };

    const connect = async () => {
      const token = await getRealtimeToken();
      if (closed || !token) return;
      socket = new WebSocket(realtimeUrl(env.apiUrl, env.realtimeUrl));
      socket.onopen = () => {
        reconnectDelay = INITIAL_RECONNECT_DELAY_MILLIS;
        const request: RealtimeConnectRequest = { type: "CONNECT", token, organizationId };
        socket?.send(JSON.stringify(request));
      };
      socket.onmessage = (message) => {
        if (isConnectedMessage(message.data)) {
          revalidateConnectedProfile();
          return;
        }
        const event = parseRealtimeEvent(message.data);
        if (!event) return;
        if (!connectionVerified || event.flags.includes("PROFILE")) {
          pendingEvents.push(event);
          revalidateConnectedProfile();
          return;
        }
        processEvent(event);
      };
      socket.onclose = () => {
        if (closed) return;
        reconnectTimer = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MILLIS);
          void connect();
        }, reconnectDelay);
      };
    };

    void connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [api, getRealtimeToken, hasProfile, organizationId, queryClient, refreshProfile, userId]);

  return null;
}

function warnLocalNotificationSkipped(kind: string, error: unknown): void {
  console.warn(`[notifications] ${kind} local notification skipped: ${error instanceof Error ? error.message : String(error)}`);
}

function notificationId(event: RealtimeEvent): string | undefined {
  if (!event.payload || typeof event.payload !== "object") return undefined;
  const value = (event.payload as { notificationId?: unknown }).notificationId;
  return typeof value === "string" ? value : undefined;
}

function isConnectedMessage(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    return (JSON.parse(value) as { type?: unknown }).type === "CONNECTED";
  } catch {
    return false;
  }
}

function parseRealtimeEvent(value: unknown): RealtimeEvent | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as Partial<RealtimeEvent>;
    return parsed.type === "EVENT" && Array.isArray(parsed.flags) ? parsed as RealtimeEvent : null;
  } catch {
    return null;
  }
}
