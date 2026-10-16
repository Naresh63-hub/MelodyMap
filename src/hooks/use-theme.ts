import type { Theme } from '@/lib/theme';

/**
 * Reactive theme hook: MelodyMap permanently uses the Deep Violet theme.
 */
export function useTheme(_override?: Theme) {
  return {
    mode: 'dark' as const,
    setMode: (_next: Theme) => {
      // Theme switching is disabled; permanent Deep Violet
    },
  };
}

