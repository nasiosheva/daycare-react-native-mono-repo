import { beforeEach, describe, expect, it } from "vitest";
import { childMessageLocalNotificationFor, childMessageNotificationScope, resetChildMessageLocalNotificationState } from "./childMessageLocalNotificationPolicy";
import { setActiveLocalNotificationScope } from "./localNotificationContent";

const created = (messageId = "message-a", childId = "child-a") => ({
  flags: ["CHILD_MESSAGES" as const],
  organizationId: "tenant-a",
  payload: { childId, messageId, event: "MESSAGE_CREATED" },
});

describe("childMessageLocalNotificationFor", () => {
  beforeEach(() => {
    resetChildMessageLocalNotificationState();
    setActiveLocalNotificationScope(null);
  });

  it("turns a new incoming message into a local notification that opens its thread", () => {
    expect(childMessageLocalNotificationFor(created(), { appIsActive: false })).toEqual({
      organizationId: "tenant-a",
      childId: "child-a",
      messageId: "message-a",
      actionPath: "/child-messages?childId=child-a",
    });
  });

  it("stays silent for read receipts, payloads from older APIs, and unrelated flags", () => {
    expect(childMessageLocalNotificationFor({ ...created(), payload: { childId: "child-a", messageId: "message-a", event: "MESSAGE_READ" } }, { appIsActive: false })).toBeNull();
    expect(childMessageLocalNotificationFor({ ...created(), payload: { childId: "child-a", messageId: "message-a" } }, { appIsActive: false })).toBeNull();
    expect(childMessageLocalNotificationFor({ ...created(), flags: ["NOTIFICATIONS"] }, { appIsActive: false })).toBeNull();
    expect(childMessageLocalNotificationFor({ ...created(), organizationId: null }, { appIsActive: false })).toBeNull();
  });

  it("respects the device mute window", () => {
    const now = new Date("2026-10-06T12:00:00Z");
    expect(childMessageLocalNotificationFor(created(), { appIsActive: false, mutedUntil: "2026-10-06T13:00:00Z", now })).toBeNull();
    expect(childMessageLocalNotificationFor(created(), { appIsActive: false, mutedUntil: "2026-10-06T11:00:00Z", now })).not.toBeNull();
  });

  it("skips the thread the user is reading in the foreground but not other threads or the background", () => {
    setActiveLocalNotificationScope(childMessageNotificationScope("tenant-a", "child-a"));

    expect(childMessageLocalNotificationFor(created("message-a"), { appIsActive: true })).toBeNull();
    expect(childMessageLocalNotificationFor(created("message-b", "child-b"), { appIsActive: true })).not.toBeNull();
    expect(childMessageLocalNotificationFor(created("message-c"), { appIsActive: false })).not.toBeNull();
  });

  it("notifies a message only once even when the event is replayed", () => {
    expect(childMessageLocalNotificationFor(created(), { appIsActive: false })).not.toBeNull();
    expect(childMessageLocalNotificationFor(created(), { appIsActive: false })).toBeNull();
  });
});
