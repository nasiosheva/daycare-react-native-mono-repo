export const MAX_INLINE_WIZARD_STEPS = 4;

export type MultiStepFormWizardStep = {
  id: string;
  label: string;
};

export function normalizeWizardStepIndex(currentStep: number, stepCount: number): number {
  if (stepCount <= 0 || !Number.isFinite(currentStep)) return 0;
  return Math.min(Math.max(Math.trunc(currentStep), 0), stepCount - 1);
}

export function shouldScrollWizardSteps(stepCount: number): boolean {
  return stepCount > MAX_INLINE_WIZARD_STEPS;
}

export function isWizardConnectorActive(targetStepIndex: number, currentStepIndex: number): boolean {
  return targetStepIndex <= currentStepIndex;
}
