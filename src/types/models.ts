// Shared domain types for the music player application

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  thumbnail?: string;
  source?: 'youtube' | 'deezer' | 'local';
}

export interface User {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string | null;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  created_at: string;
  updated_at: string;
}

export interface LibraryStats {
  totalPlays: number;
  totalSkips: number;
  totalLikes: number;
  mostPlayedArtists: string[];
  averageSessionLength: number;
}

export interface PlaybackState {
  queue: Track[];
  currentIndex: number;
  position: number;
  isPlaying: boolean;
  volume: number;
}

export interface RecommendationSettings {
  languages: string[];
  moods: string[];
  energyLevel: number;
  noveltyLevel: number;
  artists: string[];
}