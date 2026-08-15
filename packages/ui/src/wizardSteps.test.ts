import { describe, expect, it } from "vitest";
import { isWizardConnectorActive, MAX_INLINE_WIZARD_STEPS, normalizeWizardStepIndex, shouldScrollWizardSteps } from "./wizardSteps";

describe("multi-step form wizard", () => {
  it("supports one or many controlled steps", () => {
    expect(normalizeWizardStepIndex(0, 1)).toBe(0);
    expect(normalizeWizardStepIndex(3, 4)).toBe(3);
    expect(normalizeWizardStepIndex(7, 10)).toBe(7);
  });

  it("keeps an invalid controlled index inside the available range", () => {
    expect(normalizeWizardStepIndex(-1, 3)).toBe(0);
    expect(normalizeWizardStepIndex(8, 3)).toBe(2);
    expect(normalizeWizardStepIndex(Number.NaN, 3)).toBe(0);
    expect(normalizeWizardStepIndex(2, 0)).toBe(0);
  });

  it("uses horizontal scrolling only when the inline step limit is exceeded", () => {
    expect(shouldScrollWizardSteps(MAX_INLINE_WIZARD_STEPS)).toBe(false);
    expect(shouldScrollWizardSteps(MAX_INLINE_WIZARD_STEPS + 1)).toBe(true);
  });

  it("activates a connector only after its destination step is reached", () => {
    expect(isWizardConnectorActive(1, 0)).toBe(false);
    expect(isWizardConnectorActive(1, 1)).toBe(true);
    expect(isWizardConnectorActive(2, 1)).toBe(false);
  });
});
