import { describe, expect, it, vi } from "vitest";
import { publishInlineFeedback, subscribeInlineFeedback } from "./InlineFeedback";

describe("inline feedback", () => {
  it("delivers feedback to mounted screen listeners and removes unsubscribed listeners", () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeInlineFeedback(first);

    publishInlineFeedback("First message");
    const unsubscribeSecond = subscribeInlineFeedback(second);
    publishInlineFeedback("Second message", "Details");

    expect(first).toHaveBeenNthCalledWith(2, { title: "Second message", message: "Details" });
    expect(second).toHaveBeenCalledWith({ title: "Second message", message: "Details" });

    unsubscribeFirst();
    unsubscribeSecond();
    publishInlineFeedback("Ignored");
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
