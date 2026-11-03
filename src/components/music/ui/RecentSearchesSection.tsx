import { Clock, ChevronRight, X } from "lucide-react";
import { useSearchHistory } from "@/lib/search-history";
import { cn } from "@/lib/utils";

const POPULAR_SEARCHES = ["Trending", "lofi", "party", "love", "sad", "focus"];

interface Props {
  onSelectQuery: (query: string) => void;
  className?: string;
  maxItems?: number;
}

/**
 * Screen 14: Recent Searches & Popular Searches
 * Matches the uploaded reference design for Midnight Music (Dark) & Purple Dream (Light).
 */
export function RecentSearchesSection({
  onSelectQuery,
  className,
  maxItems = 5,
}: Props) {
  const { recentSearches, removeSearch, clearHistory } = useSearchHistory();
  const last5 = recentSearches.slice(0, maxItems);

  return (
    <div className={cn("space-y-6 animate-fade-in", className)}>
      {/* Recent Searches section (Screen 14) */}
      {last5.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-sm font-bold text-foreground tracking-tight">
              Recent Searches
            </h2>

            <button
              type="button"
              onClick={clearHistory}
              className="text-xs font-semibold text-primary hover:underline cursor-pointer py-1 px-1 transition-colors"
              title="Clear all recent searches"
            >
              Clear all
            </button>
          </div>

          <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
            {last5.map((item) => (
              <div
                key={`${item.query}-${item.timestamp}`}
                className="group flex items-center justify-between p-3.5 hover:bg-surface-hover transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelectQuery(item.query)}
                  className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
                >
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">
                    {item.query}
                  </span>
                </button>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSearch(item.query);
                    }}
                    aria-label={`Remove ${item.query} from recent searches`}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-active transition-all"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Popular Searches section (Screen 14) */}
      <section className="space-y-2.5">
        <h2 className="text-sm font-bold text-foreground tracking-tight">
          Popular Searches
        </h2>

        <div className="flex flex-wrap gap-2">
          {POPULAR_SEARCHES.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => onSelectQuery(term)}
              className="rounded-full border border-border bg-card hover:bg-surface-hover hover:border-primary/40 px-3.5 py-1.5 text-xs font-medium text-foreground transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              {term}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
