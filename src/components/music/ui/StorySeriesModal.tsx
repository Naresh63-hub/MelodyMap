import { useState } from "react";
import { X, Play, Pause, Clock, Star, BookOpen, Volume2, Globe2 } from "lucide-react";
import type { StorySeries, StoryChapter } from "@/lib/stories/story.types";

interface Props {
  series: StorySeries | null;
  currentTrackId?: string | undefined;
  isPlaying?: boolean | undefined;
  onClose: () => void;
  onPlayChapter: (chapter: StoryChapter, series: StorySeries) => void;
}

export function StorySeriesModal({
  series,
  currentTrackId,
  isPlaying = false,
  onClose,
  onPlayChapter,
}: Props) {
  if (!series) return null;

  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);

  const handlePlayAll = () => {
    if (series.chapters.length > 0) {
      onPlayChapter(series.chapters[0]!, series);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#150F22] border border-[#E5DDF5] dark:border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Glow Backdrop */}
        <div
          className="absolute inset-0 h-48 opacity-25 dark:opacity-35 pointer-events-none blur-2xl"
          style={{
            backgroundImage: `url(${series.coverUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        {/* Header Bar */}
        <div className="relative z-10 flex items-center justify-between p-4 sm:p-5 border-b border-[#E5DDF5] dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center h-8 w-8 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6]">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8B5CF6]">
                {series.category.toUpperCase()}
              </span>
              <span className="text-xs text-[#746A85] dark:text-muted-foreground ml-2">
                • {series.totalChapters} Chapters
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-[#746A85] dark:text-muted-foreground hover:bg-[#F1EBFF] dark:hover:bg-white/10 hover:text-[#211536] dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Hero Series Card */}
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="relative w-36 h-48 sm:w-44 sm:h-56 shrink-0 rounded-xl overflow-hidden shadow-lg border border-black/10 dark:border-white/10">
              <img
                src={series.coverUrl}
                alt={series.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold text-white flex items-center gap-1">
                <Globe2 className="h-3 w-3 text-[#A78BFA]" />
                <span>{series.language}</span>
              </div>
            </div>

            <div className="flex-1 space-y-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-[#211536] dark:text-white leading-tight">
                {series.title}
              </h2>
              <p className="text-sm font-medium text-[#8B5CF6] dark:text-[#A78BFA] flex items-center gap-1.5">
                <Volume2 className="h-4 w-4 shrink-0" />
                <span>Narrated by {series.narrator}</span>
              </p>

              <div className="flex items-center gap-3 pt-0.5 text-xs text-[#746A85] dark:text-muted-foreground">
                <span className="flex items-center gap-1 font-semibold text-amber-500">
                  <Star className="h-3.5 w-3.5 fill-amber-500" />
                  {series.rating.toFixed(2)}
                </span>
                <span>•</span>
                <span>{series.totalChapters} Full Chapters</span>
                <span>•</span>
                <span>Studio Audio Drama</span>
              </div>

              <p className="text-xs sm:text-sm text-[#746A85] dark:text-[#A69ABD] line-clamp-3 leading-relaxed pt-1">
                {series.description}
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handlePlayAll}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white text-xs sm:text-sm font-semibold shadow-lg shadow-[#8B5CF6]/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-white" />
                  <span>Start Story (Chapter 1)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Chapters List */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#211536] dark:text-white">
                Chapters & Episodes
              </h3>
              <span className="text-xs text-[#746A85] dark:text-muted-foreground">
                Select any chapter to listen
              </span>
            </div>

            <div className="space-y-2">
              {series.chapters.map((chapter, idx) => {
                const isCurrent = currentTrackId === chapter.id;
                const isCurrentPlaying = isCurrent && isPlaying;

                return (
                  <div
                    key={chapter.id}
                    onClick={() => {
                      setActiveChapterIndex(idx);
                      onPlayChapter(chapter, series);
                    }}
                    className={`group flex items-center justify-between p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-[#F1EBFF] dark:bg-[#8B5CF6]/20 border-[#8B5CF6] shadow-sm"
                        : "bg-white/50 dark:bg-white/[0.03] border-[#E5DDF5] dark:border-white/5 hover:bg-[#F1EBFF]/60 dark:hover:bg-white/[0.07] hover:border-[#8B5CF6]/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <button
                        type="button"
                        aria-label={`Play chapter ${chapter.chapterNumber}`}
                        className={`flex items-center justify-center h-9 w-9 rounded-full shrink-0 transition-all ${
                          isCurrent
                            ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/40"
                            : "bg-[#F1EBFF] dark:bg-white/10 text-[#8B5CF6] dark:text-white group-hover:scale-105 group-hover:bg-[#8B5CF6] group-hover:text-white"
                        }`}
                      >
                        {isCurrentPlaying ? (
                          <Pause className="h-4 w-4 fill-current" />
                        ) : (
                          <Play className="h-4 w-4 fill-current ml-0.5" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[#8B5CF6] shrink-0">
                            #{chapter.chapterNumber}
                          </span>
                          <h4 className="text-xs sm:text-sm font-semibold text-[#211536] dark:text-white truncate">
                            {chapter.title}
                          </h4>
                        </div>
                        {chapter.synopsis && (
                          <p className="text-[11px] text-[#746A85] dark:text-[#A69ABD] truncate mt-0.5">
                            {chapter.synopsis}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-xs font-mono text-[#746A85] dark:text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{chapter.duration}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
