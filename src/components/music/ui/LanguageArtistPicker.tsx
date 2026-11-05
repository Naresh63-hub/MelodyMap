import { useState, useEffect } from "react";
import { Music2, Plus, X, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { LANGUAGES, SUGGESTED_ARTISTS, calculateLanguageWeights, type RecSettings, type Track } from "@/lib/library";
import { languagePicks } from "@/lib/music.functions";
import { areSameTrack } from "@/lib/track-dedup";
import { HorizontalScroll } from "./HorizontalScroll";
import { MediaCard } from "./MediaCard";
import { cn } from "@/lib/utils";

type Props = {
  languages: string[];
  primaryLanguage?: string | undefined;
  languageWeights?: Record<string, number> | undefined;
  artists: string[];
  onChange: (patch: Partial<RecSettings>) => void;
  /** Optional action (e.g. "Open Languages tab") shown beside the header. */
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Deduplicates preview tracks before updating state.
 * Prefers unique track ID; falls back to normalized title + artist.
 * Normalizes case and whitespace; does not remove different songs with same title but different artist.
 */
export function deduplicateTracks(tracks: Track[]): Track[] {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const out: Track[] = [];

  for (const track of tracks) {
    if (!track) continue;
    const id = track.id?.trim();
    if (id && seenIds.has(id)) {
      continue;
    }

    const normTitle = (track.title || "")
      .toLowerCase()
      .replace(/[‘'’`]/g, "'")
      .replace(/[()[\]{}]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const normArtist = (track.artist || "")
      .toLowerCase()
      .replace(/[‘'’`]/g, "'")
      .replace(/[()[\]{}]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const key = `${normTitle}:::${normArtist}`;

    if (key !== ":::" && seenKeys.has(key)) {
      continue;
    }

    // Check if an existing track represents the same song:
    // Never remove songs that have different artists, even if titles match.
    const isSameSong = out.some((existing) => {
      const exTitle = (existing.title || "")
        .toLowerCase()
        .replace(/[‘'’`]/g, "'")
        .replace(/[()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const exArtist = (existing.artist || "")
        .toLowerCase()
        .replace(/[‘'’`]/g, "'")
        .replace(/[()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const existingTokens = new Set(exArtist.split(/\s+/).filter(Boolean));
      const hasArtistOverlap = normArtist
        .split(/\s+/)
        .filter(Boolean)
        .some((token) => existingTokens.has(token));

      if (exTitle === normTitle) {
        return hasArtistOverlap;
      }

      return hasArtistOverlap && areSameTrack(existing, track);
    });

    if (isSameSong) {
      continue;
    }

    if (id) seenIds.add(id);
    if (key !== ":::") seenKeys.add(key);
    out.push(track);
  }

  return out;
}

/** Reusable language + artist/singer picker used on login and in settings. */
export function LanguageArtistPicker({
  languages,
  primaryLanguage,
  languageWeights,
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
        data: { languages, artists, count: 16 },
      });
      if (!res.error && res.tracks) {
        const unique = deduplicateTracks(res.tracks as Track[]);
        setPreview(unique.slice(0, 8));
      }
      setLoading(false);
    }, 600); // debounce API calls
    return () => clearTimeout(timer);
  }, [languages, artists, runLanguagePicks]);

  const toggleLanguage = (lang: string) => {
    const nextLanguages = languages.includes(lang)
      ? languages.filter((l) => l !== lang)
      : [...languages, lang];
    const nextPrimary =
      primaryLanguage && nextLanguages.includes(primaryLanguage)
        ? primaryLanguage
        : nextLanguages[0];
    const nextWeights = calculateLanguageWeights(nextLanguages, nextPrimary, 70);
    const patch: Partial<RecSettings> = {
      languages: nextLanguages,
      languageWeights: nextWeights,
    };
    if (nextPrimary) {
      patch.primaryLanguage = nextPrimary;
    }
    onChange(patch);
  };

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

        {languages.length > 1 && (
          <div className="mt-2.5 rounded-xl border border-hair bg-card/60 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80">Primary Language:</span>
              <span className="text-[10px] text-primary/80">Prioritized (70% weight)</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {languages.map((lang) => {
                const isPrimary = primaryLanguage ? primaryLanguage === lang : languages[0] === lang;
                return (
                  <button
                    key={`primary-${lang}`}
                    type="button"
                    onClick={() => {
                      const weights = calculateLanguageWeights(languages, lang, 70);
                      const patch: Partial<RecSettings> = {
                        primaryLanguage: lang,
                        languageWeights: weights,
                      };
                      onChange(patch);
                    }}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs transition-all flex items-center gap-1",
                      isPrimary
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs ring-1 ring-primary/40"
                        : "bg-chip text-muted-foreground hover:text-foreground border border-hair",
                    )}
                  >
                    <span>★</span>
                    <span>{lang}</span>
                    {isPrimary && <span className="text-[10px] opacity-80">(Primary)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-foreground/90"
              >
                {artist}
                <button
                  type="button"
                  onClick={() => removeArtist(artist)}
                  aria-label={`Remove ${artist}`}
                  className="text-foreground/40 transition-colors hover:text-pink-400"
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
            className="h-9 sm:h-8 min-w-0 flex-1 rounded-xl sm:rounded-full border border-hair-strong bg-chip px-3 text-xs text-foreground placeholder:text-foreground/30 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
          />
          <button
            type="button"
            onClick={() => addArtist(artistDraft)}
            aria-label="Add artist"
            className="flex h-9 w-9 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl sm:rounded-full border border-hair-strong bg-chip text-foreground/60 transition-colors hover:border-purple-500/40 hover:text-foreground button-press active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {suggested.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {suggested.slice(0, 12).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => addArtist(a)}
                className="rounded-full border border-hair bg-chip-subtle px-3 py-1 sm:px-2.5 sm:py-0.5 text-xs sm:text-[11px] text-foreground/50 transition-colors hover:border-purple-500/30 hover:text-foreground active:scale-95 cursor-pointer"
              >
                + {a}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preview Section */}
      {(languages.length > 0 || artists.length > 0) && (
        <div className="mt-5 border-t border-hair-strong pt-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <Music2 className="h-3.5 w-3.5 text-primary" />
            )}
            Preview Songs
          </p>
          {preview.length > 0 ? (
            <HorizontalScroll>
              <div className="flex gap-3 pb-3">
                {preview.map((track, idx) => (
                  <div key={track.id || `${track.title}-${track.artist}-${idx}`} className="w-28 sm:w-32 shrink-0">
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
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-hair-strong bg-chip-subtle">
              <p className="text-xs text-foreground/40">
                {loading ? "Finding songs..." : "No songs found for these selections."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}