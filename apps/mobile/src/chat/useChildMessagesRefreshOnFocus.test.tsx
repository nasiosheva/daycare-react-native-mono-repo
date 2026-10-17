// Mories Deo Hutapea,S.E.,S.Kom
import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChildMessagesRefreshOnFocus } from "./useChildMessagesRefreshOnFocus";

const mocks = vi.hoisted(() => ({
  focusCallback: null as (() => void | (() => void)) | null,
  appStateListener: null as ((state: string) => void) | null,
  removeListener: vi.fn(),
}));

vi.mock("expo-router", () => ({
  useFocusEffect: (callback: () => void | (() => void)) => { mocks.focusCallback = callback; },
}));
vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mocks.appStateListener = listener;
      return { remove: mocks.removeListener };
    },
  },
}));

function HookHost({ refetch, enabled = true }: { refetch: () => Promise<unknown>; enabled?: boolean }) {
  useChildMessagesRefreshOnFocus(refetch, enabled);
  return null;
}

describe("useChildMessagesRefreshOnFocus", () => {
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));

  afterEach(() => {
    mocks.focusCallback = null;
    mocks.appStateListener = null;
    mocks.removeListener.mockClear();
    vi.unstubAllGlobals();
  });

  it("refetches when an already-open thread regains focus, but not on initial focus", () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<HookHost refetch={refetch} />); });

    let cleanup = mocks.focusCallback?.();
    expect(refetch).not.toHaveBeenCalled();
    cleanup?.();
    cleanup = mocks.focusCallback?.();

    expect(refetch).toHaveBeenCalledOnce();
    cleanup?.();
    expect(mocks.removeListener).toHaveBeenCalledTimes(2);
    act(() => renderer.unmount());
  });

  it("refetches the focused thread after the app returns to foreground", () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<HookHost refetch={refetch} />); });
    mocks.focusCallback?.();

    act(() => mocks.appStateListener?.("background"));
    act(() => mocks.appStateListener?.("active"));

    expect(refetch).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
  });

  it("does not subscribe or refetch while the route lacks a valid thread scope", () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<HookHost refetch={refetch} enabled={false} />); });
    mocks.focusCallback?.();
    mocks.appStateListener?.("background");
    mocks.appStateListener?.("active");

    expect(mocks.appStateListener).toBeNull();
    expect(refetch).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });
});
