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

  it("does not include a legacy text-only announcement in the image popup", () => {
    const { toJSON } = render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-legacy", title: "Teks lama", body: "Isi lama", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);

    expect(toJSON()).toBeNull();
  });

  it("shows only recipient announcement imagery and can be dismissed", () => {
    render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-1", title: "Libur", body: "Lembaga libur besok.", imageUrl: "https://cdn.example/notice.jpg", publishedAt: "2026-10-17T10:00:00Z", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);

    expect(screen.getByLabelText("Nasio Care: Libur")).toBeTruthy();
    expect(screen.queryByText("Lembaga libur besok.")).toBeNull();
    expect(screen.queryByRole("button", { name: "operations.openAction" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "operations.dismissAllAnnouncements" }));
    expect(screen.queryByText("Libur")).toBeNull();
  });

  it("navigates only when an allowlisted app-page CTA is configured", () => {
    mockPush.mockClear();
    render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-2", title: "Booking", body: "Lihat layanan.", imageUrl: "https://cdn.example/booking.jpg", actionType: "OPEN_APP_PAGE", actionTarget: "BOOKING", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);

    fireEvent.press(screen.getByRole("button", { name: "Booking" }));
    expect(mockPush).toHaveBeenCalledWith("/booking");
  });

  it("opens a configured HTTPS browser CTA", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-3", title: "Info", body: "Baca selengkapnya.", imageUrl: "https://cdn.example/info.jpg", actionType: "OPEN_BROWSER", actionTarget: "https://example.com/info", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Info" }));
      await Promise.resolve();
    });
    expect(openURL).toHaveBeenCalledWith("https://example.com/info");
    openURL.mockRestore();
  });

  it("uses the action configured on the tapped slide, not the currently active slide", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-static", title: "Static", body: "", imageUrl: "https://cdn.example/static.jpg", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
      { announcement: { id: "notice-action", title: "Info", body: "", imageUrl: "https://cdn.example/info.jpg", actionType: "OPEN_BROWSER", actionTarget: "https://example.com/info", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Info" }));
      await Promise.resolve();
    });
    expect(openURL).toHaveBeenCalledWith("https://example.com/info");
    openURL.mockRestore();
  });
});
