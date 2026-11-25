import { useState, useMemo } from "react";
import {
  BookOpen,
  Search,
  Star,
  Play,
  Globe2,
  Sparkles,
  Flame,
  Shield,
  Smile,
  Award,
} from "lucide-react";
import {
  MASTER_STORIES_CATALOG,
  getStoriesCatalog,
  getStoryLanguageCounts,
} from "@/lib/stories/stories-catalog";
import type { StorySeries, StoryCategory, StoryLanguage, StoryChapter } from "@/lib/stories/story.types";
import { StorySeriesModal } from "./StorySeriesModal";

interface Props {
  currentTrackId?: string | undefined;
  isPlaying?: boolean | undefined;
  onPlayChapter: (chapter: StoryChapter, series: StorySeries) => void;
}

const CATEGORIES: { id: StoryCategory | "all"; label: string; icon: typeof Sparkles }[] = [
  { id: "all", label: "All Stories", icon: Sparkles },
  { id: "thriller", label: "🔥 Thriller & Suspense", icon: Flame },
  { id: "audiobooks", label: "💡 Audiobooks & Growth", icon: Award },
  { id: "epics", label: "🕉️ Epics & Mythology", icon: Sparkles },
  { id: "warriors", label: "⚔️ Great Warriors", icon: Shield },
  { id: "kids", label: "🧸 Kids & Bedtime", icon: Smile },
  { id: "biographies", label: "👑 Biographies", icon: BookOpen },
];

const LANGUAGES: StoryLanguage[] = ["All", "Telugu", "Hindi", "English"];

const LANGUAGE_CARDS: {
  lang: "Telugu" | "Hindi" | "English";
  title: string;
  nativeTitle: string;
  description: string;
  gradient: string;
}[] = [
  {
    lang: "Telugu",
    title: "Telugu Stories & Audiobooks",
    nativeTitle: "తెలుగు కథలు & ఆడియో బుక్స్",
    description: "యండమూరి క్రైమ్ థ్రిల్లర్స్, చాగంటి రామాయణం, బేతాళ & చందమామ కథలు",
    gradient: "from-amber-600/30 via-orange-600/20 to-purple-900/40 border-amber-500/30",
  },
  {
    lang: "Hindi",
    title: "Hindi Thrillers & Kahaniyaan",
    nativeTitle: "हिंदी कहानियां & ऑडियोबुक्स",
    description: "हॉरर नाइट्स, शिवाजी महाराज, विक्रम बेताल, अकबर बीरबल और बुक समरी",
    gradient: "from-rose-600/30 via-red-600/20 to-indigo-900/40 border-rose-500/30",
  },
  {
    lang: "English",
    title: "English Audio Dramas",
    nativeTitle: "Classic Dramas & Epics",
    description: "The Stories of Mahabharata drama, Swami Vivekananda philosophy",
    gradient: "from-indigo-600/30 via-violet-600/20 to-purple-900/40 border-indigo-500/30",
  },
];

export function StoriesSection({ currentTrackId, isPlaying = false, onPlayChapter }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<StoryCategory | "all">("all");
  const [selectedLanguage, setSelectedLanguage] = useState<StoryLanguage>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSeries, setActiveSeries] = useState<StorySeries | null>(null);

  const languageCounts = useMemo(() => getStoryLanguageCounts(), []);

  const filteredStories = useMemo(() => {
    return getStoriesCatalog({
      category: selectedCategory,
      language: selectedLanguage,
      query: searchQuery,
    });
  }, [selectedCategory, selectedLanguage, searchQuery]);

  // Featured story for hero banner (prioritizes featured series)
  const featuredStory = useMemo(() => {
    return (
      filteredStories.find((s) => s.featured) ||
      MASTER_STORIES_CATALOG.find((s) => s.featured) ||
      MASTER_STORIES_CATALOG[0]!
    );
  }, [filteredStories]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Hero Featured Story Banner */}
      {featuredStory && !searchQuery && selectedCategory === "all" && (
        <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-[#E5DDF5] dark:border-white/10 bg-gradient-to-br from-[#2D1B69] via-[#1E1145] to-[#120A2E] text-white p-6 sm:p-10">
          {/* Ambient Image Background */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none blur-3xl scale-125"
            style={{
              backgroundImage: `url(${featuredStory.coverUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />

          <div className="relative z-10 flex flex-col md:flex-row gap-6 md:gap-10 items-center justify-between">
            <div className="space-y-3 max-w-xl text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-[#A78BFA]">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="font-bold text-white tracking-wide">Melody Stories</span>
                <span className="text-white/40">•</span>
                <span>Audio Drama Theatre</span>
                <span className="text-white/40">•</span>
                <span>{featuredStory.language}</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                {featuredStory.title}
              </h1>

              <p className="text-xs sm:text-sm text-white/80 line-clamp-3 leading-relaxed">
                {featuredStory.description}
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-1 text-xs text-white/70">
                <span className="flex items-center gap-1 font-bold text-amber-400">
                  <Star className="h-4 w-4 fill-amber-400" />
                  {featuredStory.rating.toFixed(2)}
                </span>
                <span>•</span>
                <span>Narrated by {featuredStory.narrator}</span>
                <span>•</span>
                <span>{featuredStory.totalChapters} Episodes</span>
              </div>

              <div className="pt-3 flex items-center justify-center md:justify-start gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSeries(featuredStory)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white text-sm font-bold shadow-lg shadow-[#8B5CF6]/40 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-white" />
                  <span>Start Listening</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSeries(featuredStory)}
                  className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm font-semibold border border-white/20 transition-all cursor-pointer"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>View Chapters</span>
                </button>
              </div>
            </div>

            <div
              onClick={() => setActiveSeries(featuredStory)}
              className="relative w-44 h-60 sm:w-56 sm:h-76 shrink-0 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 cursor-pointer group hover:scale-105 transition-all"
            >
              <img
                src={featuredStory.coverUrl}
                alt={featuredStory.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                <span className="text-xs font-bold text-white drop-shadow">
                  Tap to open chapters →
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section Branding & Control Bar */}
      <div className="space-y-3">
        {(!featuredStory || searchQuery || selectedCategory !== "all") && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/25">
              <BookOpen className="h-3 w-3" />
              Melody Stories
            </span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#746A85] dark:text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search thrillers, crime, epics, audiobooks, or authors..."
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white dark:bg-card border border-[#E5DDF5] dark:border-hair text-xs sm:text-sm text-[#211536] dark:text-foreground placeholder-[#746A85] dark:placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] transition-all"
          />
        </div>

        {/* Language Filter Pills with Badge Counts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <Globe2 className="h-4 w-4 text-[#746A85] dark:text-muted-foreground shrink-0 mr-1" />
          {LANGUAGES.map((lang) => {
            const count = languageCounts[lang];
            const isSelected = selectedLanguage === lang;

            return (
              <button
                key={lang}
                type="button"
                onClick={() => setSelectedLanguage(lang)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#8B5CF6] text-white shadow-sm"
                    : "bg-white dark:bg-card border border-[#E5DDF5] dark:border-hair text-[#746A85] dark:text-muted-foreground hover:bg-[#F1EBFF] dark:hover:bg-chip hover:text-[#211536] dark:hover:text-foreground"
                }`}
              >
                <span>{lang}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? "bg-white/20 text-white" : "bg-chip text-foreground/60"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      </div>

      {/* Language Quick Browse Cards (Visible when browsing All and no active search) */}
      {selectedLanguage === "All" && !searchQuery && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
          {LANGUAGE_CARDS.map((card) => {
            const count = languageCounts[card.lang];
            return (
              <div
                key={card.lang}
                onClick={() => setSelectedLanguage(card.lang)}
                className={`group p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${card.gradient} border backdrop-blur-sm cursor-pointer hover:scale-[1.02] active:scale-[0.99] transition-all relative overflow-hidden`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                      {card.nativeTitle}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                      {card.title}
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-card/80 text-[11px] font-bold text-foreground/80 border border-hair shrink-0">
                    {count} Series
                  </span>
                </div>
                <p className="mt-2 text-xs text-foreground/70 line-clamp-2 leading-relaxed">
                  {card.description}
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary">
                  <span>Explore {card.lang} Stories</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? "bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-md shadow-[#8B5CF6]/30"
                  : "bg-white dark:bg-card border border-[#E5DDF5] dark:border-hair text-[#746A85] dark:text-muted-foreground hover:bg-[#F1EBFF] dark:hover:bg-chip hover:text-[#211536] dark:hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Stories Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#211536] dark:text-foreground flex items-center gap-2">
            <span>
              {selectedCategory === "all"
                ? selectedLanguage === "All"
                  ? "All Curated Audio Stories & Books"
                  : `${selectedLanguage} Stories & Audiobooks`
                : CATEGORIES.find((c) => c.id === selectedCategory)?.label || "Stories"}
            </span>
          </h2>
          <span className="text-xs text-[#746A85] dark:text-muted-foreground">
            {filteredStories.length} series available
          </span>
        </div>

        {filteredStories.length === 0 ? (
          <div className="text-center py-12 space-y-3 rounded-2xl bg-white/40 dark:bg-card/40 border border-[#E5DDF5] dark:border-hair">
            <BookOpen className="h-10 w-10 text-[#746A85] dark:text-muted-foreground mx-auto" />
            <h3 className="text-base font-semibold text-[#211536] dark:text-foreground">
              No stories match your filters
            </h3>
            <p className="text-xs text-[#746A85] dark:text-muted-foreground max-w-md mx-auto">
              Try switching your language or category filter to discover other audio dramas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredStories.map((series) => (
              <div
                key={series.id}
                onClick={() => setActiveSeries(series)}
                className="group flex flex-col rounded-2xl bg-white dark:bg-card border border-[#E5DDF5] dark:border-hair overflow-hidden shadow-sm hover:shadow-xl hover:border-[#8B5CF6]/50 transition-all cursor-pointer"
              >
                {/* Poster Cover */}
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
                  <img
                    src={series.coverUrl}
                    alt={series.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  {/* Language Chip */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold text-white flex items-center gap-1">
                    <Globe2 className="h-3 w-3 text-[#A78BFA]" />
                    <span>{series.language}</span>
                  </div>

                  {/* Rating Chip */}
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold text-amber-400 flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400" />
                    <span>{series.rating.toFixed(1)}</span>
                  </div>

                  {/* Play Overlay Button */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="h-12 w-12 rounded-full bg-[#8B5CF6] text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 active:scale-95 transition-transform">
                      <Play className="h-5 w-5 fill-white ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Series Info */}
                <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8B5CF6]">
                      {series.category.toUpperCase()}
                    </span>
                    <h3 className="text-sm font-bold text-[#211536] dark:text-foreground line-clamp-2 leading-snug group-hover:text-[#8B5CF6] transition-colors">
                      {series.title}
                    </h3>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-[#746A85] dark:text-muted-foreground line-clamp-1">
                      {series.narrator}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-[#746A85] dark:text-muted-foreground pt-1 border-t border-[#E5DDF5] dark:border-hair">
                      <span>{series.totalChapters} episodes</span>
                      <span className="text-[#8B5CF6] font-medium">Listen →</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Series Detail & Chapter Modal */}
      <StorySeriesModal
        series={activeSeries}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        onClose={() => setActiveSeries(null)}
        onPlayChapter={onPlayChapter}
      />
    </div>
  );
}
