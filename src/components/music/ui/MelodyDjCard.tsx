import { useState } from "react";
import { Disc3, Sparkles, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUICK_VIBE_PRESETS, type QuickVibePreset } from "@/lib/melody-dj";
import { triggerHaptic } from "@/lib/haptics";

interface Props {
  onLaunchDj: (prompt: string) => Promise<void> | void;
  loading?: boolean | undefined;
  className?: string | undefined;
}

export function MelodyDjCard({ onLaunchDj, loading = false, className }: Props) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const finalPrompt = customPrompt.trim();
    if (!finalPrompt || loading) return;
    triggerHaptic("selection");
    void onLaunchDj(finalPrompt);
  };

  const handleSelectPreset = (preset: QuickVibePreset) => {
    setActivePresetId(preset.id);
    setCustomPrompt(preset.prompt);
    triggerHaptic("selection");
    void onLaunchDj(preset.prompt);
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-card to-card p-4 sm:p-5 border border-primary/25 shadow-sm transition-all",
        className,
      )}
    >
      {/* Background ambient decorative orb */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-primary/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/30">
              <Disc3 className={cn("h-4.5 w-4.5", loading && "animate-spin")} />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-semibold tracking-tight text-foreground">
                  Melody DJ
                </h3>
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  AI Vibe
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground font-normal">
                Describe any mood, activity, or memory to spin a custom queue
              </p>
            </div>
          </div>
        </div>

        {/* Custom Input Form */}
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="e.g. 90s monsoon melodies by Hariharan & Chithra..."
            disabled={loading}
            className="h-10 w-full rounded-xl border border-hair bg-card/90 pl-3.5 pr-24 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={!customPrompt.trim() || loading}
            aria-label="Spin custom DJ playlist"
            className="absolute right-1.5 flex h-7 sm:h-7.5 items-center gap-1 rounded-lg bg-primary px-3 text-[11px] sm:text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <Disc3 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>Spin</span>
          </button>
        </form>

        {/* Quick Vibe Chips */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground">
            Quick Vibes
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1 overscroll-x-contain">
            {QUICK_VIBE_PRESETS.map((preset) => {
              const active = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  disabled={loading}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95 border cursor-pointer",
                    active
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-card/80 hover:bg-chip border-hair hover:border-hair-strong text-secondary-foreground hover:text-foreground",
                  )}
                >
                  <span>{preset.emoji}</span>
                  <span className="whitespace-nowrap">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
export default MelodyDjCard;
