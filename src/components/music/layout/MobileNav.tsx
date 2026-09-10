import { Home, Globe2, Mic, ListMusic, Library as LibraryIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavTab } from "./Sidebar";

/** Mobile bottom navigation tabs matching Violet/Brinjal design. */
export const MOBILE_TABS: Array<{ id: NavTab; label: string; icon: typeof Home }> = [
  { id: "foryou", label: "Home", icon: Home },
  { id: "search", label: "Search", icon: Search },
  { id: "podcasts", label: "Podcasts", icon: Mic },
  { id: "playlists", label: "Playlists", icon: ListMusic },
  { id: "library", label: "Library", icon: LibraryIcon },
];

type Props = {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  hasTrack: boolean;
};

export function MobileNav({ activeTab, onNavigate, hasTrack }: Props) {
  return (
    <nav
      className="fixed z-40 flex items-stretch justify-around border-t border-purple-500/20 bg-[#0b0813]/95 backdrop-blur-2xl safe-bottom max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl mx-auto left-0 right-0 bottom-0"
      style={{ height: "var(--mobile-nav-height, 56px)" }}
      aria-label="Mobile navigation"
    >
      {MOBILE_TABS.map(({ id, label, icon: Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-all duration-200 active:scale-95",
              active ? "text-purple-300" : "text-white/40 hover:text-white/70"
            )}
            aria-label={label}
            aria-current={active ? "page" : undefined}
          >
            <Icon
              className={cn(
                "h-5 w-5 transition-all duration-200",
                active
                  ? "scale-110 text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.7)]"
                  : "text-white/40"
              )}
              strokeWidth={active ? 2.4 : 1.8}
            />
            <span
              className={cn(
                "truncate max-w-[64px]",
                active ? "font-bold text-white" : ""
              )}
            >
              {label}
            </span>
            {active && (
              <span className="absolute bottom-1 h-[3px] w-6 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 shadow-[0_0_10px_rgba(168,85,247,0.9)]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
