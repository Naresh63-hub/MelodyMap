import { useState, useEffect, useCallback } from "react";
import { safeStorage } from "./safe-storage";

export type Theme = "dark" | "light" | "auto";

export const THEME_KEY = "melodymap-theme";

export const THEME_COLOR_DARK = "#0b0813"; // Theme A: Midnight Music (Dark)
export const THEME_COLOR_LIGHT = "#FAF9FF"; // Theme B: Purple Dream (Light)

const listeners = new Set<() => void>();
export let themeWriteSeq = 0;

let mediaQueryListenerAttached = false;
let mediaQueryList: MediaQueryList | null = null;

function handleSystemThemeChange() {
  if (getStoredTheme() === "auto") {
    applyTheme("auto");
    listeners.forEach((l) => l());
  }
}

/** Check if system prefers dark mode */
export function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true; // Default to dark (Midnight Music)
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return true;
  }
}

/** Read stored theme choice from safeStorage ('dark' | 'light' | 'auto') */
export function getStoredTheme(): Theme {
  try {
    const val = safeStorage.getItem(THEME_KEY);
    if (val === "light" || val === "dark" || val === "auto") {
      return val;
    }
  } catch {}
  return "dark"; // Default to Midnight Music (Theme A)
}

/** Resolve given theme mode to concrete 'dark' or 'light' */
export function resolveTheme(mode?: Theme | string): "dark" | "light" {
  const chosen = (mode || getStoredTheme()) as Theme;
  if (chosen === "light") return "light";
  if (chosen === "dark") return "dark";
  // 'auto'
  return getSystemPrefersDark() ? "dark" : "light";
}

/** Apply the resolved theme to <html> and native chrome hints */
export function applyTheme(mode?: Theme | string): void {
  if (typeof document === "undefined") return;

  const targetMode = (mode || getStoredTheme()) as Theme;
  const resolved = resolveTheme(targetMode);

  const root = document.documentElement;
  if (resolved === "light") {
    root.classList.remove("dark");
    root.classList.add("light");
    root.style.colorScheme = "light";
  } else {
    root.classList.remove("light");
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  }

  // Update <meta name="theme-color">
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = resolved === "light" ? THEME_COLOR_LIGHT : THEME_COLOR_DARK;
  }

  // Synchronize native Android status bar icons
  // isLight = true: dark status bar icons on light status bar
  // isLight = false: white status bar icons on dark status bar
  if (typeof window !== "undefined") {
    const androidTheme = (window as unknown as { AndroidTheme?: { setStatusBarTheme?: (isLight: boolean) => void } }).AndroidTheme;
    if (androidTheme?.setStatusBarTheme) {
      try {
        androidTheme.setStatusBarTheme(resolved === "light");
      } catch {}
    }

    // Attach system listener if not already attached
    if (!mediaQueryListenerAttached && typeof window.matchMedia === "function") {
      try {
        mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
        if (typeof mediaQueryList.addEventListener === "function") {
          mediaQueryList.addEventListener("change", handleSystemThemeChange);
        } else if (typeof (mediaQueryList as unknown as { addListener?: (fn: () => void) => void }).addListener === "function") {
          (mediaQueryList as unknown as { addListener: (fn: () => void) => void }).addListener(handleSystemThemeChange);
        }
        mediaQueryListenerAttached = true;
      } catch {}
    }
  }
}

/** Persist user's theme mode and apply immediately */
export function setStoredTheme(mode: Theme): void {
  try {
    safeStorage.setItem(THEME_KEY, mode);
  } catch {}
  themeWriteSeq++;
  applyTheme(mode);
  listeners.forEach((l) => l());
}

/** Permanent / explicit theme mode handler */
export function setThemeMode(mode: Theme): void {
  setStoredTheme(mode);
}

/** React hook / listener subscription */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook for theme reading and toggling */
export function useTheme(): {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  setTheme: (mode: Theme) => void;
} {
  const [theme, setLocalTheme] = useState<Theme>(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() => resolveTheme(getStoredTheme()));

  useEffect(() => {
    const update = () => {
      const current = getStoredTheme();
      setLocalTheme(current);
      setResolvedTheme(resolveTheme(current));
    };
    return subscribeTheme(update);
  }, []);

  const setTheme = useCallback((mode: Theme) => {
    setStoredTheme(mode);
  }, []);

  return { theme, resolvedTheme, setTheme };
}
