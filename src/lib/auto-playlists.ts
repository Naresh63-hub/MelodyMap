import type { Track } from '@/lib/library';
import { filterTracksByTimeOfDay, type TimeOfDay } from './time-based-playlists';

export type AutoPlaylistType = 
  | 'discover_weekly'
  | 'release_radar'
  | 'daily_mix'
  | 'time_based'
  | 'liked_tracks'
  | 'most_played'
  | 'similar_artist'
  | 'throwback';

export interface AutoPlaylist {
  id: AutoPlaylistType;
  name: string;
  description: string;
  icon: string;
  generate: (allTracks: Track[], userContext: UserContext) => Track[];
}

export interface UserContext {
  likedTracks: Track[];
  recentlyPlayed: Track[];
  followArtists: string[];
  currentTimeOfDay?: TimeOfDay;
  targetArtist?: string;
}

const AUTO_PLAYLISTS: Record<AutoPlaylistType, AutoPlaylist> = {
  discover_weekly: {
    id: 'discover_weekly',
    name: 'Discover Weekly',
    description: 'New music tailored to your taste',
    icon: '✨',
    generate: (allTracks, ctx) => {
      const likedIds = new Set(ctx.likedTracks.map(t => t.id));
      const likedArtists = new Set(ctx.likedTracks.map(t => t.artist.toLowerCase()));
      
      const similarArtistTracks = allTracks.filter(
        track => !likedIds.has(track.id) && likedArtists.has(track.artist.toLowerCase())
      );
      
      const shuffled = similarArtistTracks.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 30);
    },
  },
  
  release_radar: {
    id: 'release_radar',
    name: 'Release Radar',
    description: 'New releases from artists you follow',
    icon: '📡',
    generate: (allTracks, ctx) => {
      const followedArtistSet = new Set(ctx.followArtists.map(a => a.toLowerCase()));
      const artistTracks = allTracks.filter(track =>
        followedArtistSet.has(track.artist.toLowerCase())
      );
      const shuffled = artistTracks.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 20);
    },
  },
  
  daily_mix: {
    id: 'daily_mix',
    name: 'Daily Mix',
    description: 'Your daily blend of favorites',
    icon: '🎵',
    generate: (allTracks, ctx) => {
      const likedIds = new Set(ctx.likedTracks.map(t => t.id));
      const mix = [...ctx.likedTracks];
      
      // Add some from recently played
      const recentNotLiked = ctx.recentlyPlayed.filter(t => !likedIds.has(t.id));
      mix.push(...recentNotLiked.slice(0, 10));
      
      // Add similar tracks
      const likedArtists = new Set(ctx.likedTracks.map(t => t.artist.toLowerCase()));
      const similar = allTracks.filter(
        track => !likedIds.has(track.id) && likedArtists.has(track.artist.toLowerCase())
      );
      mix.push(...similar.slice(0, 15));
      
      const shuffled = mix.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 30);
    },
  },
  
  time_based: {
    id: 'time_based',
    name: 'Time-Based Mix',
    description: 'Music for right now',
    icon: '⏰',
    generate: (allTracks, ctx) => {
      const timeOfDay = ctx.currentTimeOfDay || 'morning';
      const playlist = {
        time: timeOfDay,
        label: 'Current Time',
        energy: 'medium' as const,
        valence: 'positive' as const,
      };
      return filterTracksByTimeOfDay(allTracks, playlist);
    },
  },
  
  liked_tracks: {
    id: 'liked_tracks',
    name: 'Liked Songs',
    description: 'All your favorites in one place',
    icon: '❤️',
    generate: (allTracks, ctx) => {
      return ctx.likedTracks;
    },
  },
  
  most_played: {
    id: 'most_played',
    name: 'Most Played',
    description: 'Your top tracks',
    icon: '🔥',
    generate: (allTracks, ctx) => {
      // Count plays from recently played
      const playCounts = new Map<string, number>();
      ctx.recentlyPlayed.forEach(track => {
        playCounts.set(track.id, (playCounts.get(track.id) || 0) + 1);
      });
      
      const sorted = allTracks
        .filter(track => playCounts.has(track.id))
        .sort((a, b) => (playCounts.get(b.id) || 0) - (playCounts.get(a.id) || 0));
      
      return sorted.slice(0, 50);
    },
  },
  
  similar_artist: {
    id: 'similar_artist',
    name: 'Similar Artist Radio',
    description: 'Based on current artist',
    icon: '📻',
    generate: (allTracks, ctx) => {
      if (!ctx.targetArtist) return [];
      
      const targetLower = ctx.targetArtist.toLowerCase();
      const similar = allTracks.filter(
        track => track.artist.toLowerCase() === targetLower ||
                 track.artist.toLowerCase().includes(targetLower.split(' ')[0])
      );
      
      const shuffled = similar.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 25);
    },
  },
  
  throwback: {
    id: 'throwback',
    name: 'Throwback Hits',
    description: 'Classic tracks from the past',
    icon: '📼',
    generate: (allTracks, ctx) => {
      // Filter for tracks with classic/retro keywords in title
      const keywords = ['classic', 'retro', 'old', 'vintage', 'hits', 'best', 'greatest'];
      const throwbackTracks = allTracks.filter(track =>
        keywords.some(keyword => 
          track.title.toLowerCase().includes(keyword) ||
          track.artist.toLowerCase().includes(keyword)
        )
      );
      
      const shuffled = throwbackTracks.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 25);
    },
  },
};

export function generateAutoPlaylist(
  type: AutoPlaylistType,
  allTracks: Track[],
  userContext: UserContext
): Track[] {
  const playlist = AUTO_PLAYLISTS[type];
  if (!playlist) return [];
  return playlist.generate(allTracks, userContext);
}

export function getAllAutoPlaylists(): AutoPlaylist[] {
  return Object.values(AUTO_PLAYLISTS);
}
