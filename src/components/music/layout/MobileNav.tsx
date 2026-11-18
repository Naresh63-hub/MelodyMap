import { Compass, Home, Library as LibraryIcon, Mic, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavTab } from "./Sidebar";
import { triggerHaptic } from "@/lib/haptics";

/** Mobile bottom navigation tabs (5 tabs: Home, Explore, Podcasts, Library, Profile) */
export const MOBILE_TABS: Array<{ id: NavTab; label: string; icon: typeof Home }> = [
  { id: "foryou", label: "Home", icon: Home },
  { id: "explore", label: "Explore", icon: Compass },
  { id: "podcasts", label: "Podcasts", icon: Mic },
  { id: "library", label: "Library", icon: LibraryIcon },
  { id: "profile", label: "Profile", icon: User },
];

type Props = {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  hasTrack: boolean;
};

export function MobileNav({ activeTab, onNavigate, hasTrack: _hasTrack }: Props) {
  const activeIdx = Math.max(0, MOBILE_TABS.findIndex((t) => t.id === activeTab));

  return (
    <div
      className="fixed z-40 flex lg:hidden items-center justify-center w-full px-3 left-0 right-0 pointer-events-none transition-all duration-300"
      style={{
        bottom: "calc(8px + var(--mm-inset-bottom, 0px))",
      }}
    >
      <nav
        className="relative flex items-center justify-around w-full max-w-lg h-14 rounded-2xl border border-purple-300/40 dark:border-purple-500/30 bg-surface/85 dark:bg-[#120a1f]/85 backdrop-blur-xl shadow-xl shadow-purple-900/10 dark:shadow-black/50 px-1 pointer-events-auto overflow-hidden select-none"
        aria-label="Mobile navigation"
      >
        {/* Sliding Purple Glow Indicator Capsule */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-xl bg-gradient-to-r from-purple-600/15 via-violet-500/25 to-pink-500/15 border border-purple-500/35 shadow-[0_0_12px_rgba(139,92,246,0.2)] transition-all duration-300 ease-out -z-0 pointer-events-none"
          style={{
            left: `calc(${activeIdx * 20}% + 4px)`,
            width: "calc(20% - 8px)",
          }}
        />

        {MOBILE_TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                onNavigate(id);
              }}
              className={cn(
                "relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-all duration-200 active:scale-95",
                active ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground",
              )}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform duration-200",
                  active ? "text-primary scale-110" : "text-muted-foreground",
                )}
                strokeWidth={active ? 2.3 : 1.7}
              />
              <span
                className={cn(
                  "truncate max-w-[64px] text-[10px] leading-tight",
                  active ? "font-bold text-primary dark:text-white" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
              {active && (
                <span className="h-1 w-1 rounded-full bg-primary animate-pulse -mt-0.5" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
