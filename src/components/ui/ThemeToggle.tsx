import type { Theme } from '@/lib/theme';

type Props = {
  theme?: Theme;
  onChange?: (theme: Theme) => void;
};

/**
 * ThemeToggle is disabled. MelodyMap uses ONE permanent Deep Violet theme.
 */
export function ThemeToggle(_props?: Props) {
  return null;
}

