// Mories Deo Hutapea,S.E.,S.Kom
import { useCallback, useEffect, useState } from "react";

export const PARENT_CAROUSEL_AUTO_ADVANCE_MS = 5_000;

export function useAutoAdvanceCarousel(itemCount: number, intervalMs = PARENT_CAROUSEL_AUTO_ADVANCE_MS) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const pauseAutoAdvance = useCallback(() => setIsPaused(true), []);
  const resumeAutoAdvance = useCallback(() => setIsPaused(false), []);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, itemCount - 1)));
  }, [itemCount]);

  useEffect(() => {
    if (itemCount < 2 || intervalMs <= 0 || isPaused) return undefined;
    const timer = setInterval(() => setActiveIndex((index) => (index + 1) % itemCount), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, isPaused, itemCount]);

  return { activeIndex, setActiveIndex, pauseAutoAdvance, resumeAutoAdvance };
}
