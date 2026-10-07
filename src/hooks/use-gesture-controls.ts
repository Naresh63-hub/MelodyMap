import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lightweight touch-gesture helpers for the player surfaces.
 * - useSwipeGestures: dominant vertical swipes (up/down) without blocking taps.
 * - useDoubleTapSeek: YouTube-Music-style double-tap ±seek on an element,
 *   with a transient visual flash state ("left" | "right").
 *
 * Deliberately dependency-free: pointer events vary across Android WebViews,
 * so we use raw touch events + a dblclick fallback for desktop.
 */

type SwipeOptions = {
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  /** Minimum vertical travel (px) to count as a swipe. */
  threshold?: number;
};

export function useSwipeGestures({ onSwipeUp, onSwipeDown, threshold = 56 }: SwipeOptions) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    startRef.current = t ? { x: t.clientX, y: t.clientY } : null;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      // Require clear vertical travel AND vertical dominance over horizontal
      if (Math.abs(dy) < threshold || Math.abs(dy) < Math.abs(dx) * 1.4) return;
      if (dy < 0) onSwipeUp?.();
      else onSwipeDown?.();
    },
    [threshold, onSwipeUp, onSwipeDown],
  );

  return { onTouchStart, onTouchEnd };
}

export type SeekFlash = "left" | "right" | null;

type DoubleTapSeekOptions = {
  onBackward: (seconds: number) => void;
  onForward: (seconds: number) => void;
  seconds?: number;
};

export function useDoubleTapSeek({ onBackward, onForward, seconds = 10 }: DoubleTapSeekOptions) {
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flash, setFlash] = useState<SeekFlash>(null);

  const trigger = useCallback(
    (side: Exclude<SeekFlash, null>) => {
      if (side === "right") onForward(seconds);
      else onBackward(seconds);
      setFlash(side);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlash(null), 550);
    },
    [onBackward, onForward, seconds],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      const t = e.changedTouches[0];
      if (!t) return;
      const now = Date.now();
      const prev = lastTapRef.current;
      const rect = e.currentTarget.getBoundingClientRect();
      const side: Exclude<SeekFlash, null> = t.clientX - rect.left >= rect.width / 2 ? "right" : "left";
      if (prev && now - prev.time < 320 && Math.abs(t.clientX - prev.x) < 44 && Math.abs(t.clientY - prev.y) < 44) {
        lastTapRef.current = null;
        trigger(side);
      } else {
        lastTapRef.current = { time: now, x: t.clientX, y: t.clientY };
      }
    },
    [trigger],
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const side: Exclude<SeekFlash, null> = e.clientX - rect.left >= rect.width / 2 ? "right" : "left";
      trigger(side);
    },
    [trigger],
  );

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  return { gestureProps: { onTouchEnd, onDoubleClick }, flash };
}
