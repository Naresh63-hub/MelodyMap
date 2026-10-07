import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';

type Props = {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftActionLabel?: string;
  rightActionLabel?: string;
  leftActionColor?: string;
  rightActionColor?: string;
  className?: string;
};

export function SwipeableListItem({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftActionLabel = 'Delete',
  rightActionLabel = 'Like',
  leftActionColor = '#ef4444',
  rightActionColor = '#22c55e',
  className,
}: Props) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startXRef.current = touch.clientX;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    if (!touch) return;
    const currentX = touch.clientX;
    const diff = currentX - startXRef.current;
    const clampedDiff = Math.max(-100, Math.min(100, diff * 0.6));
    setDragX(clampedDiff);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 60;
    if (dragX > threshold && onSwipeRight) {
      triggerHaptic('light');
      onSwipeRight();
    } else if (dragX < -threshold && onSwipeLeft) {
      triggerHaptic('light');
      onSwipeLeft();
    }

    setDragX(0);
  }, [isDragging, dragX, onSwipeLeft, onSwipeRight]);

  return (
    <div
      className={cn('relative overflow-hidden touch-none', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Right action background */}
      {onSwipeRight && (
        <div
          className={cn(
            'absolute inset-y-0 right-0 flex items-center justify-end px-4 transition-all',
            dragX > 0 ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            backgroundColor: rightActionColor,
            width: `${Math.max(0, dragX)}px`,
          }}
        >
          <span className="text-white text-xs font-semibold">{rightActionLabel}</span>
        </div>
      )}

      {/* Left action background */}
      {onSwipeLeft && (
        <div
          className={cn(
            'absolute inset-y-0 left-0 flex items-center justify-start px-4 transition-all',
            dragX < 0 ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            backgroundColor: leftActionColor,
            width: `${Math.max(0, -dragX)}px`,
            left: `${Math.min(0, dragX)}px`,
          }}
        >
          <span className="text-white text-xs font-semibold">{leftActionLabel}</span>
        </div>
      )}

      {/* Content */}
      <div
        className={cn('relative transition-transform', isDragging && 'scale-95')}
        style={{
          transform: `translateX(${dragX}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
