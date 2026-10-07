import { describe, expect, it } from "vitest";
import { resolveAppVersionInfo } from "./versionInfo";

describe("resolveAppVersionInfo", () => {
  it("uses the installed native application and build versions when available", () => {
    expect(resolveAppVersionInfo({
      nativeApplicationVersion: "0.1.0",
      nativeBuildVersion: "1",
      configuredVersion: "0.0.9",
    })).toEqual({ version: "0.1.0", buildCode: "1" });
  });

  it("uses the configured version only when a native version is unavailable", () => {
    expect(resolveAppVersionInfo({ configuredVersion: "0.1.0" })).toEqual({ version: "0.1.0", buildCode: null });
  });

  it("does not present blank metadata as a version", () => {
    expect(resolveAppVersionInfo({ nativeApplicationVersion: " ", nativeBuildVersion: "  " })).toEqual({ version: null, buildCode: null });
  });
});
