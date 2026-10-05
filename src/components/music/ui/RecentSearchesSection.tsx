import { Clock, X, Trash2, ArrowUpRight } from "lucide-react";
import { useSearchHistory } from "@/lib/search-history";
import { cn } from "@/lib/utils";

interface Props {
  onSelectQuery: (query: string) => void;
  className?: string;
  maxItems?: number;
}

/**
 * 'Recent Searches' component displaying the last 5 searched artist or song terms
 * stored locally in localStorage, allowing users to quickly jump back to previous queries.
 */
export function RecentSearchesSection({
  onSelectQuery,
  className,
  maxItems = 5,
}: Props) {
  const { recentSearches, removeSearch, clearHistory } = useSearchHistory();
  const last5 = recentSearches.slice(0, maxItems);

  if (last5.length === 0) return null;

  return (
    <section className={cn("space-y-2.5 animate-fade-in", className)}>
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-neutral-400" />
          <h2 className="text-sm font-semibold tracking-normal text-white/90">
            Recent Searches
          </h2>
          <span className="text-[10px] font-normal text-neutral-400 px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
            Last {last5.length}
          </span>
        </div>

        <button
          type="button"
          onClick={clearHistory}
          className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-red-400 transition-colors py-1 px-1.5 rounded active:scale-95"
          title="Clear recent searches"
        >
          <Trash2 className="h-3 w-3" />
          <span>Clear</span>
        </button>
      </div>

      {/* Horizontal pill list for quick jump-back */}
      <div className="flex flex-wrap gap-2">
        {last5.map((item) => (
          <div
            key={`${item.query}-${item.timestamp}`}
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] pl-3 pr-1.5 py-1 text-xs text-neutral-300 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.12] transition-all"
          >
            <button
              type="button"
              onClick={() => onSelectQuery(item.query)}
              className="flex items-center gap-1.5 text-left focus:outline-none"
              title={`Search again for "${item.query}"`}
            >
              <span className="font-normal truncate max-w-[140px] sm:max-w-[200px]">
                {item.query}
              </span>
              <ArrowUpRight className="h-3 w-3 text-white/30 group-hover:text-white/70 transition-colors" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeSearch(item.query);
              }}
              aria-label={`Remove ${item.query} from recent searches`}
              className="flex h-4 w-4 items-center justify-center rounded-full text-white/30 hover:text-white hover:bg-white/[0.1] transition-all ml-0.5"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
