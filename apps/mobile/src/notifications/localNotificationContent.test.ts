import { afterEach, describe, expect, it } from "vitest";
import { createLocalNotificationDeduper, isActiveLocalNotificationScope, localNotificationContent, localNotificationScopeKey, setActiveLocalNotificationScope } from "./localNotificationContent";
import { isMuteActive } from "./mutePreferences";

describe("localNotificationContent", () => {
  it("uses the shared actionPath/organizationId data contract read by the notification route handler", () => {
    expect(localNotificationContent({ title: "Title", body: "Body", actionPath: "/child-messages?childId=child-a", organizationId: "tenant-a" })).toEqual({
      title: "Title",
      body: "Body",
      sound: "default",
      data: { actionPath: "/child-messages?childId=child-a", organizationId: "tenant-a" },
    });
  });

  it("omits routing data that was not provided", () => {
    expect(localNotificationContent({ title: "Title", body: "Body", organizationId: null }).data).toEqual({});
  });
});

describe("local notification scope", () => {
  afterEach(() => setActiveLocalNotificationScope(null));

  it("matches only the focused scope key", () => {
    const scope = localNotificationScopeKey("child-messages", "tenant-a", "child-a");
    setActiveLocalNotificationScope(scope);

    expect(scope).toBe("child-messages:tenant-a:child-a");
    expect(isActiveLocalNotificationScope(scope)).toBe(true);
    expect(isActiveLocalNotificationScope(localNotificationScopeKey("child-messages", "tenant-a", "child-b"))).toBe(false);
  });
});

describe("createLocalNotificationDeduper", () => {
  it("claims an id once and forgets the oldest id beyond its capacity", () => {
    const deduper = createLocalNotificationDeduper(2);

    expect(deduper.claim("a")).toBe(true);
    expect(deduper.claim("a")).toBe(false);
    deduper.claim("b");
    deduper.claim("c");
    expect(deduper.claim("a")).toBe(true);
  });
});

describe("isMuteActive", () => {
  const now = new Date("2026-10-06T12:00:00Z");

  it("is active only for a valid future timestamp", () => {
    expect(isMuteActive("2026-10-06T13:00:00Z", now)).toBe(true);
    expect(isMuteActive("2026-10-06T11:00:00Z", now)).toBe(false);
    expect(isMuteActive("not-a-date", now)).toBe(false);
    expect(isMuteActive(null, now)).toBe(false);
    expect(isMuteActive(undefined, now)).toBe(false);
  });
});
