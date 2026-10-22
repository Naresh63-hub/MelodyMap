import type { Track } from "./types";

export type JamSessionMode = "host_controlled" | "collaborative";
export type JamPlaybackState = "playing" | "paused" | "buffering" | "idle";
export type JamParticipantStatus = "active" | "disconnected" | "left";

export interface JamSession {
  id: string;
  code: string;
  host_id: string;
  title: string;
  mode: JamSessionMode;
  current_track_id: string | null;
  current_track: Track | null;
  playback_state: JamPlaybackState;
  playback_position: number;
  playback_updated_at: string;
  allow_participant_queue: boolean;
  allow_participant_control: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface JamParticipant {
  id: string;
  session_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_host: boolean;
  status: JamParticipantStatus;
  joined_at: string;
  last_seen_at: string;
}

export interface JamQueueItem {
  id: string;
  session_id: string;
  track_id: string;
  track: Track;
  added_by_id: string;
  added_by_name: string;
  added_by_avatar: string | null;
  position: number;
  created_at: string;
}

export interface JamVote {
  id: string;
  session_id: string;
  track_id: string;
  participant_id: string;
  created_at: string;
}

export interface JamPlaybackSyncPayload {
  session_id: string;
  sender_id: string;
  epoch: number;
  track_id: string | null;
  track: Track | null;
  playback_state: JamPlaybackState;
  playback_position: number;
  server_timestamp: number;
  sequence: number;
}

export interface JamSkipVotePayload {
  session_id: string;
  track_id: string;
  participant_id: string;
  total_votes: number;
  required_votes: number;
  skipped: boolean;
}
