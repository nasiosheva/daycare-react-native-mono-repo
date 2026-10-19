import { render } from "@testing-library/react-native";
import React from "react";
import { Dimensions, StyleSheet } from "react-native";
import BillingAdminScreen from "../../app/billing-admin";

// Mories Deo Hutapea,S.E.,S.Kom

jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock("@/navigation/SafeRedirect", () => ({ SafeRedirect: () => null }));
jest.mock("@/navigation/AppScreen", () => ({ AppScreen: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/navigation/LegacyDaycareRouteGuard", () => ({ LegacyDaycareRouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/navigation/legacyDaycareRouteAccess", () => ({ legacyDaycareRoutePolicies: { staffAdminDaycareOperations: {} } }));
jest.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useQuery: () => ({ data: [], isFetching: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/booking/useBooking", () => ({
  useInvoices: () => ({ data: [], isFetching: false }),
  useMarkInvoicePaid: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useServicePlans: () => ({ data: [], isFetching: false }),
}));
jest.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    api: {
      deleteServicePlanTemplate: jest.fn(),
      deactivateServicePlanDiscount: jest.fn(),
      createServicePlanDiscount: jest.fn(),
      createServicePlan: jest.fn(),
      createServicePlanTemplate: jest.fn(),
      updateServicePlanTemplate: jest.fn(),
      setBranchCapacity: jest.fn(),
      branches: jest.fn(),
      branchCapacities: jest.fn(),
      serviceExpiryReminderSettings: jest.fn(),
      servicePlanTemplates: jest.fn(),
      updateServiceExpiryReminderSettings: jest.fn(),
      servicePlanDiscounts: jest.fn(),
    },
    organizationId: "tenant-1",
    profile: { memberships: [{ organizationId: "tenant-1", role: "STAFF_ADMIN", active: true }] },
  }),
}));
jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key, formatCurrency: () => "Rp 10.000", formatDate: () => "20 Okt 2026" }) }));
jest.mock("@/i18n/translations", () => ({ servicePlanTypeKey: (value: string) => value }));
jest.mock("@/notify/notify", () => ({ notify: jest.fn() }));
jest.mock("@/date-picker/DatePicker", () => ({ DatePicker: () => null }));
jest.mock("@daycare/ui", () => {
  const ReactNative = jest.requireActual("react-native");
  const Text = ({ children }: { children: React.ReactNode }) => <ReactNative.Text>{children}</ReactNative.Text>;
  const Action = ({ children, onPress, disabled }: { children?: React.ReactNode; onPress?: () => void; disabled?: boolean }) => (
    <ReactNative.Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}><Text>{children}</Text></ReactNative.Pressable>
  );
  return {
    AppText: Text,
    BackButton: () => null,
    Banner: ({ title }: { title: string }) => <Text>{title}</Text>,
    BottomSheet: () => null,
    Button: Action,
    Chip: Action,
    EmptyState: ({ title }: { title: string }) => <Text>{title}</Text>,
    NavigationCard: ({ children, style }: { children: React.ReactNode; style?: unknown }) => <ReactNative.View style={style}>{children}</ReactNative.View>,
    ShimmerList: () => <Text>loading</Text>,
    TabBar: () => null,
    TextField: () => null,
    colors: { danger: "red", dangerSoft: "pink", onPrimary: "white", primary: "gold", surface: "white", surfaceTint: "cream", border: "#ddd" },
    radius: { lg: 16, md: 12, sm: 8 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  };
});

describe("Billing admin summary cards", () => {
  it("uses a single-column layout on narrow phone screens", () => {
    Dimensions.set({ window: { width: 360, height: 800, scale: 2, fontScale: 1 }, screen: { width: 360, height: 800, scale: 2, fontScale: 1 } });
    const screen = render(<BillingAdminScreen />);
    const grid = screen.getByTestId("billing-admin-summary-grid");

    expect(StyleSheet.flatten(grid.props.style)).toMatchObject({ flexDirection: "column", flexWrap: "nowrap" });
    const cards = React.Children.toArray(grid.props.children);
    expect(cards).toHaveLength(6);
    for (const card of cards) {
      expect(StyleSheet.flatten((card as React.ReactElement<{ style?: unknown }>).props.style)).toMatchObject({ width: "100%" });
    }
  });

  it("keeps two columns on wider screens", () => {
    Dimensions.set({ window: { width: 900, height: 800, scale: 1, fontScale: 1 }, screen: { width: 900, height: 800, scale: 1, fontScale: 1 } });
    const screen = render(<BillingAdminScreen />);
    const grid = screen.getByTestId("billing-admin-summary-grid");

    expect(StyleSheet.flatten(grid?.props.style)).toMatchObject({ flexDirection: "row", flexWrap: "wrap" });
  });
});
