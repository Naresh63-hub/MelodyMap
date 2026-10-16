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
      className="fixed z-40 flex lg:hidden items-stretch justify-around border-t border-hair-strong bg-surface w-full left-0 right-0 bottom-0 shadow-lg shadow-black/20"
      style={{
        height: "calc(var(--mobile-nav-height, 56px) + var(--mm-inset-bottom, 0px))",
        paddingBottom: "var(--mm-inset-bottom, 0px)",
      }}
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
              active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
            aria-label={label}
            aria-current={active ? "page" : undefined}
          >
            {active && (
              <div className="absolute inset-x-2 inset-y-1 rounded-xl bg-primary/15 border border-primary/30 -z-10 animate-fade-in" />
            )}
            <Icon
              className={cn(
                "h-5 w-5 transition-transform",
                active ? "text-primary scale-105" : "text-muted-foreground"
              )}
              strokeWidth={active ? 2.2 : 1.7}
            />
            <span
              className={cn(
                "truncate max-w-[64px]",
                active ? "font-semibold text-primary dark:text-white" : "text-muted-foreground"
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
