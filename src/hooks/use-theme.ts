import { useSyncExternalStore } from 'react';
import {
  applyTheme,
  getStoredTheme,
  setThemeMode,
  subscribeTheme,
  themeWriteSeq,
  type Theme,
} from '@/lib/theme';

let cachedMode: Theme | null = null;
let cachedSeq = -1;

/** Stable snapshot for useSyncExternalStore (avoids infinite re-reads). */
function getThemeSnapshot(): Theme {
  if (cachedMode === null || cachedSeq !== themeWriteSeq) {
    cachedMode = getStoredTheme();
    cachedSeq = themeWriteSeq;
  }
  return cachedMode;
}

function getThemeServerSnapshot(): Theme {
  return 'dark';
}

/**
 * Reactive theme-mode store: reads the persisted mode, keeps it applied to
 * <html> (class + color-scheme + meta theme-color) and re-renders subscribers
 * whenever the mode changes.
 */
export function useTheme(override?: Theme) {
  const stored = useSyncExternalStore(
    (onStoreChange) => {
      const unsub = subscribeTheme(onStoreChange);
      // Re-apply on mount so SSR markup and the stored preference converge.
      applyTheme(getThemeSnapshot());
      return unsub;
    },
    getThemeSnapshot,
    getThemeServerSnapshot,
  );

  const mode = override ?? stored;

  const setMode = (next: Theme) => {
    setThemeMode(next);
  };

  return { mode, setMode };
}
