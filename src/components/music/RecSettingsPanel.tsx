import { useMemo, useState, useCallback } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { GENRES, MOODS, PODCAST_TOPICS, type RecSettings } from "@/lib/library";
import { LanguageArtistPicker } from "@/components/music/ui/LanguageArtistPicker";
import { cn } from "@/lib/utils";

type Props = {
  settings: RecSettings;
  onChange: (patch: Partial<RecSettings>) => void;
  onReset: () => void;
  onApply: () => void;
  loading: boolean;
  /** Jump to the dedicated Languages tab, which plays language-based songs. */
  onOpenLanguages?: () => void;
};

export function RecSettingsPanel({
  settings,
  onChange,
  onReset,
  onApply,
  loading,
  onOpenLanguages,
}: Props) {
  /** Track pending slider changes so we debounce updates. */
  const [pendingMoods, setPendingMoods] = useState<Record<string, number> | null>(null);

  /** Validate: warn if all moods are at 0. */
  const allMoodsZero = useMemo(
    () => Object.values(settings.moods).every((v) => v === 0),
    [settings.moods],
  );

  const handleMoodSlider = useCallback(
    (mood: string, value: number) => {
      setPendingMoods({ ...settings.moods, [mood]: value });
    },
    [settings.moods],
  );

  /** Commit pending mood changes on slider release (debounce). */
  const commitMoods = useCallback(() => {
    if (pendingMoods) {
      onChange({ moods: pendingMoods });
      setPendingMoods(null);
    }
  }, [pendingMoods, onChange]);

  const toggleGenre = (genre: string) =>
    onChange({
      genres: settings.genres.includes(genre)
        ? settings.genres.filter((g) => g !== genre)
        : [...settings.genres, genre],
    });

  const toggleTopic = (topic: string) =>
    onChange({
      podcastTopics: settings.podcastTopics.includes(topic)
        ? settings.podcastTopics.filter((t) => t !== topic)
        : [...settings.podcastTopics, topic],
    });


  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Tune your picks</h2>
          <p className="text-xs text-muted-foreground">
            Weight the moods, genres and energy the AI should chase.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} className="shrink-0">
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Mood weighting
          </p>
          {MOODS.map((mood) => (
            <div key={mood} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs capitalize text-muted-foreground">{mood}</span>
              <Slider
                value={[pendingMoods?.[mood] ?? settings.moods[mood] ?? 50]}
                max={100}
                step={5}
                onValueChange={([v]) => handleMoodSlider(mood, v ?? 0)}
                onValueCommit={commitMoods}
                className="flex-1"
                aria-label={`${mood} weighting`}
              />
              <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                {pendingMoods?.[mood] ?? settings.moods[mood] ?? 50}%
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Genres
            </p>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map((genre) => {
                const on = settings.genres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <LanguageArtistPicker
              languages={settings.languages}
              artists={settings.artists}
              onChange={(patch) => onChange(patch)}
              {...(onOpenLanguages
                ? { actionLabel: "Play language songs", onAction: onOpenLanguages }
                : {})}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Podcast topics
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PODCAST_TOPICS.map((topic) => {
                const on = settings.podcastTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>



          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-muted-foreground">Familiar → Deep</span>
              <Slider
                value={[settings.discovery]}
                max={100}
                step={5}
                onValueChange={([v]) => onChange({ discovery: v ?? 0 })}
                className="flex-1"
                aria-label="Discovery level"
              />
              <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                {settings.discovery}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-muted-foreground">Calm → Energetic</span>
              <Slider
                value={[settings.energy]}
                max={100}
                step={5}
                onValueChange={([v]) => onChange({ energy: v ?? 0 })}
                className="flex-1"
                aria-label="Energy level"
              />
              <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                {settings.energy}%
              </span>
            </div>
            <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              Instrumental only
              <Switch
                checked={settings.instrumentalOnly}
                onCheckedChange={(v) => onChange({ instrumentalOnly: v })}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                Notify me when favourite artists drop new songs
                <span className="block text-[11px] text-muted-foreground/70">
                  Browser notification, even outside the Mixes tab
                </span>
              </span>
              <Switch
                checked={settings.notifyNewDrops}
                onCheckedChange={async (v) => {
                  // Asking for permission needs a user gesture — this toggle is one.
                  if (v && "Notification" in window && Notification.permission === "default") {
                    await Notification.requestPermission();
                  }
                  onChange({ notifyNewDrops: v });
                }}
              />
            </label>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Fresh releases in queue
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[0, 3, 5, 10].map((n) => {
                  const on = settings.injectInterval === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onChange({ injectInterval: n })}
                      aria-pressed={on}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {n === 0 ? "Off" : `Every ${n} songs`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {allMoodsZero && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>All moods are set to 0%. Recommendations may be less personalized. Increase at least one mood for better results.</p>
        </div>
      )}

      <Button className="mt-5 w-full rounded-full font-semibold" onClick={onApply} disabled={loading}>
        {loading ? "Refreshing…" : "Apply & refresh For you"}
      </Button>
    </section>
  );
}
