// Mories Deo Hutapea,S.E.,S.Kom
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  View: "View",
}));

vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("./AppText", () => ({ AppText: "AppText" }));

import { Button } from "./Button";
import { Chip, ChipGroup } from "./Chip";
import { EmptyState, ErrorState } from "./EmptyState";
import { NavigationCard } from "./NavigationCard";
import { ToggleSwitch } from "./ToggleSwitch";

type TestElement = ReactElement<Record<string, unknown>>;

function findElements(node: ReactNode, predicate: (element: TestElement) => boolean): TestElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, predicate));
  if (!isValidElement(node)) return [];

  const element = node as TestElement;
  const children = element.props.children as ReactNode;
  return [...(predicate(element) ? [element] : []), ...findElements(children, predicate)];
}

function pressable(node: ReactNode): TestElement {
  return firstElement(findElements(node, (candidate) => candidate.type === "Pressable"), "Pressable");
}

function firstElement(elements: TestElement[], name: string): TestElement {
  const element = elements[0];
  if (!element) throw new Error(`Expected ${name} element`);
  return element;
}

function pressStyle(node: ReactNode, pressed: boolean): unknown[] {
  const style = pressable(node).props.style;
  if (typeof style !== "function") throw new Error("Expected a Pressable style callback");
  return (style as (state: { pressed: boolean }) => unknown[])({ pressed });
}

describe("shared controls", () => {
  it("Button exposes loading and disabled state accessibly and replaces its leading icon while loading", () => {
    const onPress = vi.fn();
    const icon = createElement("Icon", { key: "leading-icon" });
    const loadingButton = Button({ children: "Saving", onPress, loading: true, leadingIcon: icon, accessibilityLabel: "Save changes" });
    const loadingPressable = pressable(loadingButton);

    expect(loadingPressable.props.accessibilityRole).toBe("button");
    expect(loadingPressable.props.accessibilityLabel).toBe("Save changes");
    expect(loadingPressable.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(loadingPressable.props.disabled).toBe(true);
    expect(findElements(loadingButton, (element) => element.type === "ActivityIndicator")).toHaveLength(1);
    expect(findElements(loadingButton, (element) => element.type === "Icon")).toHaveLength(0);

    const actionableButton = Button({ children: "Continue", onPress, leadingIcon: icon });
    (pressable(actionableButton).props.onPress as () => void)();
    expect(onPress).toHaveBeenCalledOnce();
    expect(findElements(actionableButton, (element) => element.type === "Icon")).toHaveLength(1);

    const disabledButton = Button({ children: "Delete", onPress, variant: "danger", disabled: true });
    expect(pressable(disabledButton).props.accessibilityState).toEqual({ disabled: true, busy: false });

    const dangerButton = Button({ children: "Delete", onPress, variant: "danger" });
    expect(findElements(dangerButton, (element) => element.type === "AppText")[0]!.props.style).toBeDefined();
    const secondaryButton = Button({ children: "Later", onPress, variant: "secondary" });
    expect(findElements(secondaryButton, (element) => element.type === "AppText")[0]!.props.style).toBeUndefined();
  });

  it("ToggleSwitch reports checked/disabled state and emits the inverse value", () => {
    const onValueChange = vi.fn();
    const switchNode = ToggleSwitch({
      label: "Push notifications",
      description: "Receive chat alerts",
      value: false,
      onValueChange,
      accessibilityLabel: "Push notification setting",
    });
    const control = pressable(switchNode);

    expect(control.props.accessibilityRole).toBe("switch");
    expect(control.props.accessibilityLabel).toBe("Push notification setting");
    expect(control.props.accessibilityHint).toBe("Receive chat alerts");
    expect(control.props.accessibilityState).toEqual({ checked: false, disabled: false });
    (control.props.onPress as () => void)();
    expect(onValueChange).toHaveBeenCalledWith(true);

    const disabledNode = ToggleSwitch({ label: "Offline mode", value: true, onValueChange, accessibilityLabel: "Offline mode", disabled: true });
    expect(pressable(disabledNode).props.accessibilityState).toEqual({ checked: true, disabled: true });
    expect(pressable(disabledNode).props.disabled).toBe(true);
  });

  it("NavigationCard wires its action and preserves disabled accessibility state", () => {
    const onPress = vi.fn();
    const card = NavigationCard({ children: "Open child profile", onPress, accessibilityLabel: "Child profile" });
    const control = pressable(card);

    expect(control.props.accessibilityLabel).toBe("Child profile");
    expect(control.props.accessibilityState).toEqual({ disabled: false });
    (control.props.onPress as () => void)();
    expect(onPress).toHaveBeenCalledOnce();
    expect(findElements(card, (element) => element.type === "Ionicons" && element.props.name === "chevron-forward")).toHaveLength(1);

    const disabledCard = NavigationCard({ children: "Unavailable", onPress, accessibilityLabel: "Unavailable action", disabled: true });
    expect(pressable(disabledCard).props.disabled).toBe(true);
    expect(pressable(disabledCard).props.accessibilityState).toEqual({ disabled: true });
  });

  it("Chip communicates selection and disabled state and ChipGroup exposes radio-group semantics", () => {
    const onPress = vi.fn();
    const selected = Chip({ label: "Indonesian", selected: true, onPress, accessibilityLabel: "Indonesian language" });
    const selectedControl = pressable(selected);

    expect(selectedControl.props.accessibilityRole).toBe("radio");
    expect(selectedControl.props.accessibilityLabel).toBe("Indonesian language");
    expect(selectedControl.props.accessibilityState).toEqual({ checked: true, disabled: false });
    expect(findElements(selected, (element) => element.type === "Ionicons" && element.props.name === "checkmark")).toHaveLength(1);
    (selectedControl.props.onPress as () => void)();
    expect(onPress).toHaveBeenCalledOnce();

    const disabled = Chip({ label: "Other", selected: false, onPress, disabled: true });
    expect(pressable(disabled).props.accessibilityState).toEqual({ checked: false, disabled: true });
    const group = firstElement(
      findElements(ChipGroup({ children: selected, accessibilityLabel: "Available languages" }), (element) => element.type === "View"),
      "ChipGroup View",
    );
    expect(group.props.accessibilityRole).toBe("radiogroup");
    expect(group.props.accessibilityLabel).toBe("Available languages");
  });

  it("EmptyState offers its action, while ErrorState exposes an alert and retry action", () => {
    const onAdd = vi.fn();
    const empty = EmptyState({ title: "No children", description: "Add a child to get started.", action: { label: "Add child", onPress: onAdd } });
    const addButton = firstElement(findElements(empty, (element) => element.type === Button), "EmptyState action");

    expect(findElements(empty, (element) => element.props.children === "No children")).toHaveLength(1);
    expect(addButton.props.children).toBe("Add child");
    (addButton.props.onPress as () => void)();
    expect(onAdd).toHaveBeenCalledOnce();

    const onRetry = vi.fn();
    const error = ErrorState({ title: "Could not load", description: "Check your connection.", retryLabel: "Try again", onRetry });
    expect(findElements(error, (element) => element.props.accessibilityRole === "alert")).toHaveLength(1);
    const retryButton = firstElement(findElements(error, (element) => element.type === Button), "ErrorState retry action");
    expect(retryButton.props.children).toBe("Try again");
    (retryButton.props.onPress as () => void)();
    expect(onRetry).toHaveBeenCalledOnce();

    const noRetry = ErrorState({ title: "Still unavailable", retryLabel: "Try again" });
    expect(findElements(noRetry, (element) => element.type === Button)).toHaveLength(0);
  });

  it("applies pressed feedback only while interactive controls are enabled", () => {
    const onPress = vi.fn();
    const onToggle = vi.fn();
    const cases = [
      { node: Button({ children: "Continue", onPress }), activeOpacity: 0.82 },
      { node: ToggleSwitch({ label: "Alerts", value: false, onValueChange: onToggle, accessibilityLabel: "Alerts" }), activeOpacity: 0.8 },
      { node: Chip({ label: "Option", selected: false, onPress }), activeOpacity: 0.8 },
      { node: NavigationCard({ children: "Open", onPress, accessibilityLabel: "Open" }), activeOpacity: 0.78 },
    ];

    for (const { node, activeOpacity } of cases) {
      expect(pressStyle(node, true)).toContainEqual(expect.objectContaining({ opacity: activeOpacity }));
    }

    const loadingButton = Button({ children: "Saving", onPress, loading: true });
    const loadingStyles = pressStyle(loadingButton, true);
    expect(pressable(loadingButton).props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(loadingStyles).not.toContainEqual(expect.objectContaining({ opacity: 0.82 }));

    const inactiveCases = [
      { node: ToggleSwitch({ label: "Alerts", value: false, onValueChange: onToggle, accessibilityLabel: "Alerts", disabled: true }), opacity: 0.6 },
      { node: Chip({ label: "Option", selected: false, onPress, disabled: true }), opacity: 0.5 },
      { node: NavigationCard({ children: "Unavailable", onPress, accessibilityLabel: "Unavailable", disabled: true }), opacity: 0.5 },
    ];

    for (const { node, opacity } of inactiveCases) {
      const styles = pressStyle(node, true);
      expect(styles).toContainEqual(expect.objectContaining({ opacity }));
      expect(styles).not.toContainEqual(expect.objectContaining({ opacity: 0.82 }));
      expect(styles).not.toContainEqual(expect.objectContaining({ opacity: 0.8 }));
      expect(styles).not.toContainEqual(expect.objectContaining({ opacity: 0.78 }));
    }
  });

  it("renders compact empty and error states without optional guidance or actions", () => {
    const empty = EmptyState({ title: "No results", compact: true, icon: "search" });
    const emptyTexts = findElements(empty, (element) => element.type === "AppText");
    const emptyText = firstElement(emptyTexts, "EmptyState title");
    const emptyIcon = firstElement(findElements(empty, (element) => element.type === "Ionicons"), "EmptyState icon");

    expect(emptyTexts).toHaveLength(1);
    expect(emptyText.props.variant).toBe("label");
    expect(emptyText.props.children).toBe("No results");
    expect(emptyIcon.props.name).toBe("search");
    expect(emptyIcon.props.size).toBe(22);
    expect(findElements(empty, (element) => element.type === Button)).toHaveLength(0);

    const error = ErrorState({ title: "Unavailable", compact: true, onRetry: vi.fn() });
    const errorTexts = findElements(error, (element) => element.type === "AppText");
    const errorText = firstElement(errorTexts, "ErrorState title");
    const errorIcon = firstElement(findElements(error, (element) => element.type === "Ionicons"), "ErrorState icon");

    expect(findElements(error, (element) => element.props.accessibilityRole === "alert")).toHaveLength(1);
    expect(errorTexts).toHaveLength(1);
    expect(errorText.props.variant).toBe("label");
    expect(errorIcon.props.size).toBe(22);
    expect(findElements(error, (element) => element.type === Button)).toHaveLength(0);
  });
});
