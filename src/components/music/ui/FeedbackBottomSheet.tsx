import { useState } from "react";
import { Sparkles, Music2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import {
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
  submitAppFeedback,
  markFeedbackDismissed,
} from "@/lib/feedback";

interface FeedbackBottomSheetProps {
  open: boolean;
  onClose: () => void;
  onExit: () => void;
  userId?: string | null | undefined;
  isGuest?: boolean | undefined;
}

const RATING_EMOJIS = [
  { score: 1, emoji: "😡", label: "Terrible" },
  { score: 2, emoji: "😕", label: "Needs Work" },
  { score: 3, emoji: "😐", label: "Okay" },
  { score: 4, emoji: "😊", label: "Good" },
  { score: 5, emoji: "😍", label: "Loved It!" },
];

export function FeedbackBottomSheet({
  open,
  onClose,
  onExit,
  userId,
  isGuest = true,
}: FeedbackBottomSheetProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<FeedbackCategory[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const toggleCategory = (cat: FeedbackCategory) => {
    triggerHaptic("selection");
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    triggerHaptic("selection");

    try {
      await submitAppFeedback({
        rating,
        categories: selectedCategories,
        comment,
        userId,
        isGuest,
        platform: "android",
      });
      setSubmitted(true);
      // Exit shortly after feedback acknowledgement
      setTimeout(() => {
        onExit();
      }, 700);
    } catch {
      onExit();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipAndExit = () => {
    triggerHaptic("selection");
    markFeedbackDismissed();
    onExit();
  };

  const handleContinueListening = () => {
    triggerHaptic("selection");
    markFeedbackDismissed();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto animate-fade-in">
      {/* Soft translucent backdrop - clicking outside acts as continue listening */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={handleContinueListening}
        aria-hidden="true"
      />

      {/* Modern Bottom Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="App feedback"
        className="relative w-full max-w-lg rounded-t-[32px] border-t border-[#E9DDFD] dark:border-purple-800/40 bg-white dark:bg-[#160F29] text-[#1A1033] dark:text-white p-5 sm:p-6 shadow-[0_-12px_40px_rgba(124,58,237,0.14)] z-10 max-h-[90vh] overflow-y-auto animate-slide-up"
      >
        {/* Swipe drag handle */}
        <div className="flex justify-center -mt-1 mb-3">
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
        </div>

        {submitted ? (
          /* Thank You State */
          <div className="py-8 flex flex-col items-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Check className="h-6 w-6 stroke-[2.5]" />
            </div>
            <h3 className="text-lg font-bold">Thank you for your feedback!</h3>
            <p className="text-xs text-muted-foreground">Exiting MelodyMap...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>First Experience Feedback</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1A1033] dark:text-white">
                Before you go...
              </h2>
              <p className="text-xs text-[#716A80] dark:text-[#A69ABD]">
                How was your first experience with MelodyMap?
              </p>
            </div>

            {/* 5 Emojis Rating Bar */}
            <div className="flex justify-center gap-2 sm:gap-3 py-2">
              {RATING_EMOJIS.map((r) => {
                const isSelected = rating === r.score;
                return (
                  <button
                    key={r.score}
                    type="button"
                    onClick={() => {
                      triggerHaptic("selection");
                      setRating(r.score);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 sm:p-2.5 rounded-2xl transition-all cursor-pointer",
                      isSelected
                        ? "bg-primary/15 border-2 border-primary scale-105 shadow-sm"
                        : "bg-[#F8F5FF] dark:bg-[#1E1438] border border-[#E9DDFD] dark:border-purple-800/30 hover:border-primary/40 active:scale-95"
                    )}
                  >
                    <span className="text-2xl sm:text-3xl select-none" role="img" aria-label={r.label}>
                      {r.emoji}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold leading-tight",
                        isSelected ? "text-primary font-bold" : "text-muted-foreground"
                      )}
                    >
                      {r.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Optional Aspect Chips when a rating is selected */}
            {rating !== null && (
              <div className="space-y-3 pt-1 animate-fade-in">
                <p className="text-xs font-semibold text-[#1A1033] dark:text-white">
                  What caught your attention? (Optional)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FEEDBACK_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer",
                          isSelected
                            ? "bg-primary text-white shadow-xs"
                            : "bg-[#F8F5FF] dark:bg-[#1E1438] border border-[#E9DDFD] dark:border-purple-800/30 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {/* Optional Comment Input */}
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us anything that could make MelodyMap better... (Optional)"
                  rows={2}
                  className="w-full rounded-2xl bg-[#F8F5FF] dark:bg-[#1E1438] border border-[#E9DDFD] dark:border-purple-800/40 p-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
            )}

            {/* 3 Explicit User Actions */}
            <div className="pt-2 space-y-2">
              {/* Action 1: Submit Feedback */}
              {rating !== null ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full mm-btn-gradient py-3 px-4 rounded-2xl font-bold text-sm text-white shadow-md hover:shadow-lg active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Feedback & Exit"}
                </button>
              ) : null}

              <div className="flex items-center justify-between gap-3 pt-1">
                {/* Action 2: Skip & Exit */}
                <button
                  type="button"
                  onClick={handleSkipAndExit}
                  className="text-xs font-semibold text-[#716A80] dark:text-[#A69ABD] hover:text-[#1A1033] dark:hover:text-white py-2 px-3 rounded-full hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  Skip & Exit
                </button>

                {/* Action 3: Continue Listening */}
                <button
                  type="button"
                  onClick={handleContinueListening}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Music2 className="w-3.5 h-3.5" />
                  <span>Continue Listening</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
