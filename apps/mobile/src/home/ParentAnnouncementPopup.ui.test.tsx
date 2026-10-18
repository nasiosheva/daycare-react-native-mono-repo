// Mories Deo Hutapea,S.E.,S.Kom
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import { ParentAnnouncementPopup } from "./ParentAnnouncementPopup";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

describe("ParentAnnouncementPopup", () => {
  it("does not show a popup when there are no recipient announcements", () => {
    const { toJSON } = render(<ParentAnnouncementPopup announcements={[]} onAcknowledge={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it("shows recipient announcement imagery and can be dismissed", () => {
    render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-1", title: "Libur", body: "Lembaga libur besok.", imageUrl: "https://cdn.example/notice.jpg", publishedAt: "2026-10-17T10:00:00Z", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);

    expect(screen.getByText("Libur")).toBeTruthy();
    expect(screen.getByLabelText("Libur")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "operations.openAction" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "operations.dismissAllAnnouncements" }));
    expect(screen.queryByText("Libur")).toBeNull();
  });

  it("navigates only when an allowlisted app-page CTA is configured", () => {
    mockPush.mockClear();
    render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-2", title: "Booking", body: "Lihat layanan.", actionType: "OPEN_APP_PAGE", actionTarget: "BOOKING", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);

    fireEvent.press(screen.getByRole("button", { name: "operations.openAction" }));
    expect(mockPush).toHaveBeenCalledWith("/booking");
  });

  it("opens a configured HTTPS browser CTA", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-3", title: "Info", body: "Baca selengkapnya.", actionType: "OPEN_BROWSER", actionTarget: "https://example.com/info", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "operations.openAction" }));
      await Promise.resolve();
    });
    expect(openURL).toHaveBeenCalledWith("https://example.com/info");
    openURL.mockRestore();
  });
});
