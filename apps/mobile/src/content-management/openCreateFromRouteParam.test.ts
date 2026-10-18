// Mories Deo Hutapea,S.E.,S.Kom
import { describe, expect, it } from "vitest";
import { shouldOpenCreateForm } from "./openCreateFromRouteParam";

describe("shouldOpenCreateForm", () => {
  it("opens the create form only for an authorized create route", () => {
    expect(shouldOpenCreateForm("1", true)).toBe(true);
    expect(shouldOpenCreateForm(["1"], true)).toBe(true);
    expect(shouldOpenCreateForm("1", false)).toBe(false);
    expect(shouldOpenCreateForm(undefined, true)).toBe(false);
    expect(shouldOpenCreateForm("0", true)).toBe(false);
  });
});
