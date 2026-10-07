import { useState } from "react";
import {
  Check,
  Disc,
  Power,
  Sliders,
  Sparkles,
  Waves,
  Zap,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  EQUALIZER_FREQUENCIES,
  EQUALIZER_PRESETS,
  type AudioQuality,
  type EqualizerPreset,
  type EqualizerSettings,
} from "@/lib/equalizer";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: EqualizerSettings;
  onPresetChange: (preset: EqualizerPreset) => void;
  onBandGainChange: (index: number, gain: number) => void;
  onToggleEnabled: (enabled?: boolean) => void;
  onCrossfadeChange: (seconds: number) => void;
  onQualityChange: (quality: AudioQuality) => void;
};

const PRESET_LIST: EqualizerPreset[] = [
  "bass_boost",
  "vocal_boost",
  "treble_boost",
  "rock",
  "pop",
  "electronic",
  "hiphop",
  "acoustic",
  "jazz",
  "classical",
  "flat",
];

export function EqualizerModal({
  open,
  onOpenChange,
  settings,
  onPresetChange,
  onBandGainChange,
  onToggleEnabled,
  onCrossfadeChange,
  onQualityChange,
}: Props) {
  const [tab, setTab] = useState<"eq" | "fx">("eq");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg md:max-w-xl bg-popover/95 backdrop-blur-xl border border-border text-foreground p-6 sm:p-7 rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-semibold text-foreground tracking-[-0.01em]">
                Audio FX & Equalizer
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground font-medium">10-Band EQ, Bass Boost & Crossfade</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleEnabled()}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                settings.enabled
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-surface-hover text-muted-foreground border-border hover:text-foreground"
              )}
            >
              <Power className="h-3.5 w-3.5" />
              <span>{settings.enabled ? "EQ ON" : "EQ OFF"}</span>
            </button>
          </div>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-2 my-2 p-1 bg-surface-hover rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setTab("eq")}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5",
              tab === "eq" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Waves className="h-3.5 w-3.5" />
            10-Band Equalizer
          </button>
          <button
            type="button"
            onClick={() => setTab("fx")}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5",
              tab === "fx" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Crossfade & Quality
          </button>
        </div>

        {tab === "eq" && (
          <div className="space-y-5 pt-1">
            {/* Presets Horizontal Carousel */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-[0.06em]">Presets</span>
                {settings.preset === "custom" && (
                  <span className="text-[10px] text-primary font-medium uppercase bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                    Custom Tuning
                  </span>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {PRESET_LIST.map((p) => {
                  const active = settings.enabled && settings.preset === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onPresetChange(p)}
                      className={cn(
                        "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border",
                        active
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-surface-hover border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover-strong"
                      )}
                    >
                      {EQUALIZER_PRESETS[p]?.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 10 Sliders visualizer */}
            <div className="p-4 rounded-xl bg-card border border-border transition-opacity">
              <div className="flex items-end justify-between gap-1 sm:gap-2 h-44 pb-2">
                {EQUALIZER_FREQUENCIES.map((band, idx) => {
                  const gain = settings.gains[idx] || 0;
                  return (
                    <div key={band.frequency} className="flex flex-col items-center flex-1 h-full justify-between">
                      {/* Gain badge */}
                      <span className={cn("text-[10px] font-mono font-medium leading-none", gain > 0 ? "text-primary" : gain < 0 ? "text-muted-foreground" : "text-muted-foreground")}>
                        {gain > 0 ? `+${gain}` : gain}
                      </span>

                      {/* Vertical Slider */}
                      <div className="relative flex items-center justify-center w-full h-28 my-1">
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="1"
                          value={gain}
                          onChange={(e) => onBandGainChange(idx, Number(e.target.value))}
                          aria-label={`${band.label} Gain`}
                          className="w-28 h-2 bg-chip-strong rounded-lg appearance-none cursor-pointer accent-primary -rotate-90"
                        />
                      </div>

                      {/* Frequency label */}
                      <span className="text-[10px] text-muted-foreground font-medium truncate leading-none">
                        {band.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-2 border-t border-border px-1">
                <span>-12 dB</span>
                <span>0 dB (Flat)</span>
                <span>+12 dB</span>
              </div>
            </div>
          </div>
        )}

        {tab === "fx" && (
          <div className="space-y-6 pt-1">
            {/* Crossfade */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Disc className="h-4 w-4 text-primary" />
                  <span className="text-xs sm:text-sm font-semibold text-foreground">Smooth Crossfade</span>
                </div>
                <span className="text-xs font-mono font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                  {settings.crossfade === 0 ? "Off" : `${settings.crossfade}s`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Fades out the ending song and fades in the next song for smooth DJ transitions.
              </p>
              <input
                type="range"
                min="0"
                max="8"
                step="1"
                value={settings.crossfade}
                onChange={(e) => onCrossfadeChange(Number(e.target.value))}
                className="w-full h-2 bg-chip-strong rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0s (Gapless)</span>
                <span>2s</span>
                <span>4s</span>
                <span>6s</span>
                <span>8s (Full DJ)</span>
              </div>
            </div>

            {/* Audio Quality */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-xs sm:text-sm font-semibold text-foreground">Streaming Audio Quality</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "saver", label: "Data Saver", desc: "Low data (64k)" },
                  { id: "standard", label: "Standard", desc: "Balanced (128k)" },
                  { id: "high", label: "Ultra HD", desc: "Studio (256k+)" },
                ].map((q) => {
                  const active = settings.quality === q.id;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => onQualityChange(q.id as AudioQuality)}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all",
                        active
                          ? "bg-primary/15 border-primary/40 text-foreground"
                          : "bg-surface-hover border-border text-muted-foreground hover:bg-surface-hover-strong hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{q.label}</span>
                        {active && <Check className="h-3 w-3 text-primary" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground block">{q.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-border flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-5"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
