import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import BookingScreen from "../../app/booking";

// Mories Deo Hutapea,S.E.,S.Kom

const mockState = {
  routerPush: jest.fn(),
  failedCapabilityTenants: [] as { organizationId: string; organizationName: string }[],
  retryCapability: jest.fn(),
  plans: { isFetching: false, isError: false, data: [], refetch: jest.fn() },
  entitlements: { isFetching: false, isError: false, data: [], refetch: jest.fn() },
  invoices: { isFetching: false, isError: false, data: [], refetch: jest.fn() },
  bookings: { isFetching: false, isError: false, data: [], refetch: jest.fn() },
};

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockState.routerPush }) }));
jest.mock("@/navigation/AppScreen", () => ({ AppScreen: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/navigation/LegacyDaycareRouteGuard", () => ({ LegacyDaycareRouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/navigation/legacyDaycareRouteAccess", () => ({ legacyDaycareRoutePolicies: { parentBooking: {} } }));
jest.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ profile: { memberships: [
    { organizationId: "school-tenant", organizationName: "Sekolah", role: "PARENT", active: true, subscriptionStatus: "ACTIVE" },
    { organizationId: "daycare-tenant", organizationName: "Daycare", role: "PARENT", active: true, subscriptionStatus: "ACTIVE" },
  ] } }),
}));
jest.mock("@/attendance/useAttendance", () => ({
  useParentChildrenAcrossTenants: () => ({
    data: [
      { id: "school-child", fullName: "Anak Sekolah", organizationId: "school-tenant", organizationName: "Sekolah", tenantSubscriptionRestricted: false },
      { id: "daycare-child", fullName: "Anak Daycare", organizationId: "daycare-tenant", organizationName: "Daycare", tenantSubscriptionRestricted: false },
    ],
    isFetching: false,
    failedTenants: [],
    allFailed: false,
    retryFailed: jest.fn(),
  }),
}));
jest.mock("@/education/useUiAccessContext", () => ({
  useOfferingCapabilitiesByTenant: () => ({ isLoading: false, hasCapability: (organizationId: string) => organizationId === "daycare-tenant", failedTenants: mockState.failedCapabilityTenants, retryFailed: mockState.retryCapability }),
}));
jest.mock("@/booking/useBooking", () => ({
  useServicePlans: () => mockState.plans,
  useEntitlements: () => mockState.entitlements,
  useBookings: () => mockState.bookings,
  useInvoices: () => mockState.invoices,
  usePurchaseService: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useBookEntitlement: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key, formatCurrency: () => "Rp 10.000", formatDate: () => "20 Okt 2026" }) }));
jest.mock("@/date-picker/DatePicker", () => ({ DatePicker: () => null }));
jest.mock("@/notify/notify", () => ({ notify: jest.fn() }));
jest.mock("@/ui/statusTone", () => ({ statusTone: () => "info" }));
jest.mock("@daycare/ui", () => {
  const ReactNative = jest.requireActual("react-native");
  const Text = ({ children }: { children: React.ReactNode }) => <ReactNative.Text>{children}</ReactNative.Text>;
  const Action = ({ children, onPress, disabled }: { children?: React.ReactNode; onPress?: () => void; disabled?: boolean }) => (
    <ReactNative.Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}><Text>{children}</Text></ReactNative.Pressable>
  );
  return {
    AppText: Text,
    Badge: ({ label }: { label: string }) => <Text>{label}</Text>,
    Banner: ({ title, message, action }: { title: string; message?: string; action?: React.ReactNode }) => <><Text>{title}</Text>{message && <Text>{message}</Text>}{action}</>,
    BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? <>{children}</> : null,
    Button: Action,
    Card: ({ title, children }: { title: string; children?: React.ReactNode }) => <><Text>{title}</Text>{children}</>,
    Chip: ({ label, onPress }: { label: string; onPress: () => void }) => <Action onPress={onPress}>{label}</Action>,
    ChipGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    EmptyState: ({ title }: { title: string }) => <Text>{title}</Text>,
    ErrorState: ({ title, retryLabel, onRetry }: { title: string; retryLabel: string; onRetry: () => void }) => <><Text>{title}</Text><Action onPress={onRetry}>{retryLabel}</Action></>,
    MenuItem: () => null,
    NavigationCard: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => <Action onPress={onPress}>{children}</Action>,
    SectionHeader: ({ title }: { title: string }) => <Text>{title}</Text>,
    ShimmerList: () => <Text>loading</Text>,
    colors: { danger: "red", dangerSoft: "pink", onPrimary: "white", primary: "gold", surface: "white", surfaceTint: "cream", border: "#ddd" },
    radius: { lg: 16, md: 12, sm: 8 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  };
});

describe("Parent service booking flow", () => {
  beforeEach(() => {
    Dimensions.set({ window: { width: 360, height: 800, scale: 2, fontScale: 1 }, screen: { width: 360, height: 800, scale: 2, fontScale: 1 } });
    mockState.failedCapabilityTenants = [];
    mockState.retryCapability.mockClear();
    for (const query of [mockState.plans, mockState.entitlements, mockState.invoices, mockState.bookings]) {
      query.isFetching = false;
      query.isError = false;
      query.data = [];
      query.refetch.mockClear();
    }
  });

  it("only lists children whose tenant publishes daycare operations", () => {
    const screen = render(<BookingScreen />);

    expect(screen.getByText("Anak Daycare (Daycare)")).toBeTruthy();
    expect(screen.queryByText("Anak Sekolah (Sekolah)")).toBeNull();
  });

  it("uses a single-column summary-card layout on narrow phone screens", () => {
    const screen = render(<BookingScreen />);
    const summaryGrid = screen.UNSAFE_getAllByType(View).find((node) => StyleSheet.flatten(node.props.style)?.flexWrap !== undefined);

    expect(summaryGrid).toBeTruthy();
    expect(StyleSheet.flatten(summaryGrid?.props.style)).toMatchObject({ flexDirection: "column" });
  });

  it("keeps a two-column summary-card layout on wider screens", () => {
    Dimensions.set({ window: { width: 900, height: 800, scale: 1, fontScale: 1 }, screen: { width: 900, height: 800, scale: 1, fontScale: 1 } });
    const screen = render(<BookingScreen />);
    const summaryGrid = screen.UNSAFE_getAllByType(View).find((node) => StyleSheet.flatten(node.props.style)?.flexWrap !== undefined);

    expect(summaryGrid).toBeTruthy();
    expect(StyleSheet.flatten(summaryGrid?.props.style)).toMatchObject({ flexDirection: "row", flexWrap: "wrap" });
  });

  it("names and retries a tenant whose daycare capability could not be checked", () => {
    mockState.failedCapabilityTenants = [{ organizationId: "school-tenant", organizationName: "Sekolah" }];
    const screen = render(<BookingScreen />);

    expect(screen.getByText("common.loadFailedDescription · Sekolah")).toBeTruthy();
    fireEvent.press(screen.getByText("common.retry"));
    expect(mockState.retryCapability).toHaveBeenCalledTimes(1);
  });

  it("shows a retry state when the service-plan request fails", () => {
    mockState.plans.isError = true;
    const screen = render(<BookingScreen />);

    fireEvent.press(screen.getByText("booking.bookNow"));

    expect(screen.getByText("common.loadFailed")).toBeTruthy();
    fireEvent.press(screen.getByText("common.retry"));
    expect(mockState.plans.refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("common.noData")).toBeNull();
  });

  it("does not show an empty invoice state when invoices fail to load", () => {
    mockState.invoices.isError = true;
    const screen = render(<BookingScreen />);

    fireEvent.press(screen.getByText("booking.invoices"));

    expect(screen.getByText("common.loadFailed")).toBeTruthy();
    expect(screen.queryByText("booking.noInvoicesForChild")).toBeNull();
  });

  it("shows a retry state instead of an empty state when entitlements fail", () => {
    mockState.entitlements.isError = true;
    const screen = render(<BookingScreen />);

    fireEvent.press(screen.getByText("booking.remaining"));
    expect(screen.getAllByText("common.loadFailed")).toHaveLength(1);
    fireEvent.press(screen.getByText("common.retry"));
    expect(mockState.entitlements.refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("common.noData")).toBeNull();
  });

  it("shows a retry state instead of an empty history when bookings fail", () => {
    mockState.bookings.isError = true;
    const screen = render(<BookingScreen />);

    fireEvent.press(screen.getByText("booking.history"));
    expect(screen.getByText("common.loadFailed")).toBeTruthy();
    expect(screen.getAllByText("booking.noBookingsYet")).toHaveLength(1);
  });
});
