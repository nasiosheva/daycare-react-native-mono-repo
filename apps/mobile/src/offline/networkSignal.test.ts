// Mories Deo Hutapea,S.E.,S.Kom

import { describe, expect, it, vi } from "vitest";
import { markApiAvailable, markApiUnavailable, subscribeApiReachability } from "./networkSignal";

describe("API reachability signal", () => {
  it("notifies every listener when the API becomes unavailable or available", () => {
    const listener = vi.fn();
    subscribeApiReachability(listener);

    markApiUnavailable();
    markApiAvailable();

    expect(listener).toHaveBeenNthCalledWith(1, false);
    expect(listener).toHaveBeenNthCalledWith(2, true);
  });

  it("stops notifying a listener once it unsubscribes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeApiReachability(listener);
    unsubscribe();

    markApiUnavailable();

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not affect other listeners when one unsubscribes", () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeApiReachability(first);
    subscribeApiReachability(second);
    unsubscribeFirst();

    markApiAvailable();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(true);
  });
});
