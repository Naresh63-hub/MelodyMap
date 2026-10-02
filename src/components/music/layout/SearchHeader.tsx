import { Bell, Cast, Loader2, Mic, Search, Settings2 } from "lucide-react";
import { AccountMenu } from "@/components/music/AccountMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Profile } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavTab } from "./Sidebar";

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  suggestions: string[];
  showSuggestions: boolean;
  onShowSuggestions: (show: boolean) => void;
  onSearch: (e: React.FormEvent) => void;
  onSuggestionClick: (s: string) => void;
  searching: boolean;
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  onUpdateProfile: (patch: { display_name?: string; avatar_url?: string }) => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenSettings?: () => void;
};

export function SearchHeader({
  query,
  onQueryChange,
  suggestions,
  showSuggestions,
  onShowSuggestions,
  onSearch,
  onSuggestionClick,
  searching,
  activeTab,
  onNavigate,
  userId,
  email,
  profile,
  onUpdateProfile,
  onSignOut,
  onOpenSettings,
}: Props) {
  const recentSearches = (() => {
    try {
      const raw = localStorage.getItem("melodymap.recentSearches.v1");
      return raw ? (JSON.parse(raw) as string[]).slice(0, 5) : [];
    } catch {
      return [];
    }
  })();

  return (
    <header className="relative z-20 shrink-0 px-4 pt-4 sm:px-6">
      <div className="mx-auto flex w-full items-center gap-2 sm:gap-3">
        {/* Mobile brand */}
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <img src="/brand/app-icon.png" alt="MelodyMap" className="h-8 w-8 rounded-lg object-cover shadow-sm" />
          <span className="font-display text-base font-bold">
            <span className="text-white">Melody</span>
            <span className="text-[#1DB954]">Map</span>
          </span>
        </div>

        {/* Search */}
        <form onSubmit={onSearch} className="relative flex min-w-0 flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              id="main-search-input"
              value={query}
              onChange={(e) => {
                onQueryChange(e.target.value);
                onShowSuggestions(true);
              }}
              onFocus={() => onShowSuggestions(true)}
              onBlur={() => window.setTimeout(() => onShowSuggestions(false), 180)}
              placeholder="Search songs, artists, albums, playlists... (/ to focus)"
              className="h-10 rounded-full border border-white/[0.06] bg-[#161616] pl-10 pr-16 text-sm text-[#F5F5F5] placeholder:text-[#737373] focus:border-white/20 focus:ring-1 focus:ring-white/10"
              autoComplete="off"
            />
            {searching && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
                <Loader2 className="h-4 w-4 animate-spin text-[#1DB954]" />
              </div>
            )}
            <button
              type="button"
              aria-label="Voice search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[#737373] transition-colors hover:bg-white/10 hover:text-[#F5F5F5]"
              onClick={() => {
                const w = window as unknown as Record<string, unknown>;
                if ("webkitSpeechRecognition" in w || "SpeechRecognition" in (w as Record<string, unknown>)) {
                  const SR = (w["webkitSpeechRecognition"] ?? w["SpeechRecognition"]) as (new () => { onresult: ((ev: unknown) => void) | null; start: () => void }) | undefined;
                  if (!SR) return;
                  const rec = new SR();
                  rec.onresult = (ev: unknown) => {
                    const result = (ev as { results?: Array<Array<{ transcript?: string }>> }).results?.[0]?.[0]?.transcript;
                    if (result) {
                      onQueryChange(result);
                      onSuggestionClick(result);
                    }
                  };
                  rec.start();
                }
              }}
            >
              <Mic className="h-4 w-4" />
            </button>

            {showSuggestions && (suggestions.length > 0 || recentSearches.length > 0) && (
              <ul className="absolute inset-x-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-xl border border-white/[0.06] bg-[#161616] shadow-2xl backdrop-blur-xl animate-scale-in">
                {recentSearches.length > 0 && query.trim().length < 2 && (
                  <>
                    <li className="px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-[#737373]">
                      Recent searches
                    </li>
                    {recentSearches.map((s) => (
                      <li key={`recent-${s}`}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => onSuggestionClick(s)}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#A1A1A1] transition-colors hover:bg-white/[0.04] hover:text-[#F5F5F5]"
                        >
                          <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
                          <span className="truncate">{s}</span>
                        </button>
                      </li>
                    ))}
                  </>
                )}
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onSuggestionClick(s)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#A1A1A1] transition-colors hover:bg-white/[0.04] hover:text-[#F5F5F5]"
                    >
                      <Search className="h-3.5 w-3.5 shrink-0 text-[#737373]" />
                      <span className="truncate">{s}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            className="hidden h-10 shrink-0 rounded-full bg-[#F5F5F5] hover:bg-white text-black px-5 font-medium transition-colors sm:flex"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : "Search"}
          </Button>
        </form>

        {/* Right controls */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            aria-label="Cast to device"
            className="hidden h-9 w-9 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/5 hover:text-white/70 sm:flex"
          >
            <Cast className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Notifications"
            className="relative hidden h-9 w-9 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/5 hover:text-white/70 sm:flex"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#1DB954]" />
          </button>
          {onOpenSettings && (
            <button
              type="button"
              aria-label="Settings"
              onClick={onOpenSettings}
              className="hidden h-9 w-9 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/5 hover:text-white/70 sm:flex"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          )}
          <AccountMenu
            userId={userId}
            email={email}
            profile={profile}
            onUpdateProfile={onUpdateProfile}
            onSignOut={onSignOut}
          />
        </div>
      </div>

      {/* Mobile nav tabs */}
      <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-3 scrollbar-hide lg:hidden md:hidden">
        {NAV_ITEMS.filter((t) => t.id !== "search").map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-colors",
              activeTab === id
                ? "bg-[#F5F5F5] text-black font-medium border-transparent shadow-sm"
                : "border-white/[0.06] bg-transparent text-[#A1A1A1] hover:text-[#F5F5F5] hover:bg-white/[0.04]",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
