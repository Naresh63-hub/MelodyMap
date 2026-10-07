import { Music, Headphones, Zap, Heart, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PersonalityType = 
  | 'explorer'
  | 'loyalist'
  | 'vibe_seeker'
  | 'chart_topper'
  | 'deep_diver'
  | 'variety_lover';

interface PersonalityProfile {
  type: PersonalityType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const PERSONALITIES: Record<PersonalityType, PersonalityProfile> = {
  explorer: {
    type: 'explorer',
    label: 'Explorer',
    description: 'You love discovering new artists and genres',
    icon: Music,
    color: '#22c55e',
  },
  loyalist: {
    type: 'loyalist',
    label: 'Loyalist',
    description: 'You stick with your favorite artists',
    icon: Heart,
    color: '#ef4444',
  },
  vibe_seeker: {
    type: 'vibe_seeker',
    label: 'Vibe Seeker',
    description: 'You curate playlists by mood and energy',
    icon: Headphones,
    color: '#8b5cf6',
  },
  chart_topper: {
    type: 'chart_topper',
    label: 'Chart Topper',
    description: 'You love trending and popular music',
    icon: TrendingUp,
    color: '#f59e0b',
  },
  deep_diver: {
    type: 'deep_diver',
    label: 'Deep Diver',
    description: 'You explore album cuts and deep catalogs',
    icon: Clock,
    color: '#3b82f6',
  },
  variety_lover: {
    type: 'variety_lover',
    label: 'Variety Lover',
    description: 'You enjoy all genres and styles',
    icon: Zap,
    color: '#ec4899',
  },
};

interface Stats {
  uniqueArtists: number;
  totalTracks: number;
  avgListenDuration: number;
  skipRate: number;
  likeRate: number;
}

export function calculatePersonality(stats: Stats): PersonalityType {
  const { uniqueArtists, totalTracks, avgListenDuration, skipRate, likeRate } = stats;
  
  const artistRatio = uniqueArtists / Math.max(1, totalTracks);
  const avgDuration = avgListenDuration; // in seconds
  
  // Explorer: High artist diversity, moderate listen time
  if (artistRatio > 0.6 && avgDuration > 30) {
    return 'explorer';
  }
  
  // Loyalist: Low artist diversity, high like rate
  if (artistRatio < 0.3 && likeRate > 0.5) {
    return 'loyalist';
  }
  
  // Vibe Seeker: Long listen times, moderate diversity
  if (avgDuration > 120 && artistRatio > 0.3) {
    return 'vibe_seeker';
  }
  
  // Chart Topper: High like rate, low skip rate
  if (likeRate > 0.4 && skipRate < 0.2) {
    return 'chart_topper';
  }
  
  // Deep Diver: Very long listen times
  if (avgDuration > 180) {
    return 'deep_diver';
  }
  
  // Variety Lover: High diversity, mixed listening patterns
  if (artistRatio > 0.5) {
    return 'variety_lover';
  }
  
  return 'explorer'; // Default
}

type Props = {
  stats: Stats;
  className?: string;
};

export function ListeningPersonality({ stats, className }: Props) {
  const personality = calculatePersonality(stats);
  const profile = PERSONALITIES[personality];
  const Icon = profile.icon;

  return (
    <div
      className={cn(
        'rounded-2xl p-4 border',
        className
      )}
      style={{
        backgroundColor: `${profile.color}10`,
        borderColor: `${profile.color}30`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: `${profile.color}20` }}
        >
          <Icon className="h-5 w-5" style={{ color: profile.color }} />
        </div>
        
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground leading-tight">
            {profile.label}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            {profile.description}
          </p>
        </div>
      </div>
      
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-card/50 rounded-lg p-2 text-center">
          <div className="font-semibold text-foreground">{stats.uniqueArtists}</div>
          <div className="text-muted-foreground">Artists</div>
        </div>
        <div className="bg-card/50 rounded-lg p-2 text-center">
          <div className="font-semibold text-foreground">{Math.round(stats.avgListenDuration)}s</div>
          <div className="text-muted-foreground">Avg Listen</div>
        </div>
      </div>
    </div>
  );
}
