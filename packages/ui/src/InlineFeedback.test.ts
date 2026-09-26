import { describe, expect, it, vi } from "vitest";
import { inlineFeedbackDuration, publishInlineFeedback, subscribeInlineFeedback } from "./InlineFeedback";

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

describe("inline feedback tone", () => {
  it("carries the tone when one is given", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeInlineFeedback(listener);
    publishInlineFeedback("Saved", undefined, "success");
    expect(listener).toHaveBeenCalledWith({ title: "Saved", message: undefined, tone: "success" });
    unsubscribe();
  });

  it("keeps errors and long messages visible for longer", () => {
    expect(inlineFeedbackDuration({ title: "Saved", tone: "success" })).toBe(5000);
    expect(inlineFeedbackDuration({ title: "Failed", tone: "danger" })).toBe(9000);
    expect(inlineFeedbackDuration({ title: "Failed", message: "Network error", tone: "danger" })).toBe(11000);
  });
});
