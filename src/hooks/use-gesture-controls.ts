import { useCallback, useEffect, useRef, useState } from "react";
import { triggerHaptic } from "@/lib/haptics";

/**
 * Lightweight touch-gesture helpers for the player surfaces.
 * - useSwipeGestures: dominant vertical swipes (up/down) without blocking taps.
 * - useDoubleTapSeek: YouTube-Music-style double-tap ±seek on an element,
 *   with a transient visual flash state ("left" | "right").
 * - useDragToDismiss: finger-following vertical drag that throws the surface
 *   off-screen (down) or springs it back.
 *
 * Deliberately dependency-free: pointer events vary across Android WebViews,
 * so we use raw touch events + a dblclick fallback for desktop.
 */

type SwipeOptions = {
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum travel (px) to count as a swipe. */
  threshold?: number;
};

export function useSwipeGestures({ onSwipeUp, onSwipeDown, onSwipeLeft, onSwipeRight, threshold = 56 }: SwipeOptions) {
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

      // Determine dominant direction
      const isHorizontal = Math.abs(dx) > Math.abs(dy);
      const isVertical = Math.abs(dy) > Math.abs(dx);

      if (isHorizontal && Math.abs(dx) >= threshold) {
        triggerHaptic('light');
        if (dx < 0) onSwipeLeft?.();
        else onSwipeRight?.();
      } else if (isVertical && Math.abs(dy) >= threshold) {
        triggerHaptic('light');
        if (dy < 0) onSwipeUp?.();
        else onSwipeDown?.();
      }
    },
    [threshold, onSwipeUp, onSwipeDown, onSwipeLeft, onSwipeRight],
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
      triggerHaptic('medium');
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

type DragToDismissOptions = {
  onDismiss: () => void;
  /** Travel (px) at release that counts as an intent to dismiss. */
  threshold?: number;
};

/**
 * Vertical drag-to-dismiss: the element follows the finger downward (with
 * rubber-band resistance upward) and is either thrown off-screen or springs
 * back on release. Also accounts for fast flings with little travel.
 */
export function useDragToDismiss({ onDismiss, threshold = 90 }: DragToDismissOptions) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dismissedRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lastRef = useRef<{ y: number; t: number; v: number }>({ y: 0, t: 0, v: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    startRef.current = { x: t.clientX, y: t.clientY };
    lastRef.current = { y: t.clientY, t: Date.now(), v: 0 };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const start = startRef.current;
    const t = e.touches[0];
    if (!start || !t) return;
    const now = Date.now();
    const dt = Math.max(1, now - lastRef.current.t);
    const v = (t.clientY - lastRef.current.y) / dt; // px per ms
    lastRef.current = { y: t.clientY, t: now, v };

    let dy = t.clientY - start.y;
    const dx = Math.abs(t.clientX - start.x);
    // Horizontal-dominant drags are not a dismiss gesture
    if (dx > Math.abs(dy) * 1.4) return;
    if (!dismissedRef.current) setDragging(true);
    // Rubber-band resistance when dragging upward
    if (dy < 0) dy = dy * 0.15;
    setDragY(dy);
  }, []);

  const onTouchEnd = useCallback(() => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || dismissedRef.current) return;
    const fling = lastRef.current.v > 0.75; // fast downward flick
    const past = lastRef.current.y - start.y > threshold;

    if ((fling || past) && lastRef.current.y >= start.y) {
      // Throw off-screen, then notify after the exit transition
      dismissedRef.current = true;
      setDragging(false);
      setDragY(Math.max(200, window.innerHeight));
      timerRef.current = setTimeout(onDismiss, 220);
    } else {
      setDragging(false);
      setDragY(0);
    }
  }, [onDismiss, threshold]);

  useEffect(() => {
    dismissedRef.current = false;
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { dragProps: { onTouchStart, onTouchMove, onTouchEnd }, dragY, dragging };
}
