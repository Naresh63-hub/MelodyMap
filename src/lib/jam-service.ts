/**
 * MelodyMap Jam Session Service
 *
 * Provides database operations, participant management, and collaborative queue
 * actions backed by Supabase PostgreSQL and Realtime.
 * Enforces authenticated identity verification and server-side RPC joining.
 */

import { supabase } from "./supabase";
import { generateJamCode } from "./jam-sync";
import type {
  JamSession,
  JamParticipant,
  JamQueueItem,
  JamSessionMode,
  JamPlaybackState,
} from "./jam-types";
import type { Track } from "./types";

export interface JamServiceResult<T> {
  data: T | null;
  error: string | null;
}

/**
 * Ensures the client has a real Supabase Auth session (via authenticated user or Anonymous Auth).
 * Fails closed if no auth is available.
 */
export async function ensureJamAuth(displayName?: string): Promise<{ userId: string; error: string | null }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user?.id) {
      return { userId: sessionData.session.user.id, error: null };
    }

    // Attempt Anonymous Sign-In for guest users
    if (typeof supabase.auth.signInAnonymously === "function") {
      const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            display_name: displayName || "Listener",
          },
        },
      });

      if (anonData?.user?.id) {
        return { userId: anonData.user.id, error: null };
      }
      if (anonErr) {
        console.warn("[JamAuth] signInAnonymously notice:", anonErr.message);
      }
    }
  } catch (err: any) {
    console.warn("[JamAuth] Auth resolution notice:", err?.message || err);
  }

  return {
    userId: "",
    error: "Please sign in to your MelodyMap account to start or join a Jam Session.",
  };
}

export const jamService = {
  /**
   * Create a new Jam session as host
   */
  async createSession(params: {
    hostId: string;
    hostName: string;
    hostAvatar?: string | null | undefined;
    title?: string | undefined;
    mode?: JamSessionMode | undefined;
    allowParticipantQueue?: boolean | undefined;
    initialTrack?: Track | null | undefined;
  }): Promise<JamServiceResult<{ session: JamSession; participant: JamParticipant }>> {
    try {
      const authRes = await ensureJamAuth(params.hostName);
      if (authRes.error || !authRes.userId) {
        return { data: null, error: authRes.error || "Authentication required to create a Jam session." };
      }
      const verifiedHostId = authRes.userId;
      const code = generateJamCode();
      const mode = params.mode ?? "host_controlled";
      const allowQueue = params.allowParticipantQueue ?? true;

      const { data: sessionData, error: sessionErr } = await supabase
        .from("jam_sessions")
        .insert({
          code,
          host_id: verifiedHostId,
          title: params.title || `${params.hostName}'s Jam`,
          mode,
          current_track_id: params.initialTrack?.id ?? null,
          current_track: params.initialTrack ?? null,
          playback_state: params.initialTrack ? "paused" : "idle",
          playback_position: 0,
          allow_participant_queue: allowQueue,
          is_active: true,
        })
        .select()
        .single();

      if (sessionErr || !sessionData) {
        if (sessionErr?.code === "PGRST205" || sessionErr?.message?.includes("jam_sessions")) {
          return {
            data: null,
            error: "Jam Session database tables are not installed yet. Please apply the migration in your Supabase SQL Editor.",
          };
        }
        return {
          data: null,
          error: sessionErr?.message || "Failed to create Jam session.",
        };
      }

      // Add host as first participant
      const { data: participantData, error: partErr } = await supabase
        .from("jam_participants")
        .insert({
          session_id: sessionData.id,
          user_id: verifiedHostId,
          display_name: params.hostName,
          avatar_url: params.hostAvatar ?? null,
          is_host: true,
          status: "active",
        })
        .select()
        .single();

      if (partErr || !participantData) {
        return {
          data: null,
          error: partErr?.message || "Failed to register host participant.",
        };
      }

      return {
        data: {
          session: sessionData as JamSession,
          participant: participantData as JamParticipant,
        },
        error: null,
      };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  /**
   * Join an existing Jam session using invitation code.
   * Exclusively routed through secure server-side join_jam_session RPC
   * to verify invitation code and grant membership without direct table INSERT bypass.
   */
  async joinSession(params: {
    code: string;
    userId: string;
    displayName: string;
    avatarUrl?: string | null | undefined;
  }): Promise<JamServiceResult<{ session: JamSession; participant: JamParticipant }>> {
    try {
      const cleanCode = params.code.trim().toUpperCase();
      const authRes = await ensureJamAuth(params.displayName);
      if (authRes.error || !authRes.userId) {
        return { data: null, error: authRes.error || "Authentication required to join a Jam session." };
      }

      // Route joining exclusively through secure server-side join_jam_session RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc("join_jam_session", {
        p_code: cleanCode,
        p_display_name: params.displayName,
        p_avatar_url: params.avatarUrl ?? null,
      });

      if (rpcErr) {
        if (rpcErr.code === "PGRST202" || rpcErr.message?.includes("join_jam_session")) {
          return {
            data: null,
            error: "Jam Session database functions are not installed yet. Please apply the migration in your Supabase SQL Editor.",
          };
        }
        if (rpcErr.message.includes("Jam session not found")) {
          return { data: null, error: "Jam session not found or has already ended." };
        }
        if (rpcErr.message.includes("Too many join attempts")) {
          return { data: null, error: "Too many join attempts. Please wait a minute before trying again." };
        }
        if (rpcErr.message.includes("Not authenticated")) {
          return { data: null, error: "Please sign in to your MelodyMap account to start or join a Jam Session." };
        }
        return { data: null, error: rpcErr.message || "Failed to join Jam session." };
      }

      if (!rpcData?.session || !rpcData?.participant) {
        return { data: null, error: "Jam session not found or has already ended." };
      }

      return {
        data: {
          session: rpcData.session as JamSession,
          participant: rpcData.participant as JamParticipant,
        },
        error: null,
      };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  /**
   * Fetch session participants
   */
  async getParticipants(sessionId: string): Promise<JamServiceResult<JamParticipant[]>> {
    try {
      const { data, error } = await supabase
        .from("jam_participants")
        .select()
        .eq("session_id", sessionId)
        .eq("status", "active")
        .order("joined_at", { ascending: true });

      if (error) return { data: null, error: error.message };
      return { data: (data as JamParticipant[]) || [], error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  /**
   * Fetch collaborative queue
   */
  async getQueue(sessionId: string): Promise<JamServiceResult<JamQueueItem[]>> {
    try {
      const { data, error } = await supabase
        .from("jam_queue")
        .select()
        .eq("session_id", sessionId)
        .order("position", { ascending: true });

      if (error) return { data: null, error: error.message };
      return { data: (data as JamQueueItem[]) || [], error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  /**
   * Update authoritative playback state (Host only)
   */
  async updatePlayback(params: {
    sessionId: string;
    playbackState: JamPlaybackState;
    playbackPosition: number;
    currentTrackId?: string | null | undefined;
    currentTrack?: Track | null | undefined;
  }): Promise<JamServiceResult<JamSession>> {
    try {
      const patch: Record<string, unknown> = {
        playback_state: params.playbackState,
        playback_position: Math.max(0, params.playbackPosition),
        playback_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (params.currentTrackId !== undefined) {
        patch["current_track_id"] = params.currentTrackId;
      }
      if (params.currentTrack !== undefined) {
        patch["current_track"] = params.currentTrack;
      }

      const { data, error } = await supabase
        .from("jam_sessions")
        .update(patch)
        .eq("id", params.sessionId)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: data as JamSession, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  /**
   * Add a song to the collaborative queue
   */
  async addToQueue(params: {
    sessionId: string;
    track: Track;
    addedById: string;
    addedByName: string;
    addedByAvatar?: string | null | undefined;
  }): Promise<JamServiceResult<JamQueueItem>> {
    try {
      const authRes = await ensureJamAuth(params.addedByName);
      const verifiedAddedById = authRes.userId || params.addedById;

      // 1. Duplicate check within active jam queue
      const { data: existing } = await supabase
        .from("jam_queue")
        .select("id")
        .eq("session_id", params.sessionId)
        .eq("track_id", params.track.id)
        .maybeSingle();

      if (existing) {
        return { data: null, error: "This track is already in the Jam queue." };
      }

      // 2. Determine highest position
      const { data: queueItems } = await supabase
        .from("jam_queue")
        .select("position")
        .eq("session_id", params.sessionId)
        .order("position", { ascending: false })
        .limit(1);

      const nextPosition = (queueItems?.[0]?.position ?? -1) + 1;

      const { data, error } = await supabase
        .from("jam_queue")
        .insert({
          session_id: params.sessionId,
          track_id: params.track.id,
          track: params.track,
          added_by_id: verifiedAddedById,
          added_by_name: params.addedByName,
          added_by_avatar: params.addedByAvatar ?? null,
          position: nextPosition,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505" || error.message.includes("uq_jam_queue")) {
          return { data: null, error: "This track is already in the Jam queue." };
        }
        return { data: null, error: error.message };
      }
      return { data: data as JamQueueItem, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  /**
   * Remove a song from the collaborative queue
   */
  async removeFromQueue(params: {
    sessionId: string;
    queueItemId: string;
    requesterId: string;
    isHost: boolean;
  }): Promise<JamServiceResult<boolean>> {
    try {
      const authRes = await ensureJamAuth();
      const verifiedRequesterId = authRes.userId || params.requesterId;

      let query = supabase.from("jam_queue").delete().eq("id", params.queueItemId).eq("session_id", params.sessionId);

      // Non-hosts can only delete tracks they personally added
      if (!params.isHost) {
        query = query.eq("added_by_id", verifiedRequesterId);
      }

      const { error } = await query;
      if (error) return { data: false, error: error.message };
      return { data: true, error: null };
    } catch (err) {
      return { data: false, error: String(err) };
    }
  },

  /**
   * Cast an atomic, duplicate-safe skip vote for the active track.
   * Uses INSERT instead of UPSERT to avoid requiring UPDATE RLS policies.
   */
  async castSkipVote(params: {
    sessionId: string;
    trackId: string;
    participantId: string;
  }): Promise<JamServiceResult<{ votesCount: number }>> {
    try {
      const authRes = await ensureJamAuth();
      const verifiedParticipantId = authRes.userId || params.participantId;

      // Record vote atomically. Enforces unique constraint per session, track, participant.
      const { error: insertErr } = await supabase.from("jam_votes").insert({
        session_id: params.sessionId,
        track_id: params.trackId,
        participant_id: verifiedParticipantId,
      });

      // Code 23505 indicates duplicate vote — safely treated as idempotent success
      if (insertErr && insertErr.code !== "23505" && !insertErr.message?.includes("uq_jam_votes")) {
        return { data: null, error: insertErr.message };
      }

      // Count votes for this track
      const { count, error: countErr } = await supabase
        .from("jam_votes")
        .select("*", { count: "exact", head: true })
        .eq("session_id", params.sessionId)
        .eq("track_id", params.trackId);

      if (countErr) return { data: null, error: countErr.message };
      return { data: { votesCount: count ?? 1 }, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  /**
   * Atomically claims track advancement in PostgreSQL.
   * Consumes the votes and marks last_skipped_track_id in a single transaction.
   * Returns { claimed: true } if and only if this call successfully claimed the skip.
   */
  async claimSkipAdvancement(
    sessionId: string,
    trackId: string,
  ): Promise<JamServiceResult<{ claimed: boolean; votesCount?: number; required?: number; alreadySkipped?: boolean; reason?: string }>> {
    try {
      const authRes = await ensureJamAuth();
      if (authRes.error || !authRes.userId) {
        return { data: null, error: authRes.error || "Authentication required" };
      }

      const { data: rpcData, error: rpcErr } = await supabase.rpc("claim_jam_skip_advancement", {
        p_session_id: sessionId,
        p_track_id: trackId,
      });

      if (rpcErr) {
        return { data: null, error: rpcErr.message || "Failed to claim skip advancement." };
      }

      if (rpcData) {
        return {
          data: {
            claimed: Boolean(rpcData.claimed),
            votesCount: rpcData.votes_count,
            required: rpcData.required_votes,
            alreadySkipped: rpcData.reason === "already_skipped",
            reason: rpcData.reason,
          },
          error: null,
        };
      }

      return { data: { claimed: false }, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  /**
   * Read-only skip-vote threshold query for UI telemetry
   */
  async getSkipVoteStatus(
    sessionId: string,
    trackId: string,
  ): Promise<JamServiceResult<{ votesCount: number; required: number; thresholdReached: boolean }>> {
    try {
      // 1. Try server RPC first
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc("get_jam_skip_vote_status", {
          p_session_id: sessionId,
          p_track_id: trackId,
        });
        if (!rpcErr && rpcData) {
          return {
            data: {
              votesCount: rpcData.votes_count,
              required: rpcData.required_votes,
              thresholdReached: rpcData.threshold_reached,
            },
            error: null,
          };
        }
      } catch {
        // Fall back to direct queries under RLS
      }

      // 2. Direct database query fallback
      const [votesRes, partsRes] = await Promise.all([
        supabase
          .from("jam_votes")
          .select("*", { count: "exact", head: true })
          .eq("session_id", sessionId)
          .eq("track_id", trackId),
        supabase
          .from("jam_participants")
          .select("*", { count: "exact", head: true })
          .eq("session_id", sessionId)
          .eq("status", "active"),
      ]);

      const votesCount = votesRes.count ?? 0;
      const activeCount = partsRes.count ?? 1;
      const required = activeCount <= 1 ? 1 : activeCount === 2 ? 2 : Math.floor(activeCount / 2) + 1;

      return {
        data: {
          votesCount,
          required,
          thresholdReached: votesCount >= required,
        },
        error: null,
      };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },

  /**
   * Authoritatively verify skip-vote threshold against PostgreSQL state (backward compatible alias)
   */
  async verifySkipVoteThreshold(
    sessionId: string,
    trackId: string,
  ): Promise<JamServiceResult<{ votesCount: number; required: number; thresholdReached: boolean }>> {
    return this.getSkipVoteStatus(sessionId, trackId);
  },

  /**
   * Leave a Jam session
   */
  async leaveSession(params: {
    sessionId: string;
    userId: string;
    isHost: boolean;
  }): Promise<JamServiceResult<boolean>> {
    try {
      const authRes = await ensureJamAuth();
      const verifiedUserId = authRes.userId || params.userId;

      if (params.isHost) {
        // If host leaves, mark session as inactive
        await supabase
          .from("jam_sessions")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", params.sessionId);
      }

      const { error } = await supabase
        .from("jam_participants")
        .update({ status: "left", last_seen_at: new Date().toISOString() })
        .eq("session_id", params.sessionId)
        .eq("user_id", verifiedUserId);

      if (error) return { data: false, error: error.message };
      return { data: true, error: null };
    } catch (err) {
      return { data: false, error: String(err) };
    }
  },
};
