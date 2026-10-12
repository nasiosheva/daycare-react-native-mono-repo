// Mories Deo Hutapea,S.E.,S.Kom

import { describe, expect, it, vi } from "vitest";
import { markNetworkOffline, markNetworkOnline, subscribeNetworkSignal } from "./networkSignal";

describe("offline networkSignal", () => {
  it("notifies every subscribed listener of an online/offline transition", () => {
    const listener = vi.fn();
    subscribeNetworkSignal(listener);

    markNetworkOffline();
    markNetworkOnline();

    expect(listener).toHaveBeenNthCalledWith(1, false);
    expect(listener).toHaveBeenNthCalledWith(2, true);
  });

  it("stops notifying a listener once it unsubscribes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNetworkSignal(listener);
    unsubscribe();

    markNetworkOffline();

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not affect other listeners when one unsubscribes", () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeNetworkSignal(first);
    subscribeNetworkSignal(second);
    unsubscribeFirst();

    markNetworkOnline();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(true);
  });
});
