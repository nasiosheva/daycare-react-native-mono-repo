import React from "react";
import { Dimensions, StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";
import PlatformBannersScreen from "../../app/platform-banners";

// Mories Deo Hutapea,S.E.,S.Kom

const mockBanner = {
  id: "banner-1",
  title: "Informasi penting untuk semua orang tua",
  body: "",
  imageUrl: "https://example.com/banner.jpg",
  actionType: "NONE",
  actionTarget: null,
  audience: "PARENT_GLOBAL",
  targetOrganizationId: null,
  status: "DRAFT",
  publishedAt: null,
  expiresAt: null,
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:00Z",
};

jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), setParams: jest.fn() }), useLocalSearchParams: () => ({}) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useQuery: () => ({ data: [mockBanner], isLoading: false, isError: false, isFetching: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/auth/AuthProvider", () => ({ useAuth: () => ({ api: {}, profile: { isPlatformAdmin: true } }) }));
jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key, formatDateTime: (value: string) => value }) }));
jest.mock("@/navigation/AppScreen", () => ({ AppScreen: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/navigation/SafeRedirect", () => ({ SafeRedirect: () => null }));
jest.mock("@/notify/notify", () => ({ notify: jest.fn() }));
jest.mock("@/date-picker/DatePicker", () => ({ DatePicker: () => null }));
jest.mock("@/media/FallbackImage", () => ({ FallbackImage: () => null }));
jest.mock("@/home/ParentPromotionSlider", () => ({ ParentPromotionSlider: () => null }));
jest.mock("@daycare/ui", () => {
  const ReactNative = jest.requireActual("react-native");
  const Text = ({ children }: { children: React.ReactNode }) => <ReactNative.Text>{children}</ReactNative.Text>;
  const Action = ({ children, style }: { children?: React.ReactNode; style?: unknown }) => <ReactNative.Pressable style={style}>{children && <Text>{children}</Text>}</ReactNative.Pressable>;
  return {
    AppText: Text,
    BackButton: () => null,
    Badge: ({ label }: { label: string }) => <Text>{label}</Text>,
    BottomSheet: () => null,
    Button: Action,
    Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Chip: Action,
    ChipGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    EmptyState: () => null,
    ErrorState: () => null,
    FloatingActionButton: Action,
    SearchField: () => null,
    ShimmerList: () => null,
    TextField: () => null,
    ToggleSwitch: () => null,
    colors: { danger: "red", dangerSoft: "pink", infoSoft: "#eef", border: "#ddd", surface: "white", text: "black", overlay: "#0008", surfaceTint: "#eee" },
    radius: { md: 12, lg: 16, pill: 999 },
    spacing: { xs: 4, sm: 8, md: 16 },
  };
});

describe("PlatformBannersScreen actions layout", () => {
  beforeEach(() => {
    Dimensions.set({ window: { width: 360, height: 800, scale: 2, fontScale: 1 }, screen: { width: 360, height: 800, scale: 2, fontScale: 1 } });
  });

  it("stacks draft actions on narrow phone screens so translated labels have room", () => {
    const screen = render(<PlatformBannersScreen />);
    const actionGroup = screen.getByTestId("platform-banner-actions");

    expect(StyleSheet.flatten(actionGroup?.props.style)).toMatchObject({ flexDirection: "column", flexWrap: "nowrap" });
  });

  it("preserves the existing wrapping action layout on wider screens", () => {
    Dimensions.set({ window: { width: 900, height: 800, scale: 1, fontScale: 1 }, screen: { width: 900, height: 800, scale: 1, fontScale: 1 } });
    const screen = render(<PlatformBannersScreen />);
    const actionGroup = screen.getByTestId("platform-banner-actions");

    expect(StyleSheet.flatten(actionGroup?.props.style)).toMatchObject({ flexDirection: "row", flexWrap: "wrap" });
  });
});
