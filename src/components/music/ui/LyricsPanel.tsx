import { useState, useEffect, useRef, useMemo } from "react";
import { MessageSquare, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  onClose: () => void;
};

// Placeholder lyrics — in production, replace with a real lyrics API.
// Shows "Lyrics not available" for unknown tracks instead of mock data.
const PLACEHOLDER_LYRICS: LyricLine[] = [
  { time: 0, text: "♪ Instrumental ♪" },
];

export function LyricsPanel({
  trackId,
  trackTitle,
  trackArtist,
  currentTime,
  isPlaying,
  onClose,
}: Props) {
  const [lyrics] = useState<LyricLine[]>(PLACEHOLDER_LYRICS);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);

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

  // Auto-scroll to current line using requestAnimationFrame for smoothness
  useEffect(() => {
    if (lineRefs.current[currentLineIndex] && containerRef.current) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const container = containerRef.current;
        const line = lineRefs.current[currentLineIndex];
        if (!container || !line) return;
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
        className="flex-1 overflow-y-auto p-4 scrollbar-premium"
        style={{ height: "calc(100% - 140px)" }}
      >
        {filteredLyrics.length === 0 ? (
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
                <div
                  key={`${line.time}-${index}`}
                  ref={(el) => { lineRefs.current[actualIndex] = el; }}
                  className={cn(
                    "text-center transition-all duration-300 py-2 px-4 rounded-lg",
                    isActive
                      ? "text-white font-semibold text-lg scale-105 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/5 border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                      : "text-white/50 text-base hover:text-white/70 hover:bg-white/[0.02]",
                  )}
                >
                  {line.text}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="border-t border-white/5 p-3 text-center">
        <p className="text-[10px] text-white/30">
          {isPlaying ? "♪ Syncing with playback ♪" : "Paused - lyrics ready"}
        </p>
      </div>
    </div>
  );
}