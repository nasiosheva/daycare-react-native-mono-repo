// Mories Deo Hutapea,S.E.,S.Kom
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import { ParentPromotionSlider } from "./ParentPromotionSlider";

const mockPush = jest.fn();
jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

describe("ParentPromotionSlider", () => {
  it("stays hidden when there are no published promotions", () => {
    const { toJSON } = render(<ParentPromotionSlider banners={[]} />);
    expect(toJSON()).toBeNull();
  });

  it("renders the published promotion image as a swipeable slide", () => {
    render(<ParentPromotionSlider banners={[
      { id: "promotion-1", title: "Paket baru", body: "Lihat penawaran terbaru.", imageUrl: "https://cdn.example/promo.jpg", status: "PUBLISHED", publishedAt: "2026-10-18T10:00:00Z", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T10:00:00Z" },
    ]} />);

    expect(screen.getByText("Paket baru")).toBeTruthy();
    expect(screen.getByLabelText("Paket baru")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Paket baru/ })).toBeNull();
  });

  it("opens a configured browser destination when the banner is tapped", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<ParentPromotionSlider banners={[
      { id: "promotion-2", title: "Paket baru", body: "Lihat detail.", imageUrl: "https://cdn.example/promo.jpg", actionType: "OPEN_BROWSER", actionTarget: "https://example.com/promo", status: "PUBLISHED", publishedAt: "2026-10-18T10:00:00Z", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T10:00:00Z" },
    ]} />);
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Paket baru. operations.openAction" }));
      await Promise.resolve();
    });
    expect(openURL).toHaveBeenCalledWith("https://example.com/promo");
    openURL.mockRestore();
  });

  it("opens only allowlisted in-app destinations when configured", () => {
    mockPush.mockClear();
    render(<ParentPromotionSlider banners={[
      { id: "promotion-3", title: "Booking", body: "Lihat layanan.", imageUrl: "https://cdn.example/promo.jpg", actionType: "OPEN_APP_PAGE", actionTarget: "BOOKING", status: "PUBLISHED", publishedAt: "2026-10-18T10:00:00Z", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T10:00:00Z" },
    ]} />);
    fireEvent.press(screen.getByRole("button", { name: "Booking. operations.openAction" }));
    expect(mockPush).toHaveBeenCalledWith("/booking");
  });

  it("does not make a tenant-scoped destination clickable without an active tenant", () => {
    render(<ParentPromotionSlider banners={[
      { id: "promotion-4", title: "Pengumuman", body: "Baca pengumuman lembaga.", imageUrl: "https://cdn.example/promo.jpg", actionType: "OPEN_APP_PAGE", actionTarget: "TENANT_ANNOUNCEMENTS", status: "PUBLISHED", publishedAt: "2026-10-18T10:00:00Z", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T10:00:00Z" },
    ]} />);
    expect(screen.queryByRole("button", { name: /Pengumuman/ })).toBeNull();
  });

  it("preserves the active tenant when opening tenant announcements", () => {
    mockPush.mockClear();
    render(<ParentPromotionSlider organizationId="tenant-123" banners={[
      { id: "promotion-5", title: "Pengumuman", body: "Baca pengumuman lembaga.", imageUrl: "https://cdn.example/promo.jpg", actionType: "OPEN_APP_PAGE", actionTarget: "TENANT_ANNOUNCEMENTS", status: "PUBLISHED", publishedAt: "2026-10-18T10:00:00Z", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T10:00:00Z" },
    ]} />);

    fireEvent.press(screen.getByRole("button", { name: "Pengumuman. operations.openAction" }));

    expect(mockPush).toHaveBeenCalledWith({ pathname: "/tenant-announcements", params: { organizationId: "tenant-123" } });
  });

  it("keeps the Parent preview static even when the saved banner has an action", () => {
    render(<ParentPromotionSlider interactive={false} banners={[
      { id: "preview-1", title: "Promo", body: "Deskripsi promo.", imageUrl: "https://cdn.example/promo.jpg", actionType: "OPEN_BROWSER", actionTarget: "https://example.com", status: "DRAFT", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
    ]} />);

    expect(screen.getByText("Promo")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Promo/ })).toBeNull();
  });
});
