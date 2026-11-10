import { useState } from "react";
import { Sparkles, Check, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
  submitAppFeedback,
  markFeedbackDismissed,
} from "@/lib/feedback";

interface WebFeedbackPromptProps {
  userId?: string | null | undefined;
  isGuest?: boolean | undefined;
  onDismiss: () => void;
}

const RATING_EMOJIS = [
  { score: 1, emoji: "😡", label: "Terrible" },
  { score: 2, emoji: "😕", label: "Poor" },
  { score: 3, emoji: "😐", label: "Okay" },
  { score: 4, emoji: "😊", label: "Good" },
  { score: 5, emoji: "😍", label: "Loved it" },
];

export function WebFeedbackPrompt({
  userId,
  isGuest = true,
  onDismiss,
}: WebFeedbackPromptProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<FeedbackCategory[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleCategory = (cat: FeedbackCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);

    try {
      await submitAppFeedback({
        rating,
        categories: selectedCategories,
        comment,
        userId,
        isGuest,
        platform: "web",
      });
      setSubmitted(true);
      setTimeout(() => {
        onDismiss();
      }, 1800);
    } catch {
      onDismiss();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = () => {
    markFeedbackDismissed();
    onDismiss();
  };

  return (
    <div
      role="region"
      aria-label="Experience Feedback"
      className="fixed bottom-24 right-4 sm:right-6 z-40 max-w-sm w-[calc(100vw-2rem)] sm:w-96 rounded-2xl border border-[#E9DDFD] dark:border-purple-800/40 bg-white/95 dark:bg-[#160F29]/95 backdrop-blur-xl p-4 shadow-xl shadow-purple-950/10 text-[#1A1033] dark:text-white animate-slide-up pointer-events-auto"
    >
      {submitted ? (
        <div className="py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">Thank you for your feedback!</p>
            <p className="text-[11px] text-muted-foreground">It helps make MelodyMap better.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Top Bar with Title and Close */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Enjoying MelodyMap?</span>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss feedback"
              className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-[#716A80] dark:text-[#A69ABD]">
            How is your listening experience so far?
          </p>

          {/* Emoji row */}
          <div className="flex items-center justify-between gap-1 py-1">
            {RATING_EMOJIS.map((r) => {
              const isSelected = rating === r.score;
              return (
                <button
                  key={r.score}
                  type="button"
                  onClick={() => setRating(r.score)}
                  title={r.label}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-1.5 rounded-xl transition-all cursor-pointer flex-1",
                    isSelected
                      ? "bg-primary/15 border-2 border-primary scale-105"
                      : "hover:bg-muted/60 active:scale-95"
                  )}
                >
                  <span className="text-xl sm:text-2xl select-none" role="img" aria-label={r.label}>
                    {r.emoji}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-medium leading-tight truncate",
                      isSelected ? "text-primary font-bold" : "text-muted-foreground"
                    )}
                  >
                    {r.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Expandable fields once rating is picked */}
          {rating !== null && (
            <div className="space-y-2 pt-1 animate-fade-in">
              <div className="flex flex-wrap gap-1">
                {FEEDBACK_CATEGORIES.slice(0, 4).map((cat) => {
                  const isSelected = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer",
                        isSelected
                          ? "bg-primary text-white"
                          : "bg-chip text-muted-foreground hover:text-foreground border border-hair"
                      )}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What can we improve? (Optional)"
                className="w-full rounded-xl bg-card border border-border p-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground py-1 px-2 cursor-pointer"
                >
                  Maybe later
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 mm-btn-gradient py-1.5 px-3.5 rounded-xl text-xs font-bold text-white shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  <span>{submitting ? "Sending..." : "Send"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
