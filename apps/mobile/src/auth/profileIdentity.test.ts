import { describe, expect, it } from "vitest";
import { profileForCurrentIdentity, profileIdentityChanged } from "./profileIdentity";

describe("profileForCurrentIdentity", () => {
  it("does not expose a profile loaded for a different signed-in identity", () => {
    const profile = { id: "profile-for-first-account" };

    expect(profileForCurrentIdentity(profile, "first-session", "second-session")).toBeNull();
    expect(profileForCurrentIdentity(profile, "first-session", null)).toBeNull();
  });

  it("exposes only the profile loaded for the current identity", () => {
    const profile = { id: "current-profile" };

    expect(profileForCurrentIdentity(profile, "current-session", "current-session")).toBe(profile);
  });

  it("resets profile context when the token or authenticated session changes", () => {
    expect(profileIdentityChanged(undefined, "first-session")).toBe(false);
    expect(profileIdentityChanged("first-session", "second-session")).toBe(true);
    expect(profileIdentityChanged("first-session", null)).toBe(true);
  });
});
