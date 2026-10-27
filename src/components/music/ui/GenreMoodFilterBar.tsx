import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import { QUICK_FILTERS, quickFiltersByKind, type QuickFilter } from "@/lib/mood-genre-filters";

type Props = {
  /** Active filter ids, e.g. `["mood:chill", "genre:lo-fi"]`. */
  activeIds: readonly string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  /** Instant match counts per filter id, used to label and dim chips. */
  counts?: Record<string, number> | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
};

function FilterChip({
  filter,
  active,
  count,
  disabled,
  onToggle,
}: {
  filter: QuickFilter;
  active: boolean;
  count?: number | undefined;
  disabled?: boolean | undefined;
  onToggle: (id: string) => void;
}) {
  const isEmpty = !active && count === 0;
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={() => onToggle(filter.id)}
      className={cn(
        "shrink-0 snap-start rounded-full px-3.5 py-1.5 text-xs transition-all active:scale-95 button-press whitespace-nowrap",
        active
          ? "border border-primary bg-primary font-semibold text-primary-foreground shadow-sm shadow-primary/25"
          : "border border-hair bg-card font-medium text-secondary-foreground hover:bg-chip-strong hover:text-foreground hover:border-hair-strong",
        isEmpty && "opacity-45",
        disabled && "opacity-50",
      )}
    >
      {filter.label}
      {active ? <X className="ml-1.5 inline-block h-3 w-3 opacity-90" aria-hidden="true" /> : null}
    </button>
  );
}

/**
 * Genre & Mood quick filter bar for the home feed.
 *
 * Tapping a chip narrows the feed instantly (the match happens locally against
 * the loaded tracks), and the same selection is used to pull fresh matching
 * tracks from the mood radio in the background.
 */
export function GenreMoodFilterBar({ activeIds, onToggle, onClear, counts, disabled, className }: Props) {
  const genres = quickFiltersByKind("genre");
  const moods = quickFiltersByKind("mood");
  const hasActive = activeIds.length > 0;

  const handleToggle = (id: string) => {
    triggerHaptic("selection");
    onToggle(id);
  };

  const handleClear = () => {
    triggerHaptic("selection");
    onClear();
  };

  return (
    <div
      role="group"
      aria-label="Genre and mood quick filters"
      data-testid="genre-mood-filter-bar"
      className={cn(
        "flex max-w-full items-center gap-2 overflow-x-auto py-2.5 px-1 scrollbar-hide snap-x snap-mandatory scroll-px-4",
        className
      )}
    >
      <button
        type="button"
        aria-pressed={!hasActive}
        disabled={disabled}
        onClick={handleClear}
        className={cn(
          "shrink-0 snap-start rounded-full px-3.5 py-1.5 text-xs transition-all active:scale-95 button-press whitespace-nowrap",
          !hasActive
            ? "border border-primary bg-primary font-semibold text-primary-foreground shadow-sm shadow-primary/25"
            : "border border-hair bg-card font-medium text-secondary-foreground hover:bg-chip-strong hover:text-foreground hover:border-hair-strong",
          disabled && "opacity-50",
        )}
      >
        All
      </button>

      <span aria-hidden="true" className="shrink-0 pl-1.5 pr-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Genre
      </span>
      {genres.map((filter) => (
        <FilterChip
          key={filter.id}
          filter={filter}
          active={activeIds.includes(filter.id)}
          count={counts?.[filter.id]}
          disabled={disabled}
          onToggle={handleToggle}
        />
      ))}

      <span aria-hidden="true" className="shrink-0 pl-2.5 pr-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Mood
      </span>
      {moods.map((filter) => (
        <FilterChip
          key={filter.id}
          filter={filter}
          active={activeIds.includes(filter.id)}
          count={counts?.[filter.id]}
          disabled={disabled}
          onToggle={handleToggle}
        />
      ))}
      <div className="w-3 shrink-0" aria-hidden="true" />
    </div>
  );
}

/** Total number of quick filters available (used by tests and empty states). */
export const QUICK_FILTER_COUNT = QUICK_FILTERS.length;
