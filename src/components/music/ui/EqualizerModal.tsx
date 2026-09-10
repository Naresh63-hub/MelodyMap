import { useState } from "react";
import {
  Activity,
  Check,
  Disc,
  Power,
  RotateCcw,
  Sliders,
  Sparkles,
  Volume2,
  Waves,
  X,
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
      <DialogContent className="max-w-md sm:max-w-lg md:max-w-xl bg-[#0f0b1d]/95 backdrop-blur-2xl border-purple-500/20 text-white p-5 sm:p-6 rounded-3xl shadow-2xl shadow-purple-950/80 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 shadow-inner">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-white tracking-tight">
                Audio FX & Equalizer
              </DialogTitle>
              <p className="text-[11px] text-purple-300/60 font-medium">10-Band EQ, Bass Boost & Crossfade</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleEnabled()}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                settings.enabled
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/20"
                  : "bg-white/[0.04] text-white/40 border-white/10 hover:text-white/70"
              )}
            >
              <Power className="h-3.5 w-3.5" />
              <span>{settings.enabled ? "EQ ON" : "EQ OFF"}</span>
            </button>
          </div>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-2 my-2 p-1 bg-white/[0.03] rounded-2xl border border-white/5">
          <button
            type="button"
            onClick={() => setTab("eq")}
            className={cn(
              "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
              tab === "eq" ? "bg-purple-600 text-white shadow-md" : "text-white/50 hover:text-white"
            )}
          >
            <Waves className="h-3.5 w-3.5" />
            10-Band Equalizer
          </button>
          <button
            type="button"
            onClick={() => setTab("fx")}
            className={cn(
              "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
              tab === "fx" ? "bg-purple-600 text-white shadow-md" : "text-white/50 hover:text-white"
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
                <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Presets</span>
                {settings.preset === "custom" && (
                  <span className="text-[10px] text-purple-400 font-semibold uppercase bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
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
                        "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border",
                        active
                          ? "bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-600/30"
                          : "bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06]"
                      )}
                    >
                      {EQUALIZER_PRESETS[p]?.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 10 Sliders visualizer */}
            <div className="p-4 rounded-2xl bg-black/30 border border-white/5 transition-opacity">
              <div className="flex items-end justify-between gap-1 sm:gap-2 h-44 pb-2">
                {EQUALIZER_FREQUENCIES.map((band, idx) => {
                  const gain = settings.gains[idx] || 0;
                  return (
                    <div key={band.frequency} className="flex flex-col items-center flex-1 h-full justify-between">
                      {/* Gain badge */}
                      <span className={cn("text-[10px] font-mono font-bold leading-none", gain > 0 ? "text-purple-400" : gain < 0 ? "text-pink-400" : "text-white/40")}>
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
                          className="w-28 h-2 bg-purple-950/60 rounded-lg appearance-none cursor-pointer accent-purple-400 -rotate-90"
                        />
                      </div>

                      {/* Frequency label */}
                      <span className="text-[10px] text-white/50 font-medium truncate leading-none">
                        {band.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center text-[10px] text-white/40 pt-2 border-t border-white/5 px-1">
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
            <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Disc className="h-4 w-4 text-purple-400" />
                  <span className="text-xs sm:text-sm font-bold text-white">Smooth Crossfade</span>
                </div>
                <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/15 px-2.5 py-1 rounded-full border border-purple-500/20">
                  {settings.crossfade === 0 ? "Off" : `${settings.crossfade}s`}
                </span>
              </div>
              <p className="text-xs text-white/50">
                Fades out the ending song and fades in the next song for smooth DJ transitions.
              </p>
              <input
                type="range"
                min="0"
                max="8"
                step="1"
                value={settings.crossfade}
                onChange={(e) => onCrossfadeChange(Number(e.target.value))}
                className="w-full h-2 bg-purple-950/60 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
              <div className="flex justify-between text-[10px] text-white/40">
                <span>0s (Gapless)</span>
                <span>2s</span>
                <span>4s</span>
                <span>6s</span>
                <span>8s (Full DJ)</span>
              </div>
            </div>

            {/* Audio Quality */}
            <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-400" />
                <span className="text-xs sm:text-sm font-bold text-white">Streaming Audio Quality</span>
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
                          ? "bg-purple-600/20 border-purple-400 text-white shadow-md shadow-purple-950/50"
                          : "bg-white/[0.02] border-white/5 text-white/50 hover:bg-white/[0.05] hover:text-white/80"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">{q.label}</span>
                        {active && <Check className="h-3 w-3 text-purple-400" />}
                      </div>
                      <span className="text-[10px] text-white/40 block">{q.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-purple-600 text-white hover:bg-purple-500 font-semibold px-5"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
