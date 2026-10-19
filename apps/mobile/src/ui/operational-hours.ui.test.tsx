import { render } from "@testing-library/react-native";
import React from "react";
import { Dimensions, StyleSheet } from "react-native";
import OperationalHoursScreen from "../../app/operational-hours";

// Mories Deo Hutapea,S.E.,S.Kom

const mockState = {
  hours: [{
    childId: "child-1",
    childName: "Anak",
    timezone: "Asia/Jakarta",
    organizationName: "Tenant",
    branchName: "Cabang",
    hours: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map((dayOfWeek) => ({
      dayOfWeek,
      active: true,
      opensAt: "07:00",
      closesAt: "16:00",
    })),
    tiers: [],
  }],
};

jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ isFetching: false, data: mockState.hours }) }));
jest.mock("@/navigation/SafeRedirect", () => ({ SafeRedirect: () => null }));
jest.mock("@/navigation/AppScreen", () => ({ AppScreen: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    api: { parentOperatingHoursAllTenants: jest.fn() },
    profile: { memberships: [{ role: "PARENT" }] },
    user: { uid: "parent-1" },
  }),
}));
jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key, formatCurrency: () => "Rp 10.000" }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@daycare/ui", () => {
  const ReactNative = jest.requireActual("react-native");
  return {
    AppText: ({ children }: { children: React.ReactNode }) => <ReactNative.Text>{children}</ReactNative.Text>,
    EmptyState: () => null,
    ShimmerList: () => null,
    colors: { muted: "#777", primary: "#985", primaryPressed: "#754", accentSoft: "#eee", disabled: "#ddd", surface: "white", border: "#ccc", danger: "red", dangerSoft: "pink" },
    radius: { lg: 16, md: 12, sm: 8, pill: 999 },
    shadows: { sm: {} },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  };
});

describe("Parent operational-hours day grid", () => {
  beforeEach(() => {
    Dimensions.set({ window: { width: 360, height: 800, scale: 2, fontScale: 1 }, screen: { width: 360, height: 800, scale: 2, fontScale: 1 } });
  });

  function dayChips(screen: ReturnType<typeof render>) {
    return screen.getByTestId("parent-operating-hours-days-grid");
  }

  it("uses readable two-column day chips on narrow phone screens", () => {
    const screen = render(<OperationalHoursScreen />);
    const grid = dayChips(screen);
    const firstChip = grid?.props.children[0];

    expect(StyleSheet.flatten(firstChip?.props.style)).toMatchObject({ flexBasis: "47%" });
  });

  it("keeps the four-column day grid on wider screens", () => {
    Dimensions.set({ window: { width: 900, height: 800, scale: 1, fontScale: 1 }, screen: { width: 900, height: 800, scale: 1, fontScale: 1 } });
    const screen = render(<OperationalHoursScreen />);
    const grid = dayChips(screen);
    const firstChip = grid?.props.children[0];

    expect(StyleSheet.flatten(firstChip?.props.style)).toMatchObject({ flexBasis: "22%" });
  });
});
