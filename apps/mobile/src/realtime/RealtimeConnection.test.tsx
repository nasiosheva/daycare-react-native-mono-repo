// Mories Deo Hutapea,S.E.,S.Kom
import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platformOS: "web",
  queryClient: {},
  auth: {} as Record<string, unknown>,
  useAuth: vi.fn(),
  useI18n: vi.fn(),
  realtimeUrl: vi.fn(),
  invalidateRealtimeFlags: vi.fn(),
  allRealtimeFlags: ["PROFILE", "CHILD_MESSAGES"],
  showBrowserNotification: vi.fn(),
  presentChildMessageLocalNotification: vi.fn(),
  presentInboxLocalNotification: vi.fn(),
  loadDeviceNotificationMutedUntil: vi.fn(),
}));

const mountedRenderers = new Set<ReturnType<typeof create>>();

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => mocks.queryClient }));
vi.mock("@daycare/api-client", () => ({ realtimeUrl: mocks.realtimeUrl }));
vi.mock("react-native", () => ({ Platform: { get OS() { return mocks.platformOS; } } }));
vi.mock("@/auth/AuthProvider", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/config/env", () => ({ env: { apiUrl: "https://api.example.test", realtimeUrl: undefined } }));
vi.mock("@/i18n/I18nProvider", () => ({ useI18n: mocks.useI18n }));
vi.mock("./queryInvalidation", () => ({
  allRealtimeFlags: mocks.allRealtimeFlags,
  invalidateRealtimeFlags: mocks.invalidateRealtimeFlags,
}));
vi.mock("../notifications/browserNotifications", () => ({ showBrowserNotification: mocks.showBrowserNotification }));
vi.mock("../notifications/childMessageLocalNotification", () => ({ presentChildMessageLocalNotification: mocks.presentChildMessageLocalNotification }));
vi.mock("../notifications/inboxLocalNotification", () => ({ presentInboxLocalNotification: mocks.presentInboxLocalNotification }));
vi.mock("../notifications/deviceNotificationPreference", () => ({ loadDeviceNotificationMutedUntil: mocks.loadDeviceNotificationMutedUntil }));

import { RealtimeConnection } from "./RealtimeConnection";

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  send = vi.fn<(data: string) => void>();
  close = vi.fn<() => void>();

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  open() {
    act(() => this.onopen?.({} as Event));
  }

  message(data: unknown) {
    act(() => this.onmessage?.({ data } as MessageEvent));
  }

  serverClose() {
    act(() => this.onclose?.({} as CloseEvent));
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function authState(overrides: Record<string, unknown> = {}) {
  return {
    api: { notifications: vi.fn().mockResolvedValue({ items: [] }) },
    getRealtimeToken: vi.fn().mockResolvedValue("realtime-token"),
    organizationId: "tenant-active",
    profile: { id: "profile-1" },
    refreshProfile: vi.fn().mockResolvedValue({ id: "profile-1" }),
    user: { uid: "user-1" },
    ...overrides,
  };
}

function renderConnection() {
  let rendered!: ReturnType<typeof create>;
  act(() => {
    rendered = create(<RealtimeConnection />);
  });
  mountedRenderers.add(rendered);
  return {
    unmount: () => {
      mountedRenderers.delete(rendered);
      act(() => rendered.unmount());
    },
  };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("RealtimeConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    MockWebSocket.instances = [];
    mocks.platformOS = "web";
    mocks.queryClient = {};
    mocks.auth = authState();
    mocks.useAuth.mockImplementation(() => mocks.auth);
    mocks.useI18n.mockReturnValue({ t: (key: string) => key });
    mocks.realtimeUrl.mockReturnValue("wss://api.example.test/realtime");
    mocks.presentChildMessageLocalNotification.mockResolvedValue(undefined);
    mocks.presentInboxLocalNotification.mockResolvedValue(undefined);
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    for (const rendered of mountedRenderers) act(() => rendered.unmount());
    mountedRenderers.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not request a token or open a socket without a loaded profile", async () => {
    const getRealtimeToken = vi.fn().mockResolvedValue("realtime-token");
    mocks.auth = authState({ profile: null, getRealtimeToken });

    const rendered = renderConnection();
    await flushPromises();

    expect(getRealtimeToken).not.toHaveBeenCalled();
    expect(MockWebSocket.instances).toHaveLength(0);
    rendered.unmount();
  });

  it("does not open a socket when token retrieval returns no token", async () => {
    const getRealtimeToken = vi.fn().mockResolvedValue(null);
    mocks.auth = authState({ getRealtimeToken });

    const rendered = renderConnection();
    await flushPromises();

    expect(getRealtimeToken).toHaveBeenCalledOnce();
    expect(MockWebSocket.instances).toHaveLength(0);
    rendered.unmount();
  });

  it("sends the scoped CONNECT request and defers events until profile revalidation succeeds", async () => {
    const refresh = deferred<{ id: string }>();
    const refreshProfile = vi.fn(() => refresh.promise);
    mocks.auth = authState({ refreshProfile });

    const rendered = renderConnection();
    await flushPromises();
    expect(MockWebSocket.instances).toHaveLength(1);
    const socket = MockWebSocket.instances[0];

    socket.open();
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
      type: "CONNECT",
      token: "realtime-token",
      organizationId: "tenant-active",
    }));

    socket.message(JSON.stringify({ type: "CONNECTED" }));
    socket.message(JSON.stringify({
      type: "EVENT",
      flags: ["CHILD_MESSAGES"],
      organizationId: "tenant-event",
      payload: { childId: "child-1", messageId: "message-1" },
    }));
    expect(refreshProfile).toHaveBeenCalledOnce();
    expect(mocks.invalidateRealtimeFlags).not.toHaveBeenCalled();

    await act(async () => refresh.resolve({ id: "profile-1" }));
    await flushPromises();

    expect(mocks.invalidateRealtimeFlags).toHaveBeenNthCalledWith(
      1,
      mocks.queryClient,
      mocks.allRealtimeFlags,
      "tenant-active",
      "user-1",
    );
    expect(mocks.invalidateRealtimeFlags).toHaveBeenNthCalledWith(
      2,
      mocks.queryClient,
      ["CHILD_MESSAGES"],
      "tenant-event",
      "user-1",
      { childId: "child-1", messageId: "message-1" },
    );
    rendered.unmount();
  });

  it("revalidates the profile again on a PROFILE event and cleans up the socket on unmount", async () => {
    const refreshProfile = vi.fn().mockResolvedValue({ id: "profile-1" });
    mocks.auth = authState({ refreshProfile });

    const rendered = renderConnection();
    await flushPromises();
    expect(MockWebSocket.instances).toHaveLength(1);
    const socket = MockWebSocket.instances[0];
    socket.open();
    socket.message(JSON.stringify({ type: "CONNECTED" }));
    await flushPromises();
    expect(refreshProfile).toHaveBeenCalledOnce();

    socket.message(JSON.stringify({ type: "EVENT", flags: ["PROFILE"] }));
    await flushPromises();
    expect(refreshProfile).toHaveBeenCalledTimes(2);

    rendered.unmount();
    expect(socket.close).toHaveBeenCalledOnce();
    socket.serverClose();
    await flushPromises();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("shows web notification events and passes through a notification id when available", async () => {
    const notifications = vi.fn().mockResolvedValue({ items: [{ id: "notification-1" }] });
    mocks.auth = authState({ api: { notifications } });
    const rendered = renderConnection();
    await flushPromises();
    const socket = MockWebSocket.instances[0];

    socket.open();
    socket.message(JSON.stringify({ type: "CONNECTED" }));
    await flushPromises();
    socket.message(JSON.stringify({
      type: "EVENT",
      flags: ["NOTIFICATIONS"],
      payload: { notificationId: "notification-1" },
    }));
    await flushPromises();

    expect(mocks.showBrowserNotification).toHaveBeenCalledWith(expect.any(Function), "notification-1");
    const loadNotifications = mocks.showBrowserNotification.mock.calls[0]?.[0] as (() => Promise<unknown>) | undefined;
    await loadNotifications?.();
    expect(notifications).toHaveBeenCalledOnce();

    socket.message("not-json");
    socket.message(JSON.stringify({ type: "OTHER" }));
    expect(mocks.showBrowserNotification).toHaveBeenCalledOnce();
    rendered.unmount();
  });

  it("routes mobile notification events to local handlers and logs a rejected notification safely", async () => {
    mocks.platformOS = "android";
    mocks.presentInboxLocalNotification.mockRejectedValue(new Error("permission unavailable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.auth = authState();
    const rendered = renderConnection();
    await flushPromises();
    const socket = MockWebSocket.instances[0];

    socket.open();
    socket.message(JSON.stringify({ type: "CONNECTED" }));
    await flushPromises();
    const event = {
      type: "EVENT",
      flags: ["CHILD_MESSAGES", "NOTIFICATIONS"],
      organizationId: "tenant-event",
      payload: { notificationId: "notification-1", messageId: "message-1" },
    };
    socket.message(JSON.stringify(event));
    await flushPromises();

    expect(mocks.presentChildMessageLocalNotification).toHaveBeenCalledWith(
      event,
      expect.objectContaining({
        title: "childMessage.localNotificationTitle",
        body: "childMessage.localNotificationBody",
        loadMutedUntil: expect.any(Function),
      }),
    );
    expect(mocks.presentInboxLocalNotification).toHaveBeenCalledWith(
      event,
      expect.objectContaining({ loadNotification: expect.any(Function), loadMutedUntil: expect.any(Function) }),
    );
    expect(warn).toHaveBeenCalledWith("[notifications] Inbox local notification skipped: permission unavailable");
    expect(mocks.showBrowserNotification).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it("loads the chat mute preference for the event tenant rather than the active tenant", async () => {
    mocks.platformOS = "android";
    const api = { notifications: vi.fn().mockResolvedValue({ items: [] }) };
    mocks.auth = authState({ api, organizationId: "tenant-active" });
    const rendered = renderConnection();
    await flushPromises();
    const socket = MockWebSocket.instances[0];

    socket.open();
    socket.message(JSON.stringify({ type: "CONNECTED" }));
    await flushPromises();
    socket.message(JSON.stringify({
      type: "EVENT",
      flags: ["CHILD_MESSAGES"],
      organizationId: "tenant-event",
      payload: { childId: "child-1", messageId: "message-1", event: "MESSAGE_CREATED" },
    }));
    await flushPromises();

    const chatNotificationOptions = mocks.presentChildMessageLocalNotification.mock.calls[0]?.[1] as { loadMutedUntil: () => Promise<unknown> } | undefined;
    await chatNotificationOptions?.loadMutedUntil();
    expect(mocks.loadDeviceNotificationMutedUntil).toHaveBeenCalledWith(mocks.queryClient, api, "tenant-event");
    rendered.unmount();
  });

  it("backs off after repeated connection failures and cancels reconnect on cleanup", async () => {
    vi.useFakeTimers();
    mocks.auth = authState();
    const rendered = renderConnection();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(MockWebSocket.instances).toHaveLength(1);

    MockWebSocket.instances[0].serverClose();
    await act(async () => { await vi.advanceTimersByTimeAsync(999); });
    expect(MockWebSocket.instances).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(MockWebSocket.instances).toHaveLength(2);

    MockWebSocket.instances[1].serverClose();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_999); });
    expect(MockWebSocket.instances).toHaveLength(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(MockWebSocket.instances).toHaveLength(3);

    MockWebSocket.instances[2].serverClose();
    rendered.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(MockWebSocket.instances).toHaveLength(3);
  });
});
