import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { realtimeUrl, type RealtimeConnectRequest, type RealtimeEvent } from "@daycare/api-client";
import { Platform } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { env } from "@/config/env";
import { allRealtimeFlags, invalidateRealtimeFlags } from "./queryInvalidation";
import { showBrowserNotification } from "../notifications/browserNotifications";

const INITIAL_RECONNECT_DELAY_MILLIS = 1_000;
const MAX_RECONNECT_DELAY_MILLIS = 30_000;

export function RealtimeConnection() {
  const queryClient = useQueryClient();
  const { api, getRealtimeToken, organizationId, profile, refreshProfile } = useAuth();

  useEffect(() => {
    if (!profile) return;
    let closed = false;
    let socket: WebSocket | null = null;
    let reconnectDelay = INITIAL_RECONNECT_DELAY_MILLIS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
          invalidateRealtimeFlags(queryClient, allRealtimeFlags);
          return;
        }
        const event = parseRealtimeEvent(message.data);
        if (!event) return;
        invalidateRealtimeFlags(queryClient, event.flags);
        if (Platform.OS === "web" && event.flags.includes("NOTIFICATIONS")) void showBrowserNotification(() => api.notifications(), notificationId(event));
        if (event.flags.includes("PROFILE")) void refreshProfile();
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
  }, [api, getRealtimeToken, organizationId, profile, queryClient, refreshProfile]);

  return null;
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
