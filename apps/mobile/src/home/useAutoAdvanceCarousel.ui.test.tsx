// Mories Deo Hutapea,S.E.,S.Kom
import { act, renderHook } from "@testing-library/react-native";
import { useAutoAdvanceCarousel } from "./useAutoAdvanceCarousel";

describe("useAutoAdvanceCarousel", () => {
  afterEach(() => jest.useRealTimers());

  it("advances and wraps slides automatically, but does not tick with one slide", () => {
    jest.useFakeTimers();
    const { result, rerender } = renderHook(({ count }) => useAutoAdvanceCarousel(count, 1_000), { initialProps: { count: 2 } });

    act(() => jest.advanceTimersByTime(1_000));
    expect(result.current.activeIndex).toBe(1);
    act(() => jest.advanceTimersByTime(1_000));
    expect(result.current.activeIndex).toBe(0);

    rerender({ count: 1 });
    act(() => jest.advanceTimersByTime(3_000));
    expect(result.current.activeIndex).toBe(0);
  });
});
