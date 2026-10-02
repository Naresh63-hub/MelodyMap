import { useEffect, useState, useCallback } from "react";
import {
  sleepTimerService,
  type SleepTimerState,
  SLEEP_TIMER_PRESETS,
} from "@/lib/sleep-timer";

export function useSleepTimer(onSleep?: () => void) {
  const [state, setState] = useState<SleepTimerState>(() => sleepTimerService.getState());

  useEffect(() => {
    const unsub = sleepTimerService.subscribe((nextState) => {
      setState(nextState);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!onSleep) return;
    const unsub = sleepTimerService.onExpire(onSleep);
    return unsub;
  }, [onSleep]);

  const startTimer = useCallback((minutes: number) => {
    sleepTimerService.start(minutes);
  }, []);

  const cancelTimer = useCallback(() => {
    sleepTimerService.cancel();
  }, []);

  const restartTimer = useCallback(() => {
    sleepTimerService.restart();
  }, []);

  const setDuration = useCallback((minutes: number) => {
    sleepTimerService.setDuration(minutes);
  }, []);

  const resetExpired = useCallback(() => {
    sleepTimerService.resetExpired();
  }, []);

  return {
    state,
    isActive: state.active,
    isExpired: state.expired,
    durationMinutes: state.durationMinutes,
    remaining: state.remainingSeconds,
    remainingSeconds: state.remainingSeconds,
    formattedRemaining: sleepTimerService.formatRemaining(state.remainingSeconds),
    presets: SLEEP_TIMER_PRESETS,
    startTimer,
    cancelTimer,
    restartTimer,
    setDuration,
    resetExpired,
  };
}