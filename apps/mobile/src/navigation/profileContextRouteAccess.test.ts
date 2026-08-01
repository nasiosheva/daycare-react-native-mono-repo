import { describe, expect, it } from "vitest";
import { shouldRedirectUntilProfileLoaded } from "./profileContextRouteAccess";

describe("profile context route access", () => {
  it("holds scoped routes at Home while an authenticated profile is unavailable", () => {
    expect(shouldRedirectUntilProfileLoaded(true, false, "/booking")).toBe(true);
    expect(shouldRedirectUntilProfileLoaded(true, false, "/parent-payment")).toBe(true);
  });

  it("keeps the retry Home and identity-registration routes available", () => {
    expect(shouldRedirectUntilProfileLoaded(true, false, "/home")).toBe(false);
    expect(shouldRedirectUntilProfileLoaded(true, false, "/sign-up")).toBe(false);
    expect(shouldRedirectUntilProfileLoaded(false, false, "/booking")).toBe(false);
    expect(shouldRedirectUntilProfileLoaded(true, true, "/booking")).toBe(false);
  });
});
