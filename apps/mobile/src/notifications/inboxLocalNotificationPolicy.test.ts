import { afterEach, describe, expect, it } from "vitest";
import { inboxNotificationIdFrom, inboxNotificationScope, shouldPresentInboxLocalNotification } from "./inboxLocalNotificationPolicy";
import { setActiveLocalNotificationScope } from "./localNotificationContent";

describe("inbox local notification policy", () => {
  afterEach(() => setActiveLocalNotificationScope(null));

  it("reads the inbox notification id only from NOTIFICATIONS events", () => {
    expect(inboxNotificationIdFrom({ flags: ["NOTIFICATIONS", "INVOICES"], payload: { notificationId: "n-1", actionPath: "/booking" } })).toBe("n-1");
    expect(inboxNotificationIdFrom({ flags: ["INVOICES"], payload: { notificationId: "n-1" } })).toBeNull();
    expect(inboxNotificationIdFrom({ flags: ["NOTIFICATIONS"], payload: null })).toBeNull();
  });

  it("stays silent while muted or while the inbox is open in the foreground", () => {
    const now = new Date("2026-10-07T08:00:00Z");
    expect(shouldPresentInboxLocalNotification({ appIsActive: false, now })).toBe(true);
    expect(shouldPresentInboxLocalNotification({ appIsActive: false, mutedUntil: "2026-10-07T09:00:00Z", now })).toBe(false);

    setActiveLocalNotificationScope(inboxNotificationScope);
    expect(shouldPresentInboxLocalNotification({ appIsActive: true, now })).toBe(false);
    expect(shouldPresentInboxLocalNotification({ appIsActive: false, now })).toBe(true);
  });
});
