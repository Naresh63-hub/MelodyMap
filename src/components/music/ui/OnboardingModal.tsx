import { useState, useEffect } from "react";
import {
  Globe2,
  Music2,
  Sparkles,
  Plus,
  X,
  Check,
  CheckCircle2,
  ArrowRight,
  Sliders,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LANGUAGES, SUGGESTED_ARTISTS } from "@/lib/library";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLanguages?: string[];
  currentArtists?: string[];
  onSave: (data: { languages: string[]; artists: string[] }) => void;
  onOpenSettings?: () => void;
};

export function OnboardingModal({
  open,
  onOpenChange,
  currentLanguages = [],
  currentArtists = [],
  onSave,
  onOpenSettings,
}: Props) {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(currentLanguages);
  const [selectedArtists, setSelectedArtists] = useState<string[]>(currentArtists);
  const [artistInput, setArtistInput] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  // Sync with props when opened
  useEffect(() => {
    if (open) {
      setSelectedLanguages(currentLanguages.length > 0 ? currentLanguages : ["Telugu", "Hindi"]);
      setSelectedArtists(currentArtists);
      setStep(1);
    }
  }, [open, currentLanguages, currentArtists]);

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  };

  const addArtist = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    if (!selectedArtists.some((a) => a.toLowerCase() === clean.toLowerCase())) {
      setSelectedArtists((prev) => [...prev, clean]);
    }
    setArtistInput("");
  };

  const removeArtist = (name: string) => {
    setSelectedArtists((prev) => prev.filter((a) => a !== name));
  };

  const handleFinish = () => {
    onSave({
      languages: selectedLanguages,
      artists: selectedArtists,
    });
    onOpenChange(false);
  };

  const handleSkip = () => {
    // Save current or default selections and close
    onSave({
      languages: selectedLanguages.length > 0 ? selectedLanguages : ["Telugu", "Hindi"],
      artists: selectedArtists,
    });
    onOpenChange(false);
  };

  const uniqueSuggested = Array.from(new Set(SUGGESTED_ARTISTS));
  const suggestedUnselected = uniqueSuggested.filter(
    (a) => !selectedArtists.some((x) => x.toLowerCase() === a.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-xl overflow-y-auto border-white/10 bg-[#0d0d17]/95 p-0 text-white backdrop-blur-2xl shadow-2xl rounded-3xl scrollbar-hide">
        {/* Header with gradient banner */}
        <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-purple-900/30 via-purple-900/10 to-transparent p-6 sm:p-7 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-600 to-cyan-400 p-0.5 shadow-lg shadow-purple-500/25">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#0d0a1a]">
              <Sparkles className="h-6 w-6 text-pink-400 animate-pulse" />
            </div>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display">
            Personalize Your Music
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-purple-200/70 mt-1 max-w-md mx-auto">
            Choose your song languages and favorite artists so MelodyMap can stream the music you love.
          </DialogDescription>

          {/* Progress Indicators */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all",
                step === 1
                  ? "bg-purple-500 text-white shadow-md shadow-purple-500/30"
                  : "bg-white/5 text-white/50 hover:bg-white/10",
              )}
            >
              <Globe2 className="h-3.5 w-3.5" />
              1. Song Languages
              {selectedLanguages.length > 0 && (
                <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                  {selectedLanguages.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all",
                step === 2
                  ? "bg-purple-500 text-white shadow-md shadow-purple-500/30"
                  : "bg-white/5 text-white/50 hover:bg-white/10",
              )}
            >
              <Music2 className="h-3.5 w-3.5" />
              2. Favorite Artists
              {selectedArtists.length > 0 && (
                <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                  {selectedArtists.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">What languages do you listen to?</h3>
                  <p className="text-xs text-white/40">Select all the languages you want in your music feed</p>
                </div>
                <span className="text-xs font-medium text-purple-300">
                  {selectedLanguages.length} selected
                </span>
              </div>

              {/* Language Chips Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {LANGUAGES.map((lang) => {
                  const isSelected = selectedLanguages.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      className={cn(
                        "flex items-center justify-between rounded-xl p-3 text-xs font-medium transition-all text-left border",
                        isSelected
                          ? "border-purple-500 bg-purple-500/20 text-white shadow-md shadow-purple-500/15"
                          : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06] hover:text-white",
                      )}
                    >
                      <span>{lang}</span>
                      <div
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                          isSelected
                            ? "border-purple-400 bg-purple-500 text-white"
                            : "border-white/20 bg-transparent text-transparent",
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-xs font-semibold text-white shadow-md hover:brightness-110"
                >
                  Next: Pick Favorite Artists
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h3 className="text-sm font-semibold text-white">Who are your favorite artists &amp; singers?</h3>
                <p className="text-xs text-white/40">We'll prioritize their top tracks and related recommendations</p>
              </div>

              {/* Input for custom artist */}
              <div className="flex gap-2">
                <Input
                  value={artistInput}
                  onChange={(e) => setArtistInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addArtist(artistInput);
                    }
                  }}
                  placeholder="Type an artist or singer name..."
                  className="h-10 rounded-xl border-white/10 bg-white/[0.04] text-xs text-white placeholder:text-white/30 focus:border-purple-500/50"
                />
                <Button
                  type="button"
                  onClick={() => addArtist(artistInput)}
                  disabled={!artistInput.trim()}
                  className="h-10 rounded-xl bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500 shrink-0"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>

              {/* Selected Artists Chips */}
              {selectedArtists.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-white/50">Your Selected Artists:</span>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 rounded-xl bg-white/[0.02] border border-white/5">
                    {selectedArtists.map((artist) => (
                      <span
                        key={artist}
                        className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-500/20 px-3 py-1 text-xs text-purple-100 shadow-sm"
                      >
                        {artist}
                        <button
                          type="button"
                          onClick={() => removeArtist(artist)}
                          className="text-white/40 hover:text-pink-400 transition-colors"
                          aria-label={`Remove ${artist}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Suggestions */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-medium text-white/50">Suggested Artists:</span>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 scrollbar-hide">
                  {suggestedUnselected.slice(0, 24).map((artist) => (
                    <button
                      key={artist}
                      type="button"
                      onClick={() => addArtist(artist)}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/70 hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-purple-200 transition-colors"
                    >
                      <Plus className="h-3 w-3 text-white/40" />
                      {artist}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Settings note & actions */}
          <div className="border-t border-white/10 pt-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-white/40">
              <span className="inline-flex items-center gap-1.5 text-[11px]">
                <Sliders className="h-3.5 w-3.5 text-purple-400" />
                You can edit these anytime in <strong className="text-white/70">Settings</strong>
              </span>
              <button
                type="button"
                onClick={handleSkip}
                className="text-[11px] text-white/40 hover:text-white underline underline-offset-2 transition-colors"
              >
                Skip for now
              </button>
            </div>

            <Button
              type="button"
              onClick={handleFinish}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 font-semibold text-white shadow-lg shadow-purple-500/25 hover:brightness-110 active:scale-[0.99] transition-all text-xs sm:text-sm"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Save Preferences &amp; Start Listening
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
