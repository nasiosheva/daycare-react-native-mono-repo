// Mories Deo Hutapea,S.E.,S.Kom
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Linking, ScrollView } from "react-native";
import { ParentPromotionSlider } from "./ParentPromotionSlider";

const mockPush = jest.fn();
jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

describe("ParentPromotionSlider", () => {
  afterEach(() => jest.useRealTimers());

  it("stays hidden when there are no published promotions", () => {
    const { toJSON } = render(<ParentPromotionSlider banners={[]} />);
    expect(toJSON()).toBeNull();
  });

  it("renders promotion images without caption text", () => {
    render(<ParentPromotionSlider banners={[
      { id: "promotion-1", title: "Paket baru", body: "Lihat penawaran terbaru.", imageUrl: "https://cdn.example/promo.jpg", status: "PUBLISHED", publishedAt: "2026-10-18T10:00:00Z", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T10:00:00Z" },
    ]} />);

    expect(screen.getByLabelText("Paket baru")).toBeTruthy();
    expect(screen.getByLabelText("Paket baru").props.style).toMatchObject({ aspectRatio: 2.4 });
    expect(screen.getByLabelText("Paket baru").props.resizeMode).toBe("cover");
    expect(screen.queryByText("Paket baru")).toBeNull();
    expect(screen.queryByText("Lihat penawaran terbaru.")).toBeNull();
    expect(screen.queryByRole("button", { name: /Paket baru/ })).toBeNull();
  });

  it("automatically advances to the next image and moves the active dot", () => {
    jest.useFakeTimers();
    render(<ParentPromotionSlider banners={[
      { id: "promotion-1", title: "Satu", body: "", imageUrl: "https://cdn.example/one.jpg", status: "PUBLISHED", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
      { id: "promotion-2", title: "Dua", body: "", imageUrl: "https://cdn.example/two.jpg", status: "PUBLISHED", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
    ]} />);

    expect(screen.getByLabelText("● 1/2")).toBeTruthy();
    act(() => jest.advanceTimersByTime(5_000));
    expect(screen.getByLabelText("● 2/2")).toBeTruthy();
    jest.useRealTimers();
  });

  it("changes slides with a horizontal swipe without navigation buttons", () => {
    render(<ParentPromotionSlider banners={[
      { id: "one", title: "Satu", body: "", imageUrl: "https://cdn.example/one.jpg", status: "PUBLISHED", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
      { id: "two", title: "Dua", body: "", imageUrl: "https://cdn.example/two.jpg", status: "PUBLISHED", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
      { id: "three", title: "Tiga", body: "", imageUrl: "https://cdn.example/three.jpg", status: "PUBLISHED", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
    ]} />);

    const carousel = screen.UNSAFE_getByType(ScrollView);
    const onScrollEndDrag = carousel.props.onScrollEndDrag as (event: { nativeEvent: { contentOffset: { x: number } } }) => void;
    act(() => onScrollEndDrag({ nativeEvent: { contentOffset: { x: carousel.props.snapToInterval as number } } }));
    expect(screen.getByLabelText("● 2/3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "platformBanners.nextSlide" })).toBeNull();
    expect(screen.queryByRole("button", { name: "platformBanners.previousSlide" })).toBeNull();
  });

  it("pauses automatic changes during a swipe and resumes after release", () => {
    jest.useFakeTimers();
    render(<ParentPromotionSlider banners={[
      { id: "one", title: "Satu", body: "", imageUrl: "https://cdn.example/one.jpg", status: "PUBLISHED", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
      { id: "two", title: "Dua", body: "", imageUrl: "https://cdn.example/two.jpg", status: "PUBLISHED", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
    ]} />);
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

  it("keeps part of the next image visible beside the active slide", () => {
    render(<ParentPromotionSlider banners={[
      { id: "one", title: "Satu", body: "", imageUrl: "https://cdn.example/one.jpg", status: "PUBLISHED", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
      { id: "two", title: "Dua", body: "", imageUrl: "https://cdn.example/two.jpg", status: "PUBLISHED", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
    ]} />);
    let carousel = screen.UNSAFE_getByType(ScrollView);
    act(() => carousel.props.onLayout({ nativeEvent: { layout: { width: 500 } } }));
    carousel = screen.UNSAFE_getByType(ScrollView);
    const slides = carousel.props.children as Array<{ props: { style: Array<Record<string, unknown>> } }>;
    const firstSlideWidth = slides[0]?.props.style[1]?.width as number;

    expect(carousel.props.style).toMatchObject({ width: "100%" });
    expect(firstSlideWidth).toBe(440);
    expect(firstSlideWidth).toBeLessThan(500);
  });

  it("overlays the dot indicator on the image carousel", () => {
    render(<ParentPromotionSlider banners={[
      { id: "one", title: "Satu", body: "", imageUrl: "https://cdn.example/one.jpg", status: "PUBLISHED", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
      { id: "two", title: "Dua", body: "", imageUrl: "https://cdn.example/two.jpg", status: "PUBLISHED", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
    ]} />);

    expect(screen.getByLabelText("platformBanners.parentTitle 1/2").props.style).toMatchObject({ position: "absolute", bottom: expect.any(Number) });
  });

  it("opens a configured browser destination when the banner is tapped", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<ParentPromotionSlider banners={[
      { id: "promotion-2", title: "Paket baru", body: "Lihat detail.", imageUrl: "https://cdn.example/promo.jpg", actionType: "OPEN_BROWSER", actionTarget: "https://example.com/promo", status: "PUBLISHED", publishedAt: "2026-10-18T10:00:00Z", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T10:00:00Z" },
    ]} />);
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Paket baru" }));
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
    fireEvent.press(screen.getByRole("button", { name: "Booking" }));
    expect(mockPush).toHaveBeenCalledWith("/booking");
  });

  it("does not make a tenant-scoped destination clickable without an active tenant", () => {
    render(<ParentPromotionSlider banners={[
      { id: "promotion-4", title: "Pengumuman", body: "Baca pengumuman lembaga.", imageUrl: "https://cdn.example/promo.jpg", actionType: "OPEN_APP_PAGE", actionTarget: "TENANT_ANNOUNCEMENTS", status: "PUBLISHED", publishedAt: "2026-10-18T10:00:00Z", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T10:00:00Z" },
    ]} />);
    expect(screen.queryByRole("button", { name: "Pengumuman" })).toBeNull();
  });

  it("preserves the active tenant when opening tenant announcements", () => {
    mockPush.mockClear();
    render(<ParentPromotionSlider organizationId="tenant-123" banners={[
      { id: "promotion-5", title: "Pengumuman", body: "Baca pengumuman lembaga.", imageUrl: "https://cdn.example/promo.jpg", actionType: "OPEN_APP_PAGE", actionTarget: "TENANT_ANNOUNCEMENTS", status: "PUBLISHED", publishedAt: "2026-10-18T10:00:00Z", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T10:00:00Z" },
    ]} />);

    fireEvent.press(screen.getByRole("button", { name: "Pengumuman" }));

    expect(mockPush).toHaveBeenCalledWith({ pathname: "/tenant-announcements", params: { organizationId: "tenant-123" } });
  });

  it("keeps the Parent preview static even when the saved banner has an action", () => {
    render(<ParentPromotionSlider interactive={false} banners={[
      { id: "preview-1", title: "Promo", body: "Deskripsi promo.", imageUrl: "https://cdn.example/promo.jpg", actionType: "OPEN_BROWSER", actionTarget: "https://example.com", status: "DRAFT", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
    ]} />);

    expect(screen.queryByRole("button", { name: /Promo/ })).toBeNull();
    expect(screen.queryByText("Deskripsi promo.")).toBeNull();
  });
});
