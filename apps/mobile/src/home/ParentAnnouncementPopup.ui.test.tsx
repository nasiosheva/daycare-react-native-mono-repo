// Mories Deo Hutapea,S.E.,S.Kom
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { Dimensions, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@daycare/ui";
import { ParentAnnouncementPopup } from "./ParentAnnouncementPopup";

const mockPush = jest.fn();
const mockDownloadAnnouncementImage = jest.fn();
const mockShareAnnouncementImage = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
jest.mock("@/announcements/downloadAnnouncementImage", () => ({
  downloadAnnouncementImage: (...args: unknown[]) => mockDownloadAnnouncementImage(...args),
  shareAnnouncementImage: (...args: unknown[]) => mockShareAnnouncementImage(...args),
}));

describe("ParentAnnouncementPopup", () => {
  afterEach(() => jest.useRealTimers());

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

  it("uses a borderless image-first layout with the close action over the image", () => {
    render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-image-layout", title: "Kegiatan", body: "", imageUrl: "https://cdn.example/notice.jpg", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);

    const imageFrame = screen.getByTestId("announcement-image-frame");
    const slideWidth = StyleSheet.flatten(imageFrame.props.style).width;
    const closeButton = within(imageFrame).getByRole("button", { name: "operations.dismissAllAnnouncements" });
    expect(slideWidth).toBe(Math.min(Dimensions.get("window").width - spacing.md * 2, 560));
    expect(closeButton.props.style).toMatchObject({ position: "absolute", top: expect.any(Number), right: expect.any(Number), backgroundColor: "transparent" });
    expect(closeButton.props.style.elevation).toBeUndefined();
    expect(closeButton.props.style.backgroundColor).toBe("transparent");
    expect(closeButton.findByType(Ionicons).props.color).toBe(colors.text);
    expect(within(imageFrame).getByLabelText("Nasio Care: Kegiatan").props.resizeMode).toBe("cover");
    expect(screen.queryByText("operations.announcements")).toBeNull();
  });

  it("offers an image download action below the announcement image", () => {
    render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-download", title: "Kegiatan", body: "", imageUrl: "https://cdn.example/kegiatan.png", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);

    expect(screen.getByRole("button", { name: "operations.downloadImage" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "operations.shareImage" })).toBeTruthy();
    const actions = within(screen.getByTestId("announcement-image-actions"));
    expect(actions.getByRole("button", { name: "operations.downloadImage" })).toBeTruthy();
    expect(actions.getByRole("button", { name: "operations.shareImage" })).toBeTruthy();
  });

  it("shares the currently selected slide image", async () => {
    mockShareAnnouncementImage.mockReset().mockResolvedValue(undefined);
    render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-share", title: "Kegiatan", body: "", imageUrl: "https://cdn.example/kegiatan.png", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "operations.shareImage" }));
      await Promise.resolve();
    });

    expect(mockShareAnnouncementImage).toHaveBeenCalledWith("https://cdn.example/kegiatan.png", "Kegiatan", "notice-share");
  });

  it("downloads the currently selected slide image", async () => {
    mockDownloadAnnouncementImage.mockReset().mockResolvedValue(undefined);
    render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-download", title: "Kegiatan", body: "", imageUrl: "https://cdn.example/kegiatan.png", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "operations.downloadImage" }));
      await Promise.resolve();
    });

    expect(mockDownloadAnnouncementImage).toHaveBeenCalledWith("https://cdn.example/kegiatan.png", "Kegiatan", "notice-download");
  });

  it("shows the announcement again after a fresh app mount", () => {
    const announcements = [
      { announcement: { id: "notice-launch", title: "Info terbaru", body: "", imageUrl: "https://cdn.example/notice.jpg", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ];
    const firstLaunch = render(<ParentAnnouncementPopup announcements={announcements} onAcknowledge={jest.fn()} />);

    fireEvent.press(screen.getByRole("button", { name: "operations.dismissAllAnnouncements" }));
    expect(screen.queryByLabelText("Nasio Care: Info terbaru")).toBeNull();

    firstLaunch.unmount();
    render(<ParentAnnouncementPopup announcements={announcements} onAcknowledge={jest.fn()} />);

    expect(screen.getByLabelText("Nasio Care: Info terbaru")).toBeTruthy();
  });

  it("pauses automatic changes while the announcement carousel is dragged", () => {
    jest.useFakeTimers();
    render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-1", title: "Satu", body: "", imageUrl: "https://cdn.example/one.jpg", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
      { announcement: { id: "notice-2", title: "Dua", body: "", imageUrl: "https://cdn.example/two.jpg", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);
    const carousel = screen.UNSAFE_getByType(ScrollView);

    act(() => jest.advanceTimersByTime(4_000));
    act(() => carousel.props.onScrollBeginDrag());
    act(() => jest.advanceTimersByTime(2_000));
    expect(screen.getByLabelText("● 1/2")).toBeTruthy();

    act(() => carousel.props.onScrollEndDrag({ nativeEvent: { contentOffset: { x: 0 } } }));
    act(() => jest.advanceTimersByTime(4_999));
    expect(screen.getByLabelText("● 1/2")).toBeTruthy();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByLabelText("● 2/2")).toBeTruthy();
    jest.useRealTimers();
  });

  it("navigates only when an allowlisted app-page CTA is configured", () => {
    mockPush.mockClear();
    render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-2", title: "Booking", body: "Lihat layanan.", imageUrl: "https://cdn.example/booking.jpg", actionType: "OPEN_APP_PAGE", actionTarget: "BOOKING", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);

    fireEvent.press(screen.getByRole("button", { name: "Booking" }));
    expect(mockPush).toHaveBeenCalledWith("/booking");
  });

  it("opens a configured HTTPS browser CTA in the in-app browser", async () => {
    mockPush.mockClear();
    render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-3", title: "Info", body: "Baca selengkapnya.", imageUrl: "https://cdn.example/info.jpg", actionType: "OPEN_BROWSER", actionTarget: "https://example.com/info", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Info" }));
      await Promise.resolve();
    });
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/in-app-browser", params: { url: "https://example.com/info" } });
  });

  it("uses the action configured on the tapped slide, not the currently active slide", async () => {
    mockPush.mockClear();
    render(<ParentAnnouncementPopup announcements={[
      { announcement: { id: "notice-static", title: "Static", body: "", imageUrl: "https://cdn.example/static.jpg", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
      { announcement: { id: "notice-action", title: "Info", body: "", imageUrl: "https://cdn.example/info.jpg", actionType: "OPEN_BROWSER", actionTarget: "https://example.com/info", requiresAcknowledgement: false, acknowledgedByMe: false }, organizationId: "tenant-1", organizationName: "Nasio Care" },
    ]} onAcknowledge={jest.fn()} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Info" }));
      await Promise.resolve();
    });
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/in-app-browser", params: { url: "https://example.com/info" } });
  });
});
