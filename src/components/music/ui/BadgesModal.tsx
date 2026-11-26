import { useState, useMemo } from "react";
import {
  Crown,
  Flame,
  Moon,
  BookOpen,
  Headphones,
  Zap,
  Sparkles,
  Trophy,
  X,
  Share2,
  CheckCircle2,
  Lock,
} from "lucide-react";
import {
  getStreakData,
  getTopListenerPercentile,
  evaluateUserBadges,
  type ListenerBadge,
} from "@/lib/streak";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onShareBadge?: (badge: ListenerBadge) => void;
}

export function BadgesModal({ open, onClose }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [shareToast, setShareToast] = useState(false);

  const streakData = useMemo(() => getStreakData(), [open]);
  const rank = useMemo(() => getTopListenerPercentile(streakData), [streakData]);
  const badges = useMemo(() => evaluateUserBadges(streakData), [streakData]);

  const unlockedCount = useMemo(() => badges.filter((b) => b.unlocked).length, [badges]);

  const filteredBadges = useMemo(() => {
    if (selectedCategory === "all") return badges;
    if (selectedCategory === "unlocked") return badges.filter((b) => b.unlocked);
    return badges.filter((b) => b.category === selectedCategory);
  }, [badges, selectedCategory]);

  if (!open) return null;

  const getIcon = (iconName: ListenerBadge["iconName"]) => {
    switch (iconName) {
      case "crown":
        return <Crown className="h-5 w-5" />;
      case "flame":
        return <Flame className="h-5 w-5" />;
      case "moon":
        return <Moon className="h-5 w-5" />;
      case "book":
        return <BookOpen className="h-5 w-5" />;
      case "headphones":
        return <Headphones className="h-5 w-5" />;
      case "zap":
        return <Zap className="h-5 w-5" />;
      case "sparkles":
      default:
        return <Sparkles className="h-5 w-5" />;
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: "My MelodyMap Listener Status",
          text: `I'm a ${rank.label} on MelodyMap with a ${streakData.currentStreak}-day streak and ${unlockedCount} unlocked trophies! 🎵🔥`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl bg-card border border-hair-strong shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-hair">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center border border-amber-500/30">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">Listener Achievements</h2>
              <p className="text-xs text-muted-foreground">
                {unlockedCount} of {badges.length} badges unlocked
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:bg-chip hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Top Rank Hero Card */}
          <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-amber-500/20 via-purple-500/15 to-indigo-950/40 border border-amber-500/40 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-black flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0">
                  <Crown className="h-8 w-8 fill-black" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                    <Sparkles className="h-3 w-3" />
                    <span>Listener Rank</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-foreground mt-0.5">
                    {rank.label}
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">{rank.badgeTitle}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-background text-xs font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-sm self-end sm:self-center"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share Status</span>
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-hair/60 text-center">
              <div>
                <p className="text-lg font-black text-foreground">
                  {streakData.currentStreak}
                  <span className="text-xs text-amber-500 ml-0.5">🔥</span>
                </p>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Day Streak</p>
              </div>
              <div>
                <p className="text-lg font-black text-foreground">{Math.round(streakData.totalMinutes || 0)}m</p>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total Time</p>
              </div>
              <div>
                <p className="text-lg font-black text-foreground">{streakData.totalTracks || 0}</p>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Songs Played</p>
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "all", label: "All Badges" },
              { id: "unlocked", label: `Unlocked (${unlockedCount})` },
              { id: "streak", label: "Streaks" },
              { id: "stories", label: "Stories & Epics" },
              { id: "audiophile", label: "Audiophile" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
                  selectedCategory === tab.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-chip text-muted-foreground hover:bg-chip-strong hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Badges List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredBadges.map((badge) => (
              <div
                key={badge.id}
                className={cn(
                  "p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 relative overflow-hidden",
                  badge.unlocked
                    ? "bg-card border-hair-strong hover:border-primary/40 shadow-xs"
                    : "bg-chip/50 border-hair/50 opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm",
                      badge.unlocked
                        ? `bg-gradient-to-tr ${badge.gradient}`
                        : "bg-chip text-muted-foreground border border-hair",
                    )}
                  >
                    {getIcon(badge.iconName)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs sm:text-sm font-bold text-foreground line-clamp-1">
                        {badge.title}
                      </h4>
                      {badge.unlocked ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                      {badge.description}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1 pt-1 border-t border-hair/40">
                  <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                    <span className="capitalize">{badge.tier} Tier</span>
                    <span className={badge.unlocked ? "text-emerald-500 font-bold" : ""}>
                      {badge.progressLabel}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-chip overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        badge.unlocked ? `bg-gradient-to-r ${badge.gradient}` : "bg-muted-foreground/40",
                      )}
                      style={{ width: `${badge.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Toast feedback */}
        {shareToast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-foreground text-background text-xs font-bold shadow-lg animate-in fade-in duration-150">
            Copied status to clipboard!
          </div>
        )}
      </div>
    </div>
  );
}
