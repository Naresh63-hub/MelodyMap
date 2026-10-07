import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Theme } from '@/lib/theme';

type Props = {
  theme: Theme;
  onChange: (theme: Theme) => void;
};

export function ThemeToggle({ theme, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 bg-card rounded-full p-1 border border-hair">
      <button
        onClick={() => onChange('light')}
        className={cn(
          "p-2 rounded-full transition-all",
          theme === 'light' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Light theme"
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        onClick={() => onChange('dark')}
        className={cn(
          "p-2 rounded-full transition-all",
          theme === 'dark' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Dark theme"
      >
        <Moon className="h-4 w-4" />
      </button>
      <button
        onClick={() => onChange('auto')}
        className={cn(
          "p-2 rounded-full transition-all",
          theme === 'auto' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Auto theme"
      >
        <Monitor className="h-4 w-4" />
      </button>
    </div>
  );
}
