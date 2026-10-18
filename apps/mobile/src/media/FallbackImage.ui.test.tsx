// Mories Deo Hutapea,S.E.,S.Kom
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FallbackImage } from "./FallbackImage";

describe("FallbackImage", () => {
  it("shows an accessible placeholder when the remote image fails", () => {
    render(<FallbackImage uri="https://cdn.example/image.jpg" accessibilityLabel="Promo" fallbackLabel="Image unavailable" />);

    fireEvent(screen.getByLabelText("Promo"), "error");

    expect(screen.getByText("Image unavailable")).toBeTruthy();
  });
});
