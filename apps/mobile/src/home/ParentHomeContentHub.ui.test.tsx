// Mories Deo Hutapea,S.E.,S.Kom
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ParentHomeContentHub } from "./ParentHomeContentHub";

jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

describe("ParentHomeContentHub", () => {
  it("shows distinct create actions only for authorized content types", () => {
    render(<ParentHomeContentHub
      canManageBanners
      canManageAnnouncements={false}
      onCreateBanner={jest.fn()}
      onManageBanners={jest.fn()}
      onCreateAnnouncement={jest.fn()}
      onManageAnnouncements={jest.fn()}
    />);

    expect(screen.getByRole("button", { name: "platformBanners.create" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "operations.addAnnouncement" })).toBeNull();
  });

  it("keeps banner and popup creation actions separate when both grants exist", () => {
    const onCreateBanner = jest.fn();
    const onCreateAnnouncement = jest.fn();
    render(<ParentHomeContentHub
      canManageBanners
      canManageAnnouncements
      onCreateBanner={onCreateBanner}
      onManageBanners={jest.fn()}
      onCreateAnnouncement={onCreateAnnouncement}
      onManageAnnouncements={jest.fn()}
    />);

    fireEvent.press(screen.getByRole("button", { name: "platformBanners.create" }));
    fireEvent.press(screen.getByRole("button", { name: "operations.addAnnouncement" }));
    expect(onCreateBanner).toHaveBeenCalledTimes(1);
    expect(onCreateAnnouncement).toHaveBeenCalledTimes(1);
  });
});
