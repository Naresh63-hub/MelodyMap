export type Theme = 'dark' | 'light' | 'auto';

const THEME_KEY = 'melodymap-theme';

const THEME_COLORS = {
  dark: '#170d35',
  light: '#f8fafc',
} as const;

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light' || value === 'auto';
}

/** Resolve an abstract mode to the concrete palette in use right now. */
export function resolveTheme(mode: Theme): 'dark' | 'light' {
  if (mode === 'auto') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  }
  return mode;
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    /* private mode / unavailable storage */
  }
  return 'dark';
}

/** Toggle the `html.light` or `html.dark` class + native chrome hints for a given mode. */
export function applyTheme(mode: Theme): void {
  if (typeof document === 'undefined') return;
  const concrete = resolveTheme(mode);
  const isLight = concrete === 'light';
  const root = document.documentElement;
  root.classList.toggle('light', isLight);
  root.classList.toggle('dark', !isLight);
  root.style.colorScheme = isLight ? 'light' : 'dark';
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = isLight ? '#f8fafc' : '#170d35';

  // Synchronize native Android status bar icons (dark icons on light background, light icons on dark background)
  if (typeof window !== 'undefined') {
    const androidTheme = (window as unknown as { AndroidTheme?: { setStatusBarTheme?: (isLight: boolean) => void } }).AndroidTheme;
    if (androidTheme?.setStatusBarTheme) {
      try {
        androidTheme.setStatusBarTheme(isLight);
      } catch {}
    }
  }
}

const listeners = new Set<() => void>();

/** Lets the reactive hook's cached snapshot be invalidated by external writes. */
export let themeWriteSeq = 0;

export function setStoredTheme(mode: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* private mode / unavailable storage */
  }
  themeWriteSeq++;
  applyTheme(mode);
  listeners.forEach((l) => l());
}

let subscribed = false;
function ensureSystemSubscription(): void {
  if (subscribed || typeof window === 'undefined') return;
  subscribed = true;
  window
    .matchMedia('(prefers-color-scheme: light)')
    .addEventListener('change', () => {
      if (getStoredTheme() === 'auto') applyTheme('auto');
    });
}

/** Change mode, persist it, apply it and notify store subscribers. */
export function setThemeMode(mode: Theme): void {
  setStoredTheme(mode);
}

export function subscribeTheme(listener: () => void): () => void {
  ensureSystemSubscription();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
