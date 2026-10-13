// Mories Deo Hutapea,S.E.,S.Kom
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  View: "View",
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

import { AppText } from "./AppText";
import { Badge } from "./Badge";
import { Banner } from "./Banner";
import { Card, InfoRow } from "./Card";
import { Avatar } from "./Avatar";
import { BackButton } from "./BackButton";
import { FloatingActionButton } from "./FloatingActionButton";
import { MenuItem, MenuSection } from "./MenuItem";
import { SectionHeader } from "./SectionHeader";

type Element = ReactElement<Record<string, unknown>>;

function elements(node: ReactNode, predicate: (element: Element) => boolean): Element[] {
  if (Array.isArray(node)) return node.flatMap((child) => elements(child, predicate));
  if (!isValidElement(node)) return [];
  const element = node as Element;
  return [...(predicate(element) ? [element] : []), ...elements(element.props.children as ReactNode, predicate)];
}

describe("shared content components", () => {
  it("applies AppText variants and semantic tone styles", () => {
    const muted = AppText({ children: "Helper", variant: "title", tone: "muted", accessibilityLabel: "Hint" });
    const danger = AppText({ children: "Invalid", variant: "heading", tone: "danger" });

    expect(muted.type).toBe("Text");
    expect(muted.props).toMatchObject({ accessibilityLabel: "Hint", children: "Helper" });
    expect(muted.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: expect.any(String) })]));
    expect(danger.props.children).toBe("Invalid");
    expect(danger.props.style).toHaveLength(4);
  });

  it("renders labeled badges with optional tone icons", () => {
    const plain = Badge({ label: "Active", tone: "success" });
    const icon = Badge({ label: "Needs attention", tone: "warning", icon: "alert-circle" });

    expect(plain.type).toBe("View");
    expect(elements(plain, (element) => element.type === "Ionicons")).toHaveLength(0);
    expect(elements(plain, (element) => element.props.children === "Active")).toHaveLength(1);
    expect(elements(icon, (element) => element.type === "Ionicons")[0]?.props).toMatchObject({ name: "alert-circle", size: 12 });
  });

  it("renders string and custom banner messages and marks danger notices as alerts", () => {
    const action = createElement("Action", { label: "Retry" });
    const stringBanner = Banner({ title: "Saved", message: "Changes are ready", tone: "success" });
    const dangerBanner = Banner({ title: "Unavailable", message: action, tone: "danger", action });

    expect(stringBanner.props.accessibilityRole).toBeUndefined();
    expect(elements(stringBanner, (element) => element.props.children === "Changes are ready")).toHaveLength(1);
    expect(dangerBanner.props.accessibilityRole).toBe("alert");
    expect(elements(dangerBanner, (element) => element.type === "Action")).toHaveLength(2);
    expect(elements(dangerBanner, (element) => element.type === "Ionicons")[0]?.props.name).toBe("alert-circle");
  });

  it("keeps card header and info-row values consistent for text and custom content", () => {
    const trailing = createElement("Badge", { label: "Ready" });
    const card = Card({ title: "Child", subtitle: "Profile", icon: "person", trailing, children: "Details", variant: "selected" });
    const textRow = InfoRow({ label: "Branch", value: "Main", icon: "location" });
    const customRow = InfoRow({ label: "Status", value: createElement("Badge", { label: "Active" }) });
    const section = SectionHeader({ title: "Overview", description: "Current status", action: trailing });
    const simpleCard = Card({ children: "Body only" });

    expect(elements(card, (element) => element.props.accessibilityRole === "header").map((element) => element.props.children)).toContain("Child");
    expect(elements(card, (element) => element.type === "Badge")).toHaveLength(1);
    expect(elements(textRow, (element) => element.props.children === "Main")).toHaveLength(1);
    expect(elements(customRow, (element) => element.type === "Badge")).toHaveLength(1);
    expect(elements(section, (element) => element.props.accessibilityRole === "header")).toHaveLength(1);
    expect(elements(section, (element) => element.type === "Badge")).toHaveLength(1);
    expect(simpleCard.props.children).toContain("Body only");
  });

  it("renders accessible navigation, menu, avatar, and floating action controls", () => {
    const onPress = vi.fn();
    const menu = MenuItem({ title: "Operating hours", description: "Set branch hours", icon: "time", onPress, attention: true, badge: createElement("Badge", { label: "Review" }) });
    const section = MenuSection({ title: "Branch settings", children: menu });
    const avatar = Avatar({ name: "  Nasia ", size: "lg" });
    const emptyAvatar = Avatar({ name: "  " });
    const back = BackButton({ onPress, accessibilityLabel: "Back to home" });
    const fab = FloatingActionButton({ children: "Add child", onPress, accessibilityLabel: "Add a child", icon: "add" });
    const iconFab = FloatingActionButton({ children: "Hidden label", onPress, accessibilityLabel: "Jump to latest", icon: "arrow-down", iconOnly: true, variant: "surface" });
    const textFab = FloatingActionButton({ children: "Continue", onPress, accessibilityLabel: "Continue" });
    const simpleMenu = MenuItem({ title: "Profile", icon: "person", onPress });

    expect(elements(section, (element) => element.props.children === "BRANCH SETTINGS")).toHaveLength(1);
    expect(menu.props.accessibilityLabel).toBe("Operating hours. Set branch hours");
    expect(elements(menu.props.leading as ReactNode, (element) => element.type === "Ionicons")[0]?.props.color).toBeDefined();
    expect(elements(avatar, (element) => element.props.children === "N")).toHaveLength(1);
    expect(elements(emptyAvatar, (element) => element.props.children === "?")).toHaveLength(1);
    expect(elements(back, (element) => element.type === "Ionicons")[0]?.props.name).toBe("chevron-back");
    expect(elements(fab, (element) => element.type === AppText)).toHaveLength(1);
    expect(elements(iconFab, (element) => element.type === AppText)).toHaveLength(0);
    expect(elements(iconFab, (element) => element.type === "Ionicons")[0]?.props.color).toBeDefined();
    expect(elements(textFab, (element) => element.type === "Ionicons")).toHaveLength(0);
    expect(simpleMenu.props.accessibilityLabel).toBe("Profile");
  });
});
