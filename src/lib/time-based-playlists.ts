import type { Track } from '@/lib/library';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

interface TimeBasedPlaylist {
  time: TimeOfDay;
  label: string;
  energy: 'high' | 'medium' | 'low';
  valence: 'positive' | 'neutral' | 'negative';
}

const TIME_BASED_PLAYLISTS: TimeBasedPlaylist[] = [
  {
    time: 'morning',
    label: 'Morning Energy',
    energy: 'high',
    valence: 'positive',
  },
  {
    time: 'afternoon',
    label: 'Afternoon Focus',
    energy: 'medium',
    valence: 'positive',
  },
  {
    time: 'evening',
    label: 'Evening Chill',
    energy: 'low',
    valence: 'neutral',
  },
  {
    time: 'night',
    label: 'Night Wind Down',
    energy: 'low',
    valence: 'negative',
  },
];

export function getCurrentTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

export function getTimeBasedPlaylist(): TimeBasedPlaylist {
  const currentTime = getCurrentTimeOfDay();
  return TIME_BASED_PLAYLISTS.find(p => p.time === currentTime) || TIME_BASED_PLAYLISTS[0]!;
}

export function filterTracksByTimeOfDay(
  tracks: Track[],
  playlist: TimeBasedPlaylist
): Track[] {
  // Simple filtering based on energy/valence hints
  // In a real implementation, this would use actual audio features or metadata
  
  const energyKeywords = {
    high: ['energy', 'upbeat', 'party', 'dance', 'electronic', 'rock', 'pop'],
    medium: ['focus', 'chill', 'acoustic', 'folk', 'indie'],
    low: ['calm', 'ambient', 'sleep', 'relax', 'soft', 'classical'],
  };

  const valenceKeywords = {
    positive: ['happy', 'joy', 'love', 'bright', 'sunny', 'fun'],
    neutral: ['calm', 'neutral', 'mellow', 'chill'],
    negative: ['sad', 'melancholy', 'dark', 'slow', 'quiet'],
  };

  const energyWords = energyKeywords[playlist.energy] || [];
  const valenceWords = valenceKeywords[playlist.valence] || [];

  if (energyWords.length === 0 && valenceWords.length === 0) {
    return tracks.slice(0, 20); // Return first 20 if no keywords
  }

  return tracks.filter(track => {
    const titleLower = track.title.toLowerCase();
    const artistLower = track.artist.toLowerCase();
    
    const matchesEnergy = energyWords.some(word => 
      titleLower.includes(word) || artistLower.includes(word)
    );
    
    const matchesValence = valenceWords.some(word => 
      titleLower.includes(word) || artistLower.includes(word)
    );

    return matchesEnergy || matchesValence;
  }).slice(0, 20);
}
