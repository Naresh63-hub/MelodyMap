import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { GENRES, MOODS, type RecSettings } from "@/lib/library";
import { cn } from "@/lib/utils";

type Props = {
  settings: RecSettings;
  onChange: (patch: Partial<RecSettings>) => void;
  onReset: () => void;
  onApply: () => void;
  loading: boolean;
};

export function RecSettingsPanel({ settings, onChange, onReset, onApply, loading }: Props) {
  const toggleGenre = (genre: string) =>
    onChange({
      genres: settings.genres.includes(genre)
        ? settings.genres.filter((g) => g !== genre)
        : [...settings.genres, genre],
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
                value={[settings.moods[mood] ?? 50]}
                max={100}
                step={5}
                onValueChange={([v]) => onChange({ moods: { ...settings.moods, [mood]: v ?? 0 } })}
                className="flex-1"
                aria-label={`${mood} weighting`}
              />
              <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                {settings.moods[mood] ?? 50}%
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
          </div>
        </div>
      </div>

      <Button className="mt-5 w-full rounded-full font-semibold" onClick={onApply} disabled={loading}>
        {loading ? "Refreshing…" : "Apply & refresh For you"}
      </Button>
    </section>
  );
}
