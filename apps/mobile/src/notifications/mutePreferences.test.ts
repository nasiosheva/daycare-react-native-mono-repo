import { describe, expect, it } from "vitest";
import { notificationMuteDurationKeys, notificationMuteDurationMilliseconds, notificationMuteDurations } from "./mutePreferences";

describe("notification mute preferences", () => {
  it("exposes every supported duration with a localized label and positive duration", () => {
    expect(notificationMuteDurations).toEqual(["ONE_HOUR", "ONE_WEEK", "ONE_MONTH"]);
    for (const duration of notificationMuteDurations) {
      expect(notificationMuteDurationKeys[duration]).toMatch(/^notifications\.mute/);
      expect(notificationMuteDurationMilliseconds[duration]).toBeGreaterThan(0);
    }
  });
});
