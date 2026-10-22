import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { jamService } from "./jam-service";
import {
  calculatePlaybackSync,
  calculateSkipVoteThreshold,
  isStaleSyncEvent,
} from "./jam-sync";
import type {
  JamSession,
  JamParticipant,
  JamQueueItem,
  JamSessionMode,
  JamPlaybackSyncPayload,
} from "./jam-types";
import type { Track } from "./types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface UseJamSessionOptions {
  userId: string | null;
  userName?: string | undefined;
  userAvatar?: string | null | undefined;
  // Audio player handles
  currentTrackId?: string | undefined;
  currentTrack?: Track | undefined;
  playbackPosition: number;
  isPlaying: boolean;
  onPlaySong: (track: Track) => void;
  onSeek: (seconds: number) => void;
  onPause: () => void;
  onResume: () => void;
  onAdvanceTrack: () => void;
}

export function useJamSession(options: UseJamSessionOptions) {
  const [session, setSession] = useState<JamSession | null>(null);
  const [participant, setParticipant] = useState<JamParticipant | null>(null);
  const [participants, setParticipants] = useState<JamParticipant[]>([]);
  const [queue, setQueue] = useState<JamQueueItem[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Host disconnection state
  const [hostDisconnected, setHostDisconnected] = useState(false);
  const [hostGraceSeconds, setHostGraceSeconds] = useState(60);

  // Skip voting state
  const [skipVotes, setSkipVotes] = useState<{
    current: number;
    required: number;
    hasVoted: boolean;
  }>({ current: 0, required: 1, hasVoted: false });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const sessionRef = useRef<JamSession | null>(null);
  sessionRef.current = session;

  const participantRef = useRef<JamParticipant | null>(null);
  participantRef.current = participant;

  // Stable persistent guest ID for presence key and identity continuity
  const guestIdRef = useRef<string>("");
  if (!guestIdRef.current) {
    if (typeof window !== "undefined") {
      let stored = localStorage.getItem("melodymap.jam_guest_id");
      if (!stored) {
        stored = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        localStorage.setItem("melodymap.jam_guest_id", stored);
      }
      guestIdRef.current = stored;
    } else {
      guestIdRef.current = `guest-${Date.now()}`;
    }
  }

  const effectiveUserId = options.userId || guestIdRef.current;
  const isHost = session?.host_id === effectiveUserId;
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;

  const hostEpochRef = useRef<number>(Date.now());
  const lastBroadcastSeqRef = useRef<number>(0);
  const lastReceivedSeqRef = useRef<number>(0);
  const lastReceivedEpochRef = useRef<number>(0);
  const hostGraceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advancingTrackIdRef = useRef<string | null>(null);
  const claimedTrackIdsRef = useRef<Set<string>>(new Set());

  // Reset in-flight advancement lock when the active track changes
  useEffect(() => {
    advancingTrackIdRef.current = null;
  }, [options.currentTrackId]);

  // Clear host grace timer
  const clearGraceTimer = useCallback(() => {
    if (hostGraceTimerRef.current) {
      clearInterval(hostGraceTimerRef.current);
      hostGraceTimerRef.current = null;
    }
    setHostDisconnected(false);
    setHostGraceSeconds(60);
  }, []);

  // Refresh participants and queue
  const refreshSessionData = useCallback(async (sessionId: string) => {
    const [partsRes, queueRes] = await Promise.all([
      jamService.getParticipants(sessionId),
      jamService.getQueue(sessionId),
    ]);
    if (partsRes.data) setParticipants(partsRes.data);
    if (queueRes.data) setQueue(queueRes.data);
  }, []);

  // Broadcast playback state from host to all participants
  const broadcastPlayback = useCallback(
    (playbackState: "playing" | "paused" | "buffering" | "idle", pos?: number, track?: Track | null) => {
      const activeSession = sessionRef.current;
      if (!activeSession || !isHostRef.current || !channelRef.current) return;

      lastBroadcastSeqRef.current += 1;
      const targetPos = pos !== undefined ? pos : options.playbackPosition;
      const targetTrack = track !== undefined ? track : options.currentTrack ?? null;

      const payload: JamPlaybackSyncPayload = {
        session_id: activeSession.id,
        sender_id: activeSession.host_id,
        epoch: hostEpochRef.current,
        track_id: targetTrack?.id ?? null,
        track: targetTrack,
        playback_state: playbackState,
        playback_position: Math.max(0, targetPos),
        server_timestamp: Date.now(),
        sequence: lastBroadcastSeqRef.current,
      };

      // Ephemeral broadcast to participants
      void channelRef.current.send({
        type: "broadcast",
        event: "playback_sync",
        payload,
      });

      // Persist state to DB throttled
      void jamService.updatePlayback({
        sessionId: activeSession.id,
        playbackState,
        playbackPosition: targetPos,
        currentTrackId: targetTrack?.id ?? null,
        currentTrack: targetTrack,
      });
    },
    [options.playbackPosition, options.currentTrack],
  );

  // Helper: atomically claim skip advancement in PostgreSQL before host advances track
  const verifyAndAdvanceIfThresholdReached = useCallback(async () => {
    if (!isHostRef.current) return;
    const activeSession = sessionRef.current;
    const activeTrack = activeSession?.current_track;
    if (!activeSession || !activeTrack || !activeTrack.id) return;
    const targetTrackId = activeTrack.id;

    // 1. If this track is already in-flight or already claimed, abort immediately
    if (advancingTrackIdRef.current === targetTrackId || claimedTrackIdsRef.current.has(targetTrackId)) {
      return;
    }

    // 2. Acquire lock BEFORE awaiting the network call
    advancingTrackIdRef.current = targetTrackId;

    try {
      const claimRes = await jamService.claimSkipAdvancement(activeSession.id, targetTrackId);

      // 3. Stale response protection: verify track has not changed while awaiting RPC
      if (sessionRef.current?.current_track?.id !== targetTrackId || options.currentTrackId !== targetTrackId) {
        console.warn("[Jam] Ignored stale skip advancement response for track:", targetTrackId);
        advancingTrackIdRef.current = null;
        return;
      }

      if (claimRes.data?.claimed) {
        // Permanently mark this track as claimed in this session
        claimedTrackIdsRef.current.add(targetTrackId);
        options.onAdvanceTrack();
      } else {
        // If already skipped, record in claimed set; otherwise release lock so future votes can retry
        if (claimRes.data?.alreadySkipped) {
          claimedTrackIdsRef.current.add(targetTrackId);
        } else {
          advancingTrackIdRef.current = null;
        }
      }

      // Update vote count badge if available
      if (claimRes.data?.votesCount !== undefined && claimRes.data?.required !== undefined) {
        setSkipVotes({
          current: claimRes.data.votesCount,
          required: claimRes.data.required,
          hasVoted: false,
        });
      }
    } catch (err) {
      // Release lock on error so retries can happen
      if (advancingTrackIdRef.current === targetTrackId) {
        advancingTrackIdRef.current = null;
      }
    }
  }, [options.currentTrackId, options.onAdvanceTrack]);

  // Set up Realtime subscriptions when a session is active
  useEffect(() => {
    if (!session) {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      clearGraceTimer();
      return;
    }

    const sessionId = session.id;
    void refreshSessionData(sessionId);

    const channel = supabase.channel(`jam:${sessionId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: effectiveUserId },
      },
    });

    // 1. Non-authoritative broadcast telemetry hint
    // NOTE: Unverified client broadcasts are strictly decoupled from player execution.
    // Pause, resume, seek, and track switches are exclusively driven by server-authoritative
    // postgres_changes on jam_sessions below.
    channel.on(
      "broadcast",
      { event: "playback_sync" },
      (res: { payload?: JamPlaybackSyncPayload }) => {
        const payload = res.payload;
        if (!payload || isHostRef.current) return;

        // Verify message claims to come from host and not far in the future
        if (sessionRef.current && payload.sender_id !== sessionRef.current.host_id) return;
        if (payload.epoch && payload.epoch > Date.now() + 60000) return;

        // Sequence monotonicity tracking for passive UI telemetry only
        if (!isStaleSyncEvent(lastReceivedSeqRef.current, payload.sequence, lastReceivedEpochRef.current, payload.epoch)) {
          lastReceivedSeqRef.current = payload.sequence;
          lastReceivedEpochRef.current = payload.epoch;
        }
      },
    );

    // 2. Listen for skip vote broadcast UI hints
    // Host DOES NOT trust broadcast payload.thresholdReached; independently claims from database.
    channel.on(
      "broadcast",
      { event: "skip_vote" },
      (res: { payload?: { votes?: number; required?: number } }) => {
        void refreshSessionData(sessionId);
        if (res.payload?.votes !== undefined && res.payload?.required !== undefined) {
          setSkipVotes((prev) => ({
            ...prev,
            current: res.payload!.votes!,
            required: res.payload!.required!,
          }));
        }
        if (isHostRef.current) {
          void verifyAndAdvanceIfThresholdReached();
        }
      },
    );

    // 2b. Listen for queue_sync broadcast hints to reconcile queue state immediately
    channel.on("broadcast", { event: "queue_sync" }, () => {
      void jamService.getQueue(sessionId).then((res) => {
        if (res.data) setQueue(res.data);
      });
    });

    // 3. Presence tracking (live participant updates and host disconnection detection)
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const onlineUserIds = new Set(Object.keys(state));

      setParticipants((prev) =>
        prev.map((p) => ({
          ...p,
          status: onlineUserIds.has(p.user_id) ? "active" : "disconnected",
        })),
      );

      // Check if host is online
      const hostIsOnline = sessionRef.current ? onlineUserIds.has(sessionRef.current.host_id) : true;
      if (!hostIsOnline && !isHostRef.current) {
        // Start 60-second grace timer
        if (!hostGraceTimerRef.current) {
          setHostDisconnected(true);
          let remaining = 60;
          setHostGraceSeconds(remaining);
          hostGraceTimerRef.current = setInterval(() => {
            remaining -= 1;
            setHostGraceSeconds(remaining);
            if (remaining <= 0) {
              clearGraceTimer();
              options.onPause();
            }
          }, 1000);
        }
      } else {
        clearGraceTimer();
      }
    });

    // 4. Postgres Changes on jam_queue
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "jam_queue",
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        void jamService.getQueue(sessionId).then((res) => {
          if (res.data) setQueue(res.data);
        });
      },
    );

    // 5. Server-Authoritative Postgres Changes on jam_sessions
    // Because PostgreSQL RLS strictly limits UPDATE on jam_sessions to host_id = auth.uid(),
    // all database change events are 100% server-verified.
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "jam_sessions",
        filter: `id=eq.${sessionId}`,
      },
      (payload: { new?: JamSession }) => {
        const updated = payload.new;
        if (!updated || isHostRef.current) return;
        setSession(updated);

        // Host ended session
        if (!updated.is_active) {
          options.onPause();
          setError("The host has ended this Jam session.");
          return;
        }

        // Server-verified track change
        if (updated.current_track && updated.current_track.id !== options.currentTrackId) {
          options.onPlaySong(updated.current_track);
          return;
        }

        // Server-verified play/pause/drift alignment from trusted DB timestamp
        const syncCalc = calculatePlaybackSync({
          localCurrentTime: options.playbackPosition,
          isLocalPlaying: options.isPlaying,
          hostPosition: updated.playback_position,
          hostPlaybackState: updated.playback_state,
          hostUpdatedAtMs: new Date(updated.playback_updated_at).getTime(),
        });

        if (syncCalc.shouldSeek) {
          options.onSeek(syncCalc.targetPosition);
        }
        if (syncCalc.shouldPlay) {
          options.onResume();
        } else if (syncCalc.shouldPause) {
          options.onPause();
        }
      },
    );

    // 6. Server-Authoritative Postgres Changes on jam_votes
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "jam_votes",
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        if (isHostRef.current) {
          void verifyAndAdvanceIfThresholdReached();
        } else {
          void refreshSessionData(sessionId);
        }
      },
    );

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({
          user_id: effectiveUserId,
          display_name: options.userName,
          avatar_url: options.userAvatar ?? null,
          is_host: isHostRef.current,
          joined_at: new Date().toISOString(),
        });
      }
    });

    channelRef.current = channel;

    return () => {
      clearGraceTimer();
      advancingTrackIdRef.current = null;
      claimedTrackIdsRef.current.clear();
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [
    session?.id,
    options.userId,
    options.userName,
    options.userAvatar,
    options.currentTrackId,
    options.playbackPosition,
    options.isPlaying,
    options.onPlaySong,
    options.onSeek,
    options.onPause,
    options.onResume,
    refreshSessionData,
    clearGraceTimer,
    verifyAndAdvanceIfThresholdReached,
  ]);

  // Host: periodically sync playback state (every 4s while playing)
  useEffect(() => {
    if (!session || !isHost || !options.isPlaying) return;
    const interval = setInterval(() => {
      broadcastPlayback("playing", options.playbackPosition);
    }, 4000);
    return () => clearInterval(interval);
  }, [session, isHost, options.isPlaying, options.playbackPosition, broadcastPlayback]);

  // Host playback actions
  const notifyPlay = useCallback(
    (pos?: number, track?: Track | null) => {
      broadcastPlayback("playing", pos, track);
    },
    [broadcastPlayback],
  );

  const notifyPause = useCallback(
    (pos?: number) => {
      broadcastPlayback("paused", pos);
    },
    [broadcastPlayback],
  );

  const notifySeek = useCallback(
    (pos: number) => {
      broadcastPlayback(options.isPlaying ? "playing" : "paused", pos);
    },
    [broadcastPlayback, options.isPlaying],
  );

  // Actions for UI
  const createJam = useCallback(
    async (params?: { title?: string | undefined; mode?: JamSessionMode | undefined; allowQueue?: boolean | undefined }) => {
      setIsConnecting(true);
      setError(null);
      const res = await jamService.createSession({
        hostId: effectiveUserId,
        hostName: options.userName || "Listener",
        hostAvatar: options.userAvatar,
        title: params?.title,
        mode: params?.mode,
        allowParticipantQueue: params?.allowQueue,
        initialTrack: options.currentTrack ?? null,
      });
      setIsConnecting(false);
      if (res.error || !res.data) {
        setError(res.error || "Failed to create Jam.");
        return false;
      }
      setSession(res.data.session);
      setParticipant(res.data.participant);
      return true;
    },
    [effectiveUserId, options.userName, options.userAvatar, options.currentTrack],
  );

  const joinJam = useCallback(
    async (code: string) => {
      setIsConnecting(true);
      setError(null);
      const res = await jamService.joinSession({
        code,
        userId: effectiveUserId,
        displayName: options.userName || "Listener",
        avatarUrl: options.userAvatar,
      });
      setIsConnecting(false);
      if (res.error || !res.data) {
        setError(res.error || "Failed to join Jam.");
        return false;
      }
      setSession(res.data.session);
      setParticipant(res.data.participant);

      // If session currently has an active track, start it locally and align playback
      if (res.data.session.current_track) {
        options.onPlaySong(res.data.session.current_track);
        const elapsed = res.data.session.playback_state === "playing"
          ? Math.max(0, (Date.now() - new Date(res.data.session.playback_updated_at).getTime()) / 1000)
          : 0;
        const initialPos = Math.max(0, res.data.session.playback_position + elapsed);
        if (initialPos > 0) {
          setTimeout(() => {
            options.onSeek(initialPos);
          }, 350);
        }
      }
      return true;
    },
    [effectiveUserId, options.userName, options.userAvatar, options.onPlaySong, options.onSeek],
  );

  const leaveJam = useCallback(async () => {
    if (!session || !participant) return;
    await jamService.leaveSession({
      sessionId: session.id,
      userId: participant.user_id,
      isHost,
    });
    setSession(null);
    setParticipant(null);
    setParticipants([]);
    setQueue([]);
    clearGraceTimer();
  }, [session, participant, isHost, clearGraceTimer]);

  const addToJamQueue = useCallback(
    async (track: Track) => {
      if (!session || !participant) return { success: false, error: "Not in a Jam session" };
      const res = await jamService.addToQueue({
        sessionId: session.id,
        track,
        addedById: participant.user_id,
        addedByName: participant.display_name,
        addedByAvatar: participant.avatar_url,
      });
      if (res.data) {
        setQueue((prev) => [...prev, res.data!]);
        // Ephemeral broadcast hint for peer UI reconciliation
        void channelRef.current?.send({
          type: "broadcast",
          event: "queue_sync",
        });
        return { success: true, error: null };
      }
      return { success: false, error: res.error };
    },
    [session, participant],
  );

  const removeFromJamQueue = useCallback(
    async (queueItemId: string) => {
      if (!session || !participant) return;
      await jamService.removeFromQueue({
        sessionId: session.id,
        queueItemId,
        requesterId: participant.user_id,
        isHost,
      });
      setQueue((prev) => prev.filter((item) => item.id !== queueItemId));
      // Ephemeral broadcast hint for peer UI reconciliation
      void channelRef.current?.send({
        type: "broadcast",
        event: "queue_sync",
      });
    },
    [session, participant, isHost],
  );

  const voteToSkip = useCallback(async () => {
    if (!session || !participant || !options.currentTrackId) return;
    const activeTrackId = options.currentTrackId;
    const res = await jamService.castSkipVote({
      sessionId: session.id,
      trackId: activeTrackId,
      participantId: participant.user_id,
    });
    if (res.data) {
      const activeCount = Math.max(1, participants.filter((p) => p.status === "active").length);
      const threshold = calculateSkipVoteThreshold(activeCount);
      const votes = res.data.votesCount;
      const thresholdReached = votes >= threshold;
      setSkipVotes({ current: votes, required: threshold, hasVoted: true });

      // Notify host and all participants of the updated skip vote UI hint
      void channelRef.current?.send({
        type: "broadcast",
        event: "skip_vote",
        payload: {
          votes,
          required: threshold,
          thresholdReached,
        },
      });

      // If the local user is the host, claim advancement atomically in PostgreSQL
      if (isHostRef.current) {
        void verifyAndAdvanceIfThresholdReached();
      }
    }
  }, [session, participant, options.currentTrackId, participants, verifyAndAdvanceIfThresholdReached]);

  return {
    session,
    participant,
    participants,
    queue,
    isHost,
    isConnecting,
    error,
    hostDisconnected,
    hostGraceSeconds,
    skipVotes,
    createJam,
    joinJam,
    leaveJam,
    addToJamQueue,
    removeFromJamQueue,
    voteToSkip,
    notifyPlay,
    notifyPause,
    notifySeek,
  };
}
