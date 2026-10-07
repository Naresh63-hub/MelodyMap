export type Theme = 'dark' | 'light' | 'auto';

const THEME_KEY = 'melodymap-theme';

const THEME_COLORS = {
  dark: '#050b12',
  light: '#f2f5fa',
} as const;

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light' || value === 'auto';
}

/** Resolve an abstract mode to the concrete palette in use right now. */
export function resolveTheme(mode: Theme): 'dark' | 'light' {
  if (mode === 'auto') {
    const prefersLight =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches;
    return prefersLight ? 'light' : 'dark';
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

/** Toggle the `html.light` class + native chrome hints for a given mode. */
export function applyTheme(mode: Theme): void {
  if (typeof document === 'undefined') return;
  const light = resolveTheme(mode) === 'light';
  const root = document.documentElement;
  root.classList.toggle('light', light);
  root.style.colorScheme = light ? 'light' : 'dark';
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = light ? THEME_COLORS.light : THEME_COLORS.dark;
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
