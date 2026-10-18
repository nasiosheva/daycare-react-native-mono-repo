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

  it("pauses during interaction and starts a fresh interval after resuming", () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useAutoAdvanceCarousel(2, 1_000));

    act(() => jest.advanceTimersByTime(900));
    act(() => result.current.pauseAutoAdvance());
    act(() => jest.advanceTimersByTime(2_000));
    expect(result.current.activeIndex).toBe(0);

    act(() => result.current.resumeAutoAdvance());
    act(() => jest.advanceTimersByTime(999));
    expect(result.current.activeIndex).toBe(0);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current.activeIndex).toBe(1);
  });
});
