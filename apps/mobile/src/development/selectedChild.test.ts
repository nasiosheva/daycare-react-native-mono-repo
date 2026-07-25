import { describe, expect, it } from "vitest";
import { resolveSelectedChildId } from "./selectedChild";

describe("resolveSelectedChildId", () => {
  const children = [{ id: "child-a" }, { id: "child-b" }];

  it("uses a valid child from the route for the initial selection", () => {
    expect(resolveSelectedChildId(children, null, "child-b")).toBe("child-b");
  });

  it("keeps a manually selected child when the route has no child", () => {
    expect(resolveSelectedChildId(children, "child-b")).toBe("child-b");
  });

  it("falls back to the current or first available child when the route is stale", () => {
    expect(resolveSelectedChildId(children, "child-b", "removed-child")).toBe("child-b");
    expect(resolveSelectedChildId(children, null, "removed-child")).toBe("child-a");
  });

  it("does not switch to another child when the route is locked", () => {
    expect(resolveSelectedChildId(children, "child-b", "removed-child", true)).toBeNull();
  });
});
