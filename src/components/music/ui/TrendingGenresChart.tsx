import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Cell,
} from "recharts";
import { TrendingUp, Flame, Activity, Sparkles, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/library";

interface Props {
  userHistory?: Track[];
  userLikes?: Track[];
  onSelectGenre?: (genre: string) => void;
  className?: string;
}

// Base genre definitions with baseline search volume metrics
const BASE_GENRES = [
  { genre: "Pop", baseVolume: 84000, trend: "+14%", color: "#1DB954" },
  { genre: "Bollywood", baseVolume: 79000, trend: "+22%", color: "#1ed760" },
  { genre: "Hip-Hop", baseVolume: 68000, trend: "+18%", color: "#10b981" },
  { genre: "Afrobeats", baseVolume: 61000, trend: "+31%", color: "#34d399" },
  { genre: "Lo-Fi", baseVolume: 53000, trend: "+8%", color: "#059669" },
  { genre: "Electronic", baseVolume: 47000, trend: "+12%", color: "#047857" },
  { genre: "Rock", baseVolume: 42000, trend: "+5%", color: "#065f46" },
  { genre: "R&B", baseVolume: 39000, trend: "+16%", color: "#10b981" },
  { genre: "Indie", baseVolume: 35000, trend: "+9%", color: "#1DB954" },
];

// Activity timeline data over peak listening hours
const HOURLY_SEARCH_ACTIVITY = [
  { time: "00:00", volume: 18200, pop: 6400, bollywood: 5800, lofi: 6000 },
  { time: "04:00", volume: 9400, pop: 3200, bollywood: 2200, lofi: 4000 },
  { time: "08:00", volume: 46000, pop: 18000, bollywood: 16000, lofi: 12000 },
  { time: "12:00", volume: 68000, pop: 27000, bollywood: 24000, lofi: 17000 },
  { time: "16:00", volume: 82000, pop: 33000, bollywood: 29000, lofi: 20000 },
  { time: "20:00", volume: 96000, pop: 39000, bollywood: 35000, lofi: 22000 },
  { time: "23:00", volume: 54000, pop: 20000, bollywood: 18000, lofi: 16000 },
];

export function TrendingGenresChart({
  userHistory = [],
  userLikes = [],
  onSelectGenre,
  className,
}: Props) {
  const [viewMode, setViewMode] = useState<"genres" | "volume">("genres");
  const [hoveredGenre, setHoveredGenre] = useState<string | null>(null);

  // Blend user activity patterns (history + likes) with baseline streaming trend weights
  const genreData = useMemo(() => {
    // Count user genre affinity based on track titles, artists, and history length
    const userGenreCounts: Record<string, number> = {};
    const allUserTracks = [...userHistory, ...userLikes];

    allUserTracks.forEach((t) => {
      const text = `${t.title} ${t.artist}`.toLowerCase();
      if (/hindi|telugu|tamil|punjabi|bollywood|arijit|shreya|anirudh|badshah/.test(text)) {
        userGenreCounts["Bollywood"] = (userGenreCounts["Bollywood"] || 0) + 1;
      }
      if (/pop|taylor|sheeran|dua|swift|billie|ariana/.test(text)) {
        userGenreCounts["Pop"] = (userGenreCounts["Pop"] || 0) + 1;
      }
      if (/hip|rap|drake|travis|kanye|eminem|kendrick/.test(text)) {
        userGenreCounts["Hip-Hop"] = (userGenreCounts["Hip-Hop"] || 0) + 1;
      }
      if (/lofi|lo-fi|chill|relax|study|beats/.test(text)) {
        userGenreCounts["Lo-Fi"] = (userGenreCounts["Lo-Fi"] || 0) + 1;
      }
      if (/afro|burna|wizkid|rema|tems/.test(text)) {
        userGenreCounts["Afrobeats"] = (userGenreCounts["Afrobeats"] || 0) + 1;
      }
      if (/rock|metal|queen|nirvana|linkin/.test(text)) {
        userGenreCounts["Rock"] = (userGenreCounts["Rock"] || 0) + 1;
      }
      if (/edm|electro|dance|calvin|avicii|tiesto/.test(text)) {
        userGenreCounts["Electronic"] = (userGenreCounts["Electronic"] || 0) + 1;
      }
      if (/r&b|rnb|weeknd|sza|frank/.test(text)) {
        userGenreCounts["R&B"] = (userGenreCounts["R&B"] || 0) + 1;
      }
    });

    return BASE_GENRES.map((g) => {
      const userBoost = (userGenreCounts[g.genre] || 0) * 1850;
      const totalVolume = g.baseVolume + userBoost;
      // Popularity score 0-100 normalized
      const popularity = Math.min(99, Math.round((totalVolume / 110000) * 100));

      return {
        genre: g.genre,
        searchVolume: totalVolume,
        popularity,
        trend: g.trend,
        userPlays: userGenreCounts[g.genre] || 0,
        color: g.color,
      };
    }).sort((a, b) => b.searchVolume - a.searchVolume);
  }, [userHistory, userLikes]);

  const topGenre = genreData[0]?.genre ?? "Pop";
  const totalSearches = useMemo(() => {
    return genreData.reduce((acc, curr) => acc + curr.searchVolume, 0);
  }, [genreData]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-[#121212]/80 backdrop-blur-xl p-4 sm:p-5 shadow-lg space-y-4",
        className,
      )}
    >
      {/* Header and Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[#1DB954]">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/90 leading-tight">
              Music Trends & Search Analytics
            </h2>
            <p className="text-[11px] text-neutral-400 font-normal leading-tight mt-0.5">
              Live genre search volumes & listener activity patterns
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center rounded-full bg-white/[0.04] p-0.5 border border-white/[0.06]">
          <button
            type="button"
            onClick={() => setViewMode("genres")}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-all",
              viewMode === "genres"
                ? "bg-[#1DB954] text-black shadow-sm font-semibold"
                : "text-neutral-400 hover:text-white",
            )}
          >
            Genre Ranking
          </button>
          <button
            type="button"
            onClick={() => setViewMode("volume")}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-all",
              viewMode === "volume"
                ? "bg-[#1DB954] text-black shadow-sm font-semibold"
                : "text-neutral-400 hover:text-white",
            )}
          >
            Volume Activity
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-1.5 text-neutral-400 text-[11px] font-normal">
            <Flame className="h-3 w-3 text-amber-400" />
            <span>#1 Trending</span>
          </div>
          <p className="text-sm font-semibold text-white/95 mt-1">{topGenre}</p>
        </div>

        <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-1.5 text-neutral-400 text-[11px] font-normal">
            <Activity className="h-3 w-3 text-[#1DB954]" />
            <span>Search Index</span>
          </div>
          <p className="text-sm font-semibold text-white/95 mt-1">
            {(totalSearches / 1000).toFixed(0)}k <span className="text-[10px] text-emerald-400 font-normal">pts</span>
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-1.5 text-neutral-400 text-[11px] font-normal">
            <Sparkles className="h-3 w-3 text-sky-400" />
            <span>Personalized</span>
          </div>
          <p className="text-sm font-semibold text-white/95 mt-1">
            {userHistory.length + userLikes.length > 0 ? "Active" : "Global"}
          </p>
        </div>
      </div>

      {/* Main Chart Visualization */}
      <div className="h-56 w-full pt-1">
        {viewMode === "genres" ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={genreData}
              margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              onClick={(e) => {
                const clickedGenre = e?.activeLabel;
                if (clickedGenre && onSelectGenre) {
                  onSelectGenre(clickedGenre);
                }
              }}
            >
              <defs>
                <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1DB954" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.45} />
                </linearGradient>
                <linearGradient id="highlightGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="genre"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
                interval={0}
                angle={-25}
                textAnchor="end"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#737373", fontSize: 10 }}
                tickFormatter={(val) => `${Math.round(val / 1000)}k`}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0]?.payload;
                    return (
                      <div className="rounded-lg border border-white/[0.08] bg-[#1a1a1a]/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md">
                        <p className="font-semibold text-white">{data.genre}</p>
                        <p className="text-neutral-300 mt-0.5">
                          Search Volume:{" "}
                          <span className="text-[#1DB954] font-medium">
                            {data.searchVolume.toLocaleString()}
                          </span>
                        </p>
                        <p className="text-neutral-400 text-[11px] mt-0.5">
                          Velocity: <span className="text-emerald-400">{data.trend}</span>
                          {data.userPlays > 0 && ` • ${data.userPlays} recent plays`}
                        </p>
                        <p className="text-[10px] text-white/40 mt-1 italic">Click bar to search genre</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="searchVolume"
                radius={[4, 4, 0, 0]}
                className="cursor-pointer"
                onMouseEnter={(data) => setHoveredGenre(data.genre)}
                onMouseLeave={() => setHoveredGenre(null)}
              >
                {genreData.map((entry) => (
                  <Cell
                    key={entry.genre}
                    fill={hoveredGenre === entry.genre ? "url(#highlightGradient)" : "url(#emeraldGradient)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={HOURLY_SEARCH_ACTIVITY} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1DB954" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#1DB954" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: "#a3a3a3", fontSize: 11 }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#737373", fontSize: 10 }}
                tickFormatter={(val) => `${Math.round(val / 1000)}k`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0]?.payload;
                    return (
                      <div className="rounded-lg border border-white/[0.08] bg-[#1a1a1a]/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md">
                        <p className="font-semibold text-white">{data.time}</p>
                        <p className="text-[#1DB954] mt-0.5">
                          Activity Index: <span className="font-medium">{data.volume.toLocaleString()}</span>
                        </p>
                        <p className="text-neutral-400 text-[11px] mt-0.5">
                          Peak streaming & search discovery period
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke="#1DB954"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#areaVolumeGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Quick Clickable Genre Tags */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[11px] text-neutral-400 flex items-center gap-1 mr-1">
          <Music className="h-3 w-3" /> Quick Explore:
        </span>
        {genreData.slice(0, 6).map((g) => (
          <button
            key={g.genre}
            type="button"
            onClick={() => onSelectGenre?.(g.genre)}
            className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] font-normal text-neutral-300 hover:text-white hover:bg-white/[0.08] hover:border-emerald-500/30 transition-all active:scale-95"
          >
            {g.genre} <span className="text-[10px] text-emerald-400/90 font-mono ml-0.5">{g.trend}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
