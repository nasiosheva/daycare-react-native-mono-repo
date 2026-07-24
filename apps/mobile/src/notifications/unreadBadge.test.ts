import { describe, expect, it } from "vitest";
import { NOTIFICATION_BADGE_MAX_COUNT, unreadNotificationBadge, unreadNotificationCount } from "./unreadBadge";

describe("unread notification badge", () => {
  it("counts unread notifications and omits an empty badge", () => {
    expect(unreadNotificationCount([{ readAt: null }, { readAt: "2026-07-24T10:00:00Z" }])).toBe(1);
    expect(unreadNotificationBadge(0)).toBeUndefined();
  });

  it("caps a large unread count with a plus badge", () => {
    expect(unreadNotificationBadge(NOTIFICATION_BADGE_MAX_COUNT + 1)).toBe(`${NOTIFICATION_BADGE_MAX_COUNT}+`);
  });
});
