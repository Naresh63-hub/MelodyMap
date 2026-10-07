import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStreakBadge } from '@/lib/streak';

type Props = {
  className?: string;
};

export function StreakBadge({ className }: Props) {
  const badgeData = getStreakBadge();
  
  if (!badgeData) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider',
        className
      )}
      style={{
        backgroundColor: `${badgeData.color}20`,
        color: badgeData.color,
        border: `1px solid ${badgeData.color}40`,
      }}
    >
      <Flame className="h-3 w-3" />
      <span>{badgeData.badge}</span>
    </div>
  );
}
