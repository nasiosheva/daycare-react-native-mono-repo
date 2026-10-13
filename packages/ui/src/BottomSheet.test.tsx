// Mories Deo Hutapea,S.E.,S.Kom
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useCallback: vi.fn((callback: (...args: never[]) => unknown) => callback),
  useEffect: vi.fn((effect: () => void) => effect()),
  useMemo: vi.fn((factory: () => unknown) => factory()),
  useRef: vi.fn((current: unknown) => ({ current })),
  timing: vi.fn(),
  spring: vi.fn(),
  panResponderCreate: vi.fn((handlers) => ({ panHandlers: handlers })),
  animatedSetValue: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useCallback: mocks.useCallback,
  useEffect: mocks.useEffect,
  useMemo: mocks.useMemo,
  useRef: mocks.useRef,
}));

vi.mock("react-native", () => ({
  Animated: {
    Value: class {
      setValue = mocks.animatedSetValue;
    },
    timing: mocks.timing,
    spring: mocks.spring,
    View: "AnimatedView",
  },
  Modal: "Modal",
  PanResponder: { create: mocks.panResponderCreate },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { absoluteFill: { position: "absolute" }, create: (styles: unknown) => styles },
  View: "View",
}));

vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("./AppText", () => ({ AppText: "AppText" }));
vi.mock("./Button", () => ({ Button: "Button" }));

import { BottomSheet } from "./BottomSheet";

type TestElement = ReactElement<Record<string, unknown>>;

function findElements(node: ReactNode, predicate: (element: TestElement) => boolean): TestElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, predicate));
  if (!isValidElement(node)) return [];

  const element = node as TestElement;
  const children = element.props.children as ReactNode;
  return [...(predicate(element) ? [element] : []), ...findElements(children, predicate)];
}

describe("BottomSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCallback.mockImplementation((callback) => callback);
    mocks.useEffect.mockImplementation((effect) => effect());
    mocks.useMemo.mockImplementation((factory) => factory());
    mocks.useRef.mockImplementation((current) => ({ current }));
    mocks.timing.mockImplementation((_value, _config) => ({ start: (callback?: (result: { finished: boolean }) => void) => callback?.({ finished: true }) }));
    mocks.spring.mockImplementation(() => ({ start: vi.fn() }));
  });

  it("shows its title, content, and actions while forwarding action state and callbacks", () => {
    const onCancel = vi.fn();
    const onSave = vi.fn();
    const tree = BottomSheet({
      visible: true,
      onClose: vi.fn(),
      title: "Edit profile",
      negativeAction: { label: "Cancel", onPress: onCancel, disabled: true },
      positiveAction: { label: "Save", onPress: onSave, loading: true },
      children: "Profile form",
    });

    expect(findElements(tree, (element) => element.type === "Modal")[0]!.props.visible).toBe(true);
    expect(findElements(tree, (element) => element.type === "AppText").some((element) => element.props.children === "Edit profile")).toBe(true);
    expect(findElements(tree, (element) => element.type === "ScrollView").some((element) => element.props.children === "Profile form")).toBe(true);

    const buttons = findElements(tree, (element) => element.type === "Button");
    expect(buttons.map((button) => button.props.children)).toEqual(["Cancel", "Save"]);
    expect(buttons[0]!.props.disabled).toBe(true);
    expect(buttons[1]!.props.loading).toBe(true);
    (buttons[0]!.props.onPress as () => void)();
    (buttons[1]!.props.onPress as () => void)();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("closes only after the dismiss animation completes", () => {
    const onClose = vi.fn();
    const tree = BottomSheet({ visible: true, onClose, closeAccessibilityLabel: "Dismiss sheet", children: "Body" });
    const closeControls = findElements(tree, (element) => element.type === "Pressable" && element.props.accessibilityLabel === "Dismiss sheet");
    expect(closeControls).toHaveLength(2);

    (closeControls[1]!.props.onPress as () => void)();
    expect(mocks.timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 420 }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close when the dismiss animation is interrupted", () => {
    mocks.timing.mockImplementation((_value, _config) => ({ start: (callback?: (result: { finished: boolean }) => void) => callback?.({ finished: false }) }));
    const onClose = vi.fn();
    const tree = BottomSheet({ visible: true, onClose, children: "Body" });
    const closeButton = findElements(tree, (element) => element.type === "Pressable" && element.props.accessibilityLabel === "Close")[1];

    (closeButton!.props.onPress as () => void)();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("handles vertical drag gestures and dismisses after a long downward swipe", () => {
    const onClose = vi.fn();
    BottomSheet({ visible: true, onClose, children: "Body" });
    const handlers = mocks.panResponderCreate.mock.calls[0]?.[0] as {
      onMoveShouldSetPanResponder: (event: unknown, gesture: { dx: number; dy: number }) => boolean;
      onPanResponderMove: (event: unknown, gesture: { dy: number }) => void;
      onPanResponderRelease: (event: unknown, gesture: { dy: number; vy: number }) => void;
      onPanResponderTerminate: () => void;
    };

    expect(handlers.onMoveShouldSetPanResponder({}, { dx: 1, dy: 7 })).toBe(true);
    expect(handlers.onMoveShouldSetPanResponder({}, { dx: 8, dy: 7 })).toBe(false);
    expect(handlers.onMoveShouldSetPanResponder({}, { dx: 1, dy: 6 })).toBe(false);
    handlers.onPanResponderMove({}, { dy: -5 });
    expect(mocks.animatedSetValue).toHaveBeenCalledWith(0);
    handlers.onPanResponderMove({}, { dy: 32 });
    expect(mocks.animatedSetValue).toHaveBeenCalledWith(32);

    handlers.onPanResponderRelease({}, { dy: 121, vy: 0 });
    expect(mocks.timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 420 }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("springs the sheet back when a swipe is short or interrupted", () => {
    BottomSheet({ visible: true, onClose: vi.fn(), children: "Body" });
    const handlers = mocks.panResponderCreate.mock.calls[0]?.[0] as {
      onPanResponderRelease: (event: unknown, gesture: { dy: number; vy: number }) => void;
      onPanResponderTerminate: () => void;
    };

    handlers.onPanResponderRelease({}, { dy: 80, vy: 0 });
    handlers.onPanResponderRelease({}, { dy: 10, vy: 1.3 });
    handlers.onPanResponderTerminate();

    expect(mocks.spring).toHaveBeenCalledTimes(2);
    expect(mocks.spring).toHaveBeenCalledWith(expect.anything(), { toValue: 0, useNativeDriver: true });
    expect(mocks.timing).toHaveBeenCalledTimes(1);
  });

  it("supports a title-free sheet without actions and reports pressed close state", () => {
    const tree = BottomSheet({ visible: false, onClose: vi.fn(), children: "Body" });
    const texts = findElements(tree, (element) => element.type === "AppText");
    const closeButton = findElements(tree, (element) => element.type === "Pressable" && element.props.accessibilityLabel === "Close")[1];
    const style = closeButton!.props.style as (state: { pressed: boolean }) => unknown[];

    expect(findElements(tree, (element) => element.type === "Modal")[0]!.props.visible).toBe(false);
    expect(texts).toHaveLength(0);
    expect(findElements(tree, (element) => element.type === "Button")).toHaveLength(0);
    expect(style({ pressed: true })).toHaveLength(2);
    expect(style({ pressed: false })).toHaveLength(2);
  });
});
