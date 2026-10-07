import { Compass, Home, Mic, Library as LibraryIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavTab } from "./Sidebar";
import { triggerHaptic } from "@/lib/haptics";

/** Mobile bottom navigation tabs. */
export const MOBILE_TABS: Array<{ id: NavTab; label: string; icon: typeof Home }> = [
  { id: "foryou", label: "Home", icon: Home },
  { id: "explore", label: "Explore", icon: Compass },
  { id: "search", label: "Search", icon: Search },
  { id: "podcasts", label: "Podcasts", icon: Mic },
  { id: "library", label: "Library", icon: LibraryIcon },
];

type Props = {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  hasTrack: boolean;
};

export function MobileNav({ activeTab, onNavigate, hasTrack: _hasTrack }: Props) {
  return (
    <nav
      className="fixed z-40 flex items-stretch justify-around border-t border-hair-strong glass-frosted safe-bottom max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl mx-auto left-0 right-0 bottom-0"
      style={{ height: "var(--mobile-nav-height, 56px)" }}
      aria-label="Mobile navigation"
    >
      {MOBILE_TABS.map(({ id, label, icon: Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onNavigate(id);
            }}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium transition-colors active:scale-95",
              active ? "text-foreground font-semibold" : "text-muted-foreground hover:text-secondary-foreground"
            )}
            aria-label={label}
            aria-current={active ? "page" : undefined}
          >
            <Icon
              className={cn(
                "h-5 w-5 transition-transform",
                active ? "text-primary" : "text-muted-foreground"
              )}
              strokeWidth={active ? 2.2 : 1.7}
            />
            <span
              className={cn(
                "truncate max-w-[64px]",
                active ? "font-semibold text-foreground" : ""
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
