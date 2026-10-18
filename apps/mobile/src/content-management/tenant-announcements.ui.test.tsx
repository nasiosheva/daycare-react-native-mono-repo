// Mories Deo Hutapea,S.E.,S.Kom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import TenantAnnouncementsScreen from "../../app/tenant-announcements";

const mockAnnouncementRows = [
  { id: "announcement-tenant", audience: "TENANT", branchId: null, title: "Alpha", body: "Info Alpha", imageUrl: null, actionType: "NONE", actionTarget: null, requiresAcknowledgement: false, acknowledgedByMe: false, recipientCount: 2, status: "PUBLISHED", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z", publishedAt: "2026-10-18T09:00:00Z", scheduledAt: null },
  { id: "announcement-branch", audience: "BRANCH", branchId: "branch-1", title: "Beta", body: "Info Beta", imageUrl: null, actionType: "NONE", actionTarget: null, requiresAcknowledgement: false, acknowledgedByMe: false, recipientCount: 1, status: "DRAFT", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z", publishedAt: null, scheduledAt: null },
];
const mockPush = jest.fn();
const mockBranches = [{ id: "branch-1", name: "Cabang Utara", active: false }];

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), push: mockPush, setParams: jest.fn() }), useLocalSearchParams: () => ({}) }));
jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: readonly string[] }) => queryKey[0] === "tenant-branches"
    ? { data: mockBranches, isLoading: false, isError: false, isFetching: false, refetch: jest.fn() }
    : { data: mockAnnouncementRows, isLoading: false, isError: false, isFetching: false, refetch: jest.fn() },
  useMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/auth/AuthProvider", () => ({ useAuth: () => ({
  api: { managedAnnouncements: jest.fn(), announcements: jest.fn(), branches: jest.fn() },
  organizationId: "tenant-1",
  profile: { memberships: [{ organizationId: "tenant-1", role: "STAFF_ADMIN", active: true }] },
}) }));
jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key, formatDateTime: (value: string) => value }) }));
jest.mock("@/navigation/AppScreen", () => ({ AppScreen: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/navigation/SafeRedirect", () => ({ SafeRedirect: () => null }));
jest.mock("@/notify/notify", () => ({ notify: jest.fn() }));
jest.mock("@/media/FallbackImage", () => ({ FallbackImage: () => null }));
jest.mock("@/date-picker/DatePicker", () => ({ DatePicker: () => null }));
jest.mock("@daycare/ui", () => {
  const actual = jest.requireActual("@daycare/ui");
  return {
    ...actual,
    BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? <>{children}</> : null,
  };
});

describe("TenantAnnouncementsScreen", () => {
  it("searches the list, filters by audience, and labels branch announcements", () => {
    render(<TenantAnnouncementsScreen />);

    fireEvent.changeText(screen.getByLabelText("operations.searchAnnouncements"), "Alpha");
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.queryByText("Beta")).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "common.clearSearch" }));
    fireEvent.press(screen.getByRole("radio", { name: "operations.branch" }));

    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.getByText("operations.branch · Cabang Utara · 1")).toBeTruthy();
  });
});
