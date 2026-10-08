import { fireEvent, render } from "@testing-library/react-native";
import { AppText, NavigationCard } from "@daycare/ui";

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

describe("NavigationCard UI baseline", () => {
  it("exposes the whole card as an accessible button and handles a press", () => {
    const onPress = jest.fn();

    const rendered = render(
      <NavigationCard accessibilityLabel="Kelola akun Parent" onPress={onPress}>
        <AppText>Kelola akun Parent</AppText>
      </NavigationCard>,
    );

    const { getByRole } = rendered;

    const card = getByRole("button", { name: "Kelola akun Parent" });
    expect(card).toBeTruthy();

    fireEvent.press(card);

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
