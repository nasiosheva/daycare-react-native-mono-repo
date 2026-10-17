// Mories Deo Hutapea,S.E.,S.Kom

import { render } from "@testing-library/react-native";
import { OfflineStatusBanner } from "./OfflineStatusBanner";

let mockOfflineValue: { status: "ONLINE" | "OFFLINE" | "API_UNAVAILABLE" | "SYNCING" | "CONFLICT" | "STALE"; pendingCount: number; lastSyncAt: string | null };
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("./OfflineProvider", () => ({ useOffline: () => mockOfflineValue }));
jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string, params?: Record<string, unknown>) => params ? `${key}:${JSON.stringify(params)}` : key }) }));

describe("OfflineStatusBanner", () => {
  it("renders nothing when online with nothing pending", () => {
    mockOfflineValue = { status: "ONLINE", pendingCount: 0, lastSyncAt: null };

    const { toJSON } = render(<OfflineStatusBanner />);

    expect(toJSON()).toBeNull();
  });

  it("shows the offline message with the pending count while offline", () => {
    mockOfflineValue = { status: "OFFLINE", pendingCount: 3, lastSyncAt: null };

    const { getByText } = render(<OfflineStatusBanner />);

    expect(getByText(/offline\.offlineDescription/)).toBeTruthy();
  });

  it("distinguishes an unreachable API from a disconnected device", () => {
    mockOfflineValue = { status: "API_UNAVAILABLE", pendingCount: 1, lastSyncAt: null };

    const { getByText } = render(<OfflineStatusBanner />);

    expect(getByText("offline.apiUnavailableTitle")).toBeTruthy();
    expect(getByText(/offline\.apiUnavailableDescription/)).toBeTruthy();
  });

  it("shows the last-sync time appended to the message once a sync has completed", () => {
    mockOfflineValue = { status: "ONLINE", pendingCount: 1, lastSyncAt: "2026-10-11T00:00:00.000Z" };

    const { getByText } = render(<OfflineStatusBanner />);

    expect(getByText(/offline\.lastSync/)).toBeTruthy();
  });

  it("renders the conflict message when a sync conflict is pending", () => {
    mockOfflineValue = { status: "CONFLICT", pendingCount: 1, lastSyncAt: null };

    const { getByText } = render(<OfflineStatusBanner />);

    expect(getByText("offline.conflict")).toBeTruthy();
    expect(getByText("offline.conflictTitle")).toBeTruthy();
  });
});
