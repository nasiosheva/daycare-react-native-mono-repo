import { describe, expect, it } from "vitest";
import { pendingActionState } from "./pendingAction";

describe("pendingActionState", () => {
  it("shows the spinner only on the row in flight and disables the same action elsewhere", () => {
    const mutation = { isPending: true, variables: "row-a" };

    expect(pendingActionState(mutation, (id) => id === "row-a")).toEqual({ loading: true, disabled: false });
    expect(pendingActionState(mutation, (id) => id === "row-b")).toEqual({ loading: false, disabled: true });
  });

  it("leaves every row idle and enabled when nothing is in flight", () => {
    expect(pendingActionState({ isPending: false, variables: "row-a" }, (id) => id === "row-a")).toEqual({ loading: false, disabled: false });
    expect(pendingActionState<string>({ isPending: false }, () => true)).toEqual({ loading: false, disabled: false });
  });

  it("tells two actions on the same row apart", () => {
    const mutation = { isPending: true, variables: { definitionId: "consent-a", granted: true } };

    expect(pendingActionState(mutation, (v) => v.definitionId === "consent-a" && v.granted)).toEqual({ loading: true, disabled: false });
    expect(pendingActionState(mutation, (v) => v.definitionId === "consent-a" && !v.granted)).toEqual({ loading: false, disabled: true });
  });
});
