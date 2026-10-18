// Mories Deo Hutapea,S.E.,S.Kom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { InAppBrowserScreen } from "./InAppBrowserScreen";

const mockBrowserSurface = jest.fn();
const mockRouterBack = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockRouterBack }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
jest.mock("@/navigation/AppScreen", () => ({ AppScreen: ({ header, renderBody, title }: { header: React.ReactNode; renderBody: (props: { style: object }) => React.ReactNode; title: string }) => <>{header}<>{title}</>{renderBody({ style: { flex: 1 } })}</> }));
jest.mock("@/browser/BrowserSurface", () => ({ BrowserSurface: (props: unknown) => { mockBrowserSurface(props); return <>{"browser-surface"}</>; } }));

describe("InAppBrowserScreen", () => {
  beforeEach(() => mockBrowserSurface.mockClear());

  it("loads a valid starting URL and exposes browser controls", () => {
    render(<InAppBrowserScreen initialUrl="https://example.com/start" />);

    expect(screen.getByLabelText("browser.address").props.value).toBe("https://example.com/start");
    expect(screen.getByLabelText("browser.reload")).toBeTruthy();
    expect(mockBrowserSurface).toHaveBeenCalledWith(expect.objectContaining({ url: "https://example.com/start" }));
  });

  it("loads a submitted host as HTTPS", () => {
    render(<InAppBrowserScreen />);
    fireEvent.changeText(screen.getByLabelText("browser.address"), "example.com/path");
    fireEvent.press(screen.getByRole("button", { name: "browser.go" }));

    expect(mockBrowserSurface).toHaveBeenCalledWith(expect.objectContaining({ url: "https://example.com/path" }));
  });

  it("rejects non-HTTPS destinations without loading them", () => {
    render(<InAppBrowserScreen />);
    fireEvent.changeText(screen.getByLabelText("browser.address"), "http://example.com");
    fireEvent.press(screen.getByRole("button", { name: "browser.go" }));

    expect(screen.getByText("browser.invalidUrl")).toBeTruthy();
    expect(mockBrowserSurface).not.toHaveBeenCalled();
  });
});
