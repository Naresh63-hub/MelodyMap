export type Theme = 'dark' | 'light' | 'auto';

const THEME_KEY = 'melodymap-theme';

const THEME_COLOR = '#10091f';

/** Resolve theme: MelodyMap permanently uses the Deep Violet theme. */
export function resolveTheme(_mode?: string): 'dark' {
  return 'dark';
}

export function getStoredTheme(): 'dark' {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(THEME_KEY);
    }
  } catch {}
  return 'dark';
}

/** Apply the permanent Deep Violet theme to <html> and native chrome hints. */
export function applyTheme(_mode?: string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light');
  root.classList.add('dark');
  root.style.colorScheme = 'dark';
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLOR;

  // Synchronize native Android status bar icons (light icons on dark background)
  if (typeof window !== 'undefined') {
    const androidTheme = (window as unknown as { AndroidTheme?: { setStatusBarTheme?: (isLight: boolean) => void } }).AndroidTheme;
    if (androidTheme?.setStatusBarTheme) {
      try {
        androidTheme.setStatusBarTheme(false);
      } catch {}
    }
  }
}

const listeners = new Set<() => void>();

export let themeWriteSeq = 0;

export function setStoredTheme(_mode: Theme): void {
  // Theme is locked to Deep Violet; no-op
  themeWriteSeq++;
  applyTheme('dark');
  listeners.forEach((l) => l());
}

/** Permanent Deep Violet theme mode handler. */
export function setThemeMode(_mode: Theme): void {
  setStoredTheme('dark');
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
