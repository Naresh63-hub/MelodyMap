import { useState, useCallback, useRef, useEffect } from 'react';
import { triggerHaptic } from '@/lib/haptics';

type Props = {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
};

export function usePullToRefresh({ onRefresh, threshold = 80 }: Props) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const startYRef = useRef<number>(0);
  const isDraggingRef = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    const touch = e.touches[0];
    if (!touch) return;
    startYRef.current = touch.clientY;
    isDraggingRef.current = true;
  }, [isRefreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current || isRefreshing) return;
    
    const touch = e.touches[0];
    if (!touch) return;
    const currentY = touch.clientY;
    const distance = currentY - startYRef.current;
    
    // Only trigger if pulling down and at top of scroll
    const target = e.currentTarget;
    if (target.scrollTop === 0 && distance > 0) {
      const clampedDistance = Math.min(distance * 0.5, threshold * 1.5);
      setPullDistance(clampedDistance);
      setIsPulling(clampedDistance >= threshold);
    }
  }, [threshold, isRefreshing]);

  const onTouchEnd = useCallback(async () => {
    isDraggingRef.current = false;
    
    if (isPulling && !isRefreshing) {
      setIsRefreshing(true);
      triggerHaptic('light');
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        setIsPulling(false);
      }
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  }, [isPulling, isRefreshing, onRefresh]);

  useEffect(() => {
    return () => {
      isDraggingRef.current = false;
    };
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    // Grouped handlers so consumers can spread them onto the scroll container.
    pullToRefreshProps: { onTouchStart, onTouchMove, onTouchEnd },
    pullDistance,
    isPulling,
    isRefreshing,
  };
}
