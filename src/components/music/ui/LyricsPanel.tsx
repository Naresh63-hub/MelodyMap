import { useState, useEffect, useRef, useMemo } from "react";
import { MessageSquare, X, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTrackLyrics } from "@/lib/music.functions";

type LyricLine = {
  time: number; // in seconds
  text: string;
};

type Props = {
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  currentTime: number;
  isPlaying: boolean;
  onSeek?: (timeSeconds: number) => void;
  onClose: () => void;
};

export function LyricsPanel({
  trackId,
  trackTitle,
  trackArtist,
  currentTime,
  isPlaying,
  onSeek,
  onClose,
}: Props) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);

  // Fetch real lyrics on track change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLyrics([]);
    setPlainLyrics(null);

    void getTrackLyrics({
      data: {
        title: trackTitle,
        artist: trackArtist,
      },
    })
      .then((res) => {
        if (cancelled) return;
        if (res.lyrics) {
          if (res.lyrics.synced && res.lyrics.synced.length > 0) {
            setLyrics(res.lyrics.synced);
          } else if (res.lyrics.plain) {
            setPlainLyrics(res.lyrics.plain);
            // Break plain lyrics into readable non-timed chunks
            const lines = res.lyrics.plain
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              .map((text, i) => ({ time: i * 4, text }));
            setLyrics(lines);
          } else if (res.lyrics.instrumental) {
            setLyrics([{ time: 0, text: "♪ Instrumental Track ♪" }]);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [trackTitle, trackArtist, trackId]);

  // Find current line based on time
  useEffect(() => {
    let newIndex = -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      const line = lyrics[i];
      if (line && currentTime >= line.time) {
        newIndex = i;
        break;
      }
    }
    if (newIndex !== -1 && newIndex !== currentLineIndex) {
      setCurrentLineIndex(newIndex);
    }
  }, [currentTime, lyrics, currentLineIndex]);

  const userScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUserScroll = () => {
    userScrollingRef.current = true;
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 3500);
  };

  // Auto-scroll to current line using requestAnimationFrame for smoothness
  useEffect(() => {
    if (userScrollingRef.current) return;
    if (lineRefs.current[currentLineIndex] && containerRef.current) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const container = containerRef.current;
        const line = lineRefs.current[currentLineIndex];
        if (!container || !line || userScrollingRef.current) return;
        const containerHeight = container.clientHeight;
        const lineTop = line.offsetTop;
        const lineHeight = line.clientHeight;
        container.scrollTo({
          top: lineTop - containerHeight / 2 + lineHeight / 2,
          behavior: "smooth",
        });
        rafRef.current = null;
      });
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [currentLineIndex]);

  const filteredLyrics = useMemo(
    () =>
      searchQuery
        ? lyrics.filter((line) =>
            line.text.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : lyrics,
    [lyrics, searchQuery],
  );

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#0a0a18]/95 backdrop-blur-xl border-l border-white/5 shadow-2xl animate-slide-up sm:max-w-sm md:max-w-md" role="dialog" aria-label="Lyrics panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 p-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-pink-400 icon-glow" />
          <div>
            <h3 className="font-semibold text-white">Lyrics</h3>
            <p className="text-xs text-white/40 truncate max-w-[200px]">
              {trackTitle} · {trackArtist}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close lyrics"
          className="h-8 w-8 text-white/60 hover:text-white button-press"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lyrics..."
            className="pl-9 bg-white/[0.04] border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50"
          />
        </div>
      </div>

      {/* Lyrics content */}
      <div
        ref={containerRef}
        onScroll={handleUserScroll}
        onTouchStart={handleUserScroll}
        onWheel={handleUserScroll}
        className="flex-1 overflow-y-auto p-4 scrollbar-premium"
        style={{ height: "calc(100% - 140px)" }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
            <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
            <p className="text-xs text-white/50">Fetching synchronized lyrics...</p>
          </div>
        ) : filteredLyrics.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-12 w-12 text-white/20 mb-3" />
            <p className="text-sm text-white/40">
              {searchQuery
                ? "No lyrics found matching your search"
                : "Lyrics not available for this track"}
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-8">
            {filteredLyrics.map((line, index) => {
              const actualIndex = lyrics.indexOf(line);
              const isActive = actualIndex === currentLineIndex;
              return (
                <button
                  key={`${line.time}-${index}`}
                  type="button"
                  ref={(el) => {
                    lineRefs.current[actualIndex] = el;
                  }}
                  onClick={() => onSeek?.(line.time)}
                  className={cn(
                    "w-full text-center transition-all duration-300 py-2.5 px-4 rounded-xl cursor-pointer select-none",
                    isActive
                      ? "text-white font-bold text-lg scale-105 bg-gradient-to-r from-pink-500/15 via-purple-500/20 to-cyan-500/10 border border-purple-500/30 shadow-[0_0_25px_rgba(168,85,247,0.25)]"
                      : "text-white/40 text-sm hover:text-white/80 hover:bg-white/[0.04]",
                  )}
                >
                  {line.text}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="border-t border-white/5 p-3 text-center">
        <p className="text-[10px] text-white/30">
          {loading
            ? "Loading..."
            : isPlaying
              ? "♪ Synced with playback · Tap line to jump ♪"
              : "Paused · Tap line to jump"}
        </p>
      </div>
    </div>
  );
}