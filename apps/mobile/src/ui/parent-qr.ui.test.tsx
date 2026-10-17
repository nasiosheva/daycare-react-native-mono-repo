import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import ParentQrScreen from "../../app/parent-qr";

// Mories Deo Hutapea,S.E.,S.Kom

const mockPush = jest.fn();

jest.mock("react-native-qrcode-svg", () => "QRCode");
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({}), useRouter: () => ({ push: mockPush }) }));
jest.mock("@/navigation/AppScreen", () => ({ AppScreen: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/navigation/LegacyDaycareRouteGuard", () => ({ LegacyDaycareRouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/navigation/legacyDaycareRouteAccess", () => ({ legacyDaycareRoutePolicies: { parentQr: {} } }));
jest.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ profile: { memberships: [{ organizationId: "org-1", organizationName: "Tenant Contoh", role: "PARENT", active: true, subscriptionStatus: "ACTIVE" }] } }),
}));
jest.mock("@/attendance/useAttendance", () => ({
  useAttendanceQr: () => ({ isLoading: false, isError: false, data: undefined, refetch: jest.fn() }),
  useParentChildrenAcrossTenants: () => ({
    data: [{ id: "child-1", fullName: "Anak Contoh", organizationId: "org-1", organizationName: "Tenant Contoh", tenantSubscriptionRestricted: false }],
    isFetching: false,
    failedTenants: [],
    allFailed: false,
    retryFailed: jest.fn(),
  }),
}));
jest.mock("@/booking/useBooking", () => ({
  useParentEntitlementsAcrossTenants: () => ({ data: [], isFetching: false, failedTenants: [], allFailed: false, retryFailed: jest.fn() }),
}));
jest.mock("@/education/useUiAccessContext", () => ({ useOfferingCapabilitiesByTenant: () => ({ isLoading: false, hasCapability: () => true }) }));
jest.mock("@/auth/tenantSubscription", () => ({ hasOperationalTenantSubscription: () => true }));
jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key, formatTime: () => "09.00" }) }));
jest.mock("@daycare/ui", () => {
  const ReactNative = jest.requireActual("react-native");
  const Text = ({ children }: { children: React.ReactNode }) => <ReactNative.Text>{children}</ReactNative.Text>;
  return {
    AppText: Text,
    BottomSheet: () => null,
    EmptyState: ({ title, description, action }: { title: string; description?: string; action?: { label: string; onPress: () => void } }) => (
      <ReactNative.View>
        <Text>{title}</Text>
        {description && <Text>{description}</Text>}
        {action && <ReactNative.Pressable accessibilityRole="button" onPress={action.onPress}><Text>{action.label}</Text></ReactNative.Pressable>}
      </ReactNative.View>
    ),
    ErrorState: () => null,
    MenuItem: () => null,
    Shimmer: () => null,
    ShimmerList: () => null,
    colors: { border: "#ddd", codeSurface: "#fff", surface: "#fff" },
    radius: { lg: 16, md: 12 },
    spacing: { lg: 24, md: 16, sm: 8 },
  };
});

describe("Parent attendance QR eligibility messaging", () => {
  beforeEach(() => mockPush.mockClear());

  it("explains that an active service entitlement is required and links to booking", () => {
    const rendered = render(<ParentQrScreen />);

    expect(rendered.getByText("qr.entitlementRequired")).toBeTruthy();
    fireEvent.press(rendered.getByText("qr.openBooking"));

    expect(mockPush).toHaveBeenCalledWith("/booking");
  });
});
