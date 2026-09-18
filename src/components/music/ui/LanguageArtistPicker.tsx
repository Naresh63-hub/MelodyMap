import { useState, useEffect } from "react";
import { Music2, Plus, X, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { LANGUAGES, SUGGESTED_ARTISTS, type Track } from "@/lib/library";
import { languagePicks } from "@/lib/music.functions";
import { HorizontalScroll } from "./HorizontalScroll";
import { MediaCard } from "./MediaCard";
import { cn } from "@/lib/utils";

type Props = {
  languages: string[];
  artists: string[];
  onChange: (patch: { languages?: string[]; artists?: string[] }) => void;
  /** Optional action (e.g. "Open Languages tab") shown beside the header. */
  actionLabel?: string;
  onAction?: () => void;
};

/** Reusable language + artist/singer picker used on login and in settings. */
export function LanguageArtistPicker({
  languages,
  artists,
  onChange,
  actionLabel,
  onAction,
}: Props) {
  const [artistDraft, setArtistDraft] = useState("");
  const runLanguagePicks = useServerFn(languagePicks);
  const [preview, setPreview] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (languages.length === 0 && artists.length === 0) {
      setPreview([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await runLanguagePicks({
        data: { languages, artists, count: 8 },
      });
      if (!res.error && res.tracks) {
        setPreview(res.tracks as Track[]);
      }
      setLoading(false);
    }, 1000); // debounce API calls
    return () => clearTimeout(timer);
  }, [languages, artists, runLanguagePicks]);

  const toggleLanguage = (lang: string) =>
    onChange({
      languages: languages.includes(lang)
        ? languages.filter((l) => l !== lang)
        : [...languages, lang],
    });

  const addArtist = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    if (!artists.some((a) => a.toLowerCase() === clean.toLowerCase())) {
      onChange({ artists: [...artists, clean] });
    }
    setArtistDraft("");
  };

  const removeArtist = (name: string) =>
    onChange({ artists: artists.filter((a) => a !== name) });

  const uniqueSuggested = Array.from(new Set(SUGGESTED_ARTISTS));
  const suggested = uniqueSuggested.filter(
    (a) => !artists.some((x) => x.toLowerCase() === a.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Music2 className="h-3.5 w-3.5" />
          Languages &amp; artists
        </p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-[11px] font-medium text-purple-300 transition-colors hover:bg-purple-500/20"
          >
            {actionLabel}
          </button>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Languages — songs you'll hear are picked from these
        </p>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGES.map((lang) => {
            const on = languages.includes(lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => toggleLanguage(lang)}
                aria-pressed={on}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {lang}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Artists &amp; singers — their songs are prioritized
        </p>
        {artists.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {artists.map((artist) => (
              <span
                key={artist}
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-white/90"
              >
                {artist}
                <button
                  type="button"
                  onClick={() => removeArtist(artist)}
                  aria-label={`Remove ${artist}`}
                  className="text-white/40 transition-colors hover:text-pink-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={artistDraft}
            onChange={(e) => setArtistDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addArtist(artistDraft);
              }
            }}
            placeholder="Add an artist or singer…"
            className="h-8 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-white placeholder:text-white/30 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
          />
          <button
            type="button"
            onClick={() => addArtist(artistDraft)}
            aria-label="Add artist"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:border-purple-500/40 hover:text-white button-press"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {suggested.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggested.slice(0, 12).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => addArtist(a)}
                className="rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-white/40 transition-colors hover:border-purple-500/30 hover:text-white/80"
              >
                + {a}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preview Section */}
      {(languages.length > 0 || artists.length > 0) && (
        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Music2 className="h-3.5 w-3.5" />
            )}
            Preview Songs
          </p>
          {preview.length > 0 ? (
            <HorizontalScroll>
              <div className="flex gap-3 pb-4">
                {preview.map((track) => (
                  <div key={track.id} className="w-32 shrink-0">
                    <MediaCard
                      title={track.title}
                      subtitle={track.artist}
                      image={track.thumbnail}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </HorizontalScroll>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
              <p className="text-xs text-white/40">
                {loading ? "Finding songs..." : "No songs found for these selections."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}