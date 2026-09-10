import { useCallback, useRef, useState } from "react";

type PullState = "idle" | "pulled" | "refreshing";

/**
 * Touch-based pull-to-refresh for a scrollable container.
 * Returns a ref to attach to the scroll element, visual state for a spinner,
 * and an onRefresh callback the consumer should call to do the actual work.
 *
 * Only activates when the container is scrolled to the top.
 */
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pullDistance, setPullDistance] = useState(0);
  const [state, setState] = useState<PullState>("idle");

  const startY = useRef(0);
  const pulling = useRef(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const distanceRef = useRef(pullDistance);
  distanceRef.current = pullDistance;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const THRESHOLD = 80; // px needed to trigger refresh
  const MAX_PULL = 120; // cap the visual pull distance

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = ref.current;
    if (!el || el.scrollTop > 5) return; // only pull when at top
    const touch = e.touches[0];
    if (!touch) return;
    startY.current = touch.clientY;
    pulling.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || stateRef.current === "refreshing") return;
    const el = ref.current;
    if (!el || el.scrollTop > 5) {
      pulling.current = false;
      setPullDistance(0);
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;
    const dy = touch.clientY - startY.current;
    if (dy <= 0) {
      setPullDistance(0);
      return;
    }
    // Rubber-band: diminishing returns past the threshold
    const dampened = Math.min(MAX_PULL, dy * 0.55);
    setPullDistance(dampened);
    if (dampened > THRESHOLD) setState("pulled");
    else setState("idle");
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (distanceRef.current > THRESHOLD && stateRef.current !== "refreshing") {
      setState("refreshing");
      setPullDistance(40); // hold the spinner visible
      try {
        await onRefreshRef.current();
      } finally {
        setState("idle");
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
      setState("idle");
    }
  }, []);

  return {
    ref,
    pullDistance,
    isRefreshing: state === "refreshing",
    canRelease: state === "pulled",
    touchHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    } satisfies React.HTMLAttributes<HTMLDivElement>,
  };
}
