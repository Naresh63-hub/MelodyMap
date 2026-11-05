import { useState, useEffect, useRef, useMemo } from "react";
import { MessageSquare, X, Search, Loader2, Copy, Check, Music2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTrackLyrics, findActiveLyricIndex } from "@/lib/use-track-lyrics";

type Props = {
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  trackDuration?: number;
  currentTime: number;
  isPlaying: boolean;
  onSeek?: (timeSeconds: number) => void;
  onClose: () => void;
};

export function LyricsPanel({
  trackId,
  trackTitle,
  trackArtist,
  trackDuration,
  currentTime,
  isPlaying,
  onSeek,
  onClose,
}: Props) {
  const {
    loading,
    syncedLyrics,
    plainLyrics,
    isSynced,
    isInstrumental,
    source,
  } = useTrackLyrics({
    title: trackTitle,
    artist: trackArtist,
    trackId,
    duration: trackDuration,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const userScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Find active line in synced lyrics based on audio currentTime
  useEffect(() => {
    if (!isSynced || syncedLyrics.length === 0) return;
    const newIndex = findActiveLyricIndex(syncedLyrics, currentTime);
    if (newIndex !== -1 && newIndex !== currentLineIndex) {
      setCurrentLineIndex(newIndex);
    }
  }, [currentTime, syncedLyrics, currentLineIndex, isSynced]);

  const handleUserScroll = () => {
    userScrollingRef.current = true;
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 3500);
  };

  // Auto-scroll to active line smoothly
  useEffect(() => {
    if (!isSynced || userScrollingRef.current) return;
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
          top: Math.max(0, lineTop - containerHeight / 2 + lineHeight / 2),
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
  }, [currentLineIndex, isSynced]);

  // Copy lyrics to clipboard
  const handleCopy = async () => {
    let fullText = "";
    if (plainLyrics) {
      fullText = plainLyrics;
    } else if (syncedLyrics.length > 0) {
      fullText = syncedLyrics.map((l) => l.text).join("\n");
    }

    if (!fullText) return;
    const shareText = `"${trackTitle}" — ${trackArtist}\n\n${fullText}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // ignore
    }
  };

  // Filter lyrics by search query
  const filteredSynced = useMemo(() => {
    if (!searchQuery) return syncedLyrics;
    return syncedLyrics.filter((line) =>
      line.text.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [syncedLyrics, searchQuery]);

  const plainParagraphs = useMemo(() => {
    if (!plainLyrics) return [];
    return plainLyrics.split(/\n\s*\n/).map((para) => para.split("\n"));
  }, [plainLyrics]);

  const filteredPlainParagraphs = useMemo(() => {
    if (!searchQuery) return plainParagraphs;
    return plainParagraphs
      .map((para) =>
        para.filter((line) => line.toLowerCase().includes(searchQuery.toLowerCase())),
      )
      .filter((para) => para.length > 0);
  }, [plainParagraphs, searchQuery]);

  const hasAnyLyrics =
    isInstrumental || syncedLyrics.length > 0 || Boolean(plainLyrics && plainLyrics.trim());

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#FAF8FF] dark:bg-[#130d22]/95 text-[#211536] dark:text-white backdrop-blur-xl border-l border-[#E5DDF5] dark:border-hair shadow-2xl animate-slide-up sm:max-w-sm md:max-w-md flex flex-col overflow-hidden transition-colors duration-200"
      role="dialog"
      aria-label="Lyrics panel"
    >
      {/* Header with Android Safe Area Protection (positioned completely below status bar) */}
      <div
        className="flex items-center justify-between border-b border-[#E5DDF5] dark:border-hair px-4 pb-3.5 shrink-0 bg-white dark:bg-[#171128] transition-colors"
        style={{
          paddingTop: "max(calc(var(--mm-inset-top, 0px) + 0.875rem), 2.5rem)",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F1EBFF] dark:bg-pink-500/15 border border-[#E5DDF5] dark:border-pink-500/25">
            <MessageSquare className="h-4.5 w-4.5 text-[#8B5CF6] dark:text-pink-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[#211536] dark:text-foreground text-sm">Lyrics</h3>
              {source && (
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-[#F1EBFF] dark:bg-chip text-[#8B5CF6] dark:text-muted-foreground border border-[#E5DDF5] dark:border-hair">
                  {isSynced ? "Synced" : "Plain"} · {source}
                </span>
              )}
            </div>
            <p className="text-xs text-[#746A85] dark:text-muted-foreground truncate max-w-[210px] mt-0.5">
              {trackTitle} · {trackArtist}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {hasAnyLyrics && !isInstrumental && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              aria-label="Copy lyrics"
              title="Copy lyrics to clipboard"
              className="h-8 w-8 text-[#746A85] dark:text-foreground/60 hover:text-[#211536] dark:hover:text-foreground hover:bg-[#F1EBFF] dark:hover:bg-chip rounded-full transition-colors cursor-pointer"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close lyrics"
            className="h-8 w-8 text-[#746A85] dark:text-foreground/60 hover:text-[#211536] dark:hover:text-foreground hover:bg-[#F1EBFF] dark:hover:bg-chip rounded-full transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Rounded Search Bar (Starts Below Header) */}
      {!isInstrumental && (
        <div className="p-3 border-b border-[#E5DDF5] dark:border-hair shrink-0 bg-[#FAF8FF] dark:bg-transparent">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#746A85] dark:text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in lyrics..."
              className="pl-9 h-9 text-xs rounded-full bg-[#F1EBFF] dark:bg-chip border-[#E5DDF5] dark:border-hair text-[#211536] dark:text-foreground placeholder:text-[#746A85] dark:placeholder:text-muted-foreground focus:ring-1 focus:ring-[#8B5CF6] focus:border-[#8B5CF6]"
            />
          </div>
        </div>
      )}

      {/* Lyrics Content Container with Premium Scrollbar */}
      <div
        ref={containerRef}
        onScroll={handleUserScroll}
        onTouchStart={handleUserScroll}
        onWheel={handleUserScroll}
        className="flex-1 overflow-y-auto p-5 scrollbar-premium"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-16">
            <Loader2 className="h-8 w-8 text-[#8B5CF6] dark:text-primary animate-spin" />
            <p className="text-xs text-[#746A85] dark:text-muted-foreground">Finding synchronized lyrics...</p>
          </div>
        ) : isInstrumental ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-[#8B5CF6] dark:text-primary">
              <Music2 className="h-7 w-7" />
            </div>
            <h4 className="font-semibold text-[#211536] dark:text-foreground text-base">Instrumental Song</h4>
            <p className="text-xs text-[#746A85] dark:text-muted-foreground max-w-[240px]">
              This track is recorded without vocals. Enjoy the pure instrumentation!
            </p>
          </div>
        ) : !hasAnyLyrics ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1EBFF] dark:bg-chip border border-[#E5DDF5] dark:border-hair text-[#746A85] dark:text-muted-foreground">
              <MessageSquare className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-[#211536]/70 dark:text-foreground/60">
              {searchQuery ? "No lyrics found matching search" : "Lyrics not available for this track"}
            </p>
            <p className="text-xs text-[#746A85] dark:text-muted-foreground max-w-[220px]">
              We search LRCLIB and JioSaavn catalogs for live lyrics.
            </p>
          </div>
        ) : isSynced ? (
          /* Synchronized Karaoke-Style Lyrics */
          <div className="space-y-4 py-8">
            {filteredSynced.map((line, index) => {
              const actualIndex = syncedLyrics.indexOf(line);
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
                    "w-full text-left transition-all duration-300 py-2.5 px-4 rounded-xl cursor-pointer select-none",
                    isActive
                      ? "text-white font-semibold text-base sm:text-lg bg-[#8B5CF6] border border-[#A78BFA] shadow-md shadow-purple-500/25 scale-[1.02]"
                      : "text-[#746A85] dark:text-muted-foreground text-sm hover:text-[#211536] dark:hover:text-foreground/80 hover:bg-[#F1EBFF] dark:hover:bg-chip/50",
                  )}
                >
                  <p className="leading-relaxed font-sans break-words tracking-normal">{line.text}</p>
                </button>
              );
            })}
          </div>
        ) : (
          /* Plain Text Stanza Lyrics (e.g. JioSaavn or un-timed LRCLIB) */
          <div className="space-y-6 py-6 px-1">
            <div className="flex items-center gap-1.5 text-xs text-[#746A85] dark:text-muted-foreground font-medium pb-2 border-b border-[#E5DDF5] dark:border-hair">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Full Song Lyrics</span>
            </div>
            {filteredPlainParagraphs.map((para, pIdx) => (
              <div key={pIdx} className="space-y-2">
                {para.map((line, lIdx) => (
                  <p
                    key={lIdx}
                    className="text-sm sm:text-base text-[#211536]/90 dark:text-foreground/90 font-sans font-normal leading-relaxed break-words tracking-normal select-text"
                  >
                    {line}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="border-t border-[#E5DDF5] dark:border-hair p-3 text-center shrink-0 bg-white/80 dark:bg-surface/60">
        <p className="text-[11px] text-[#746A85] dark:text-muted-foreground">
          {loading
            ? "Searching lyrics..."
            : isSynced
              ? isPlaying
                ? "♪ Synced with playback · Tap any line to seek ♪"
                : "Paused · Tap line to seek"
              : isInstrumental
                ? "♪ Pure Instrumental ♪"
                : "Standard Lyrics · Tap Copy in header to save"}
        </p>
      </div>
    </div>
  );
}
