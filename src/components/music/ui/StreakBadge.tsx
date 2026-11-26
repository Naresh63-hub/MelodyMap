import { useState } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStreakBadge } from "@/lib/streak";
import { BadgesModal } from "./BadgesModal";

type Props = {
  className?: string;
};

export function StreakBadge({ className }: Props) {
  const [showBadges, setShowBadges] = useState(false);
  const badgeData = getStreakBadge();

  if (!badgeData) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowBadges(true)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer",
          className,
        )}
        style={{
          backgroundColor: `${badgeData.color}20`,
          color: badgeData.color,
          border: `1px solid ${badgeData.color}40`,
        }}
        title="Tap to view your Listener Achievements & Top 1% rank"
      >
        <Flame className="h-3 w-3" />
        <span>{badgeData.badge}</span>
      </button>

      <BadgesModal open={showBadges} onClose={() => setShowBadges(false)} />
    </>
  );
}
