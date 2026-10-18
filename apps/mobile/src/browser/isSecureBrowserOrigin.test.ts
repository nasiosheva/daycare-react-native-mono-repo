// Mories Deo Hutapea,S.E.,S.Kom
import { describe, expect, it } from "vitest";
import { isSecureBrowserOrigin } from "./isSecureBrowserOrigin";

describe("isSecureBrowserOrigin", () => {
  it("allows HTTPS origins", () => {
    expect(isSecureBrowserOrigin("https:", "example.com")).toBe(true);
  });

  it("allows loopback origins for local development", () => {
    expect(isSecureBrowserOrigin("http:", "localhost")).toBe(true);
    expect(isSecureBrowserOrigin("http:", "127.0.0.1")).toBe(true);
    expect(isSecureBrowserOrigin("http:", "[::1]")).toBe(true);
  });

  it("rejects other insecure origins", () => {
    expect(isSecureBrowserOrigin("http:", "192.168.1.10")).toBe(false);
    expect(isSecureBrowserOrigin("file:", "")).toBe(false);
  });
});
