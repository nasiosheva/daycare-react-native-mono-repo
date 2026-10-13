// Mories Deo Hutapea,S.E.,S.Kom
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useEffect: vi.fn((effect: () => void) => effect()),
  useRef: vi.fn((current: unknown) => ({ current })),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: mocks.useEffect,
  useRef: mocks.useRef,
}));

vi.mock("react-native", () => ({
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles },
  View: "View",
}));

vi.mock("./AppText", () => ({ AppText: "AppText" }));

import { MultiStepFormWizard } from "./MultiStepFormWizard";

type TestElement = ReactElement<Record<string, unknown>>;

function findElements(node: ReactNode, predicate: (element: TestElement) => boolean): TestElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, predicate));
  if (!isValidElement(node)) return [];

  const element = node as TestElement;
  const children = element.props.children as ReactNode;
  return [...(predicate(element) ? [element] : []), ...findElements(children, predicate)];
}

const steps = [
  { id: "details", label: "Details" },
  { id: "contact", label: "Contact" },
  { id: "review", label: "Review" },
];

describe("MultiStepFormWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useEffect.mockImplementation((effect) => effect());
    mocks.useRef.mockImplementation((current) => ({ current }));
  });

  it("exposes controlled progress and selected step semantics", () => {
    const tree = MultiStepFormWizard({
      steps,
      currentStep: 1,
      accessibilityLabel: "Enrollment progress",
      progressLabel: "2 of 3",
      children: "Contact details form",
    });

    const progress = findElements(tree, (element) => element.props.accessibilityRole === "progressbar")[0]!;
    expect(progress.props.accessibilityLabel).toBe("Enrollment progress");
    expect(progress.props.accessibilityValue).toEqual({ min: 1, max: 3, now: 2 });

    const items = findElements(tree, (element) => element.props.accessible === true);
    expect(items.map((item) => item.props.accessibilityLabel)).toEqual(["1. Details", "2. Contact", "3. Review"]);
    expect(items.map((item) => item.props.accessibilityState)).toEqual([
      { selected: false },
      { selected: true },
      { selected: false },
    ]);
    expect(findElements(tree, (element) => element.type === "AppText").some((element) => element.props.children === "2 of 3")).toBe(true);
  });

  it("clamps an out-of-range step to the final step and keeps the form content", () => {
    const tree = MultiStepFormWizard({ steps, currentStep: 99, children: "Review form" });
    const progress = findElements(tree, (element) => element.props.accessibilityRole === "progressbar")[0]!;
    const items = findElements(tree, (element) => element.props.accessible === true);

    expect(progress.props.accessibilityValue).toEqual({ min: 1, max: 3, now: 3 });
    expect(items[2]!.props.accessibilityState).toEqual({ selected: true });
    expect(findElements(tree, (element) => element.props.children === "Review form")).toHaveLength(1);
  });

  it("scrolls the stepper to the controlled current step when there are many steps", () => {
    const scrollTo = vi.fn();
    mocks.useRef.mockReturnValueOnce({ current: { scrollTo } });
    const manySteps = Array.from({ length: 5 }, (_, index) => ({ id: `step-${index}`, label: `Step ${index + 1}` }));

    const tree = MultiStepFormWizard({ steps: manySteps, currentStep: 3, children: "Current step" });

    expect(findElements(tree, (element) => element.type === "ScrollView")).toHaveLength(1);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ animated: true }));
    expect(findElements(tree, (element) => element.props.accessibilityRole === "progressbar")[0]!.props.accessibilityValue).toEqual({
      min: 1,
      max: 5,
      now: 4,
    });
  });

  it("omits progress semantics when no steps are available", () => {
    const tree = MultiStepFormWizard({ steps: [], currentStep: 0, children: "Empty wizard content" });

    expect(findElements(tree, (element) => element.props.accessibilityRole === "progressbar")).toHaveLength(0);
    expect(findElements(tree, (element) => element.props.children === "Empty wizard content")).toHaveLength(1);
  });
});
