import { useCallback, useEffect, useRef, useState } from "react";

type SleepTimerDuration = number | null; // null = disabled, number = minutes

export function useSleepTimer(onSleep: () => void) {
  const [duration, setDuration] = useState<SleepTimerDuration>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback((minutes: number) => {
    clearTimers();
    setDuration(minutes);
    setRemaining(minutes * 60); // Convert to seconds

    // Set the main sleep timer
    timerRef.current = setTimeout(() => {
      onSleep();
      clearTimers();
      setDuration(null);
      setRemaining(0);
    }, minutes * 60 * 1000);

    // Update remaining time every second
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearTimers();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimers, onSleep]);

  const cancelTimer = useCallback(() => {
    clearTimers();
    setDuration(null);
    setRemaining(0);
  }, [clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const formatRemaining = useCallback(() => {
    if (remaining === 0) return "00:00";
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, [remaining]);

  return {
    remaining,
    formattedRemaining: formatRemaining(),
    isActive: duration !== null,
    startTimer,
    cancelTimer,
  };
}