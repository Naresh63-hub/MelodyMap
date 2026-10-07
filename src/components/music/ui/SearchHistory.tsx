import { useState, useEffect } from 'react';
import { X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';

const SEARCH_HISTORY_KEY = 'melodymap-search-history';
const MAX_HISTORY = 10;

type Props = {
  onSelect: (query: string) => void;
  className?: string;
};

export function SearchHistory({ onSelect, className }: Props) {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading search history:', e);
    }
  }, []);

  const addToHistory = (query: string) => {
    if (!query.trim()) return;
    
    setHistory(prev => {
      const filtered = prev.filter(h => h !== query);
      const updated = [query, ...filtered].slice(0, MAX_HISTORY);
      
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('Error saving search history:', e);
        }
      }
      
      return updated;
    });
  };

  const removeFromHistory = (query: string) => {
    triggerHaptic('light');
    setHistory(prev => {
      const updated = prev.filter(h => h !== query);
      
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('Error saving search history:', e);
        }
      }
      
      return updated;
    });
  };

  const clearHistory = () => {
    triggerHaptic('medium');
    setHistory([]);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(SEARCH_HISTORY_KEY);
      } catch (e) {
        console.error('Error clearing search history:', e);
      }
    }
  };

  // Expose addToHistory for parent component
  (SearchHistory as any).addToHistory = addToHistory;

  if (history.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <Clock className="h-3 w-3" />
          Recent Searches
        </div>
        <button
          type="button"
          onClick={clearHistory}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear
        </button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {history.map((query) => (
          <button
            key={query}
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onSelect(query);
            }}
            className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-chip border border-hair-strong text-xs font-medium text-foreground/80 hover:bg-chip-strong hover:text-foreground transition-all"
          >
            {query}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeFromHistory(query);
              }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}
