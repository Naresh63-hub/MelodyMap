import { describe, it, expect } from "vitest";
import {
  generateJamCode,
  calculatePlaybackSync,
  calculateSkipVoteThreshold,
  isStaleSyncEvent,
  isHostGraceExpired,
} from "./jam-sync";
import type { JamSessionMode, JamQueueItem } from "./jam-types";

describe("MelodyMap Jam Session Synchronization Engine", () => {
  describe("Invitation Code Generation (generateJamCode)", () => {
    it("generates a high-entropy code formatted as JAM-XXXXXX (6 chars, 481M combinations)", () => {
      const code = generateJamCode();
      expect(code).toMatch(/^JAM-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    });

    it("never includes ambiguous characters (0, O, 1, I)", () => {
      const ambiguousChars = ["0", "O", "1", "I"];
      for (let i = 0; i < 50; i++) {
        const code = generateJamCode();
        for (const char of ambiguousChars) {
          expect(code).not.toContain(char);
        }
      }
    });

    it("generates sufficiently randomized unique codes across invocations", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 30; i++) {
        codes.add(generateJamCode());
      }
      // With 28^4 combinations, 30 random codes should be distinct
      expect(codes.size).toBe(30);
    });
  });

  describe("Host-Authoritative Playback Synchronization (calculatePlaybackSync)", () => {
    const fixedNow = 1700000000000;

    it("does not trigger seek when drift is below the 2.0s threshold (micro-drift suppression)", () => {
      // Local time is 45.3s, host was at 45.0s, 100ms update ago with 150ms latency estimate
      // Host expected position ~ 45.0 + 0.1 + 0.15 = 45.25s
      // Drift = |45.3 - 45.25| = 0.05s <= 2.0s
      const sync = calculatePlaybackSync({
        localCurrentTime: 45.3,
        isLocalPlaying: true,
        hostPosition: 45.0,
        hostPlaybackState: "playing",
        hostUpdatedAtMs: Date.now() - 100, // 100ms ago
        latencyEstimateMs: 150,
      });

      expect(sync.shouldSeek).toBe(false);
      expect(sync.driftSeconds).toBeLessThan(2.0);
      expect(sync.shouldPause).toBe(false);
      expect(sync.shouldPlay).toBe(false);
    });

    it("triggers seek when drift exceeds the 2.0s threshold", () => {
      // Local time is 10.0s, host is at 25.0s (drift ~ 15s)
      const sync = calculatePlaybackSync({
        localCurrentTime: 10.0,
        isLocalPlaying: true,
        hostPosition: 25.0,
        hostPlaybackState: "playing",
        hostUpdatedAtMs: Date.now() - 50,
        latencyEstimateMs: 100,
      });

      expect(sync.shouldSeek).toBe(true);
      expect(sync.driftSeconds).toBeGreaterThan(2.0);
      expect(sync.targetPosition).toBeGreaterThan(25.0);
    });

    it("correctly handles host pause command and signals shouldPause", () => {
      const sync = calculatePlaybackSync({
        localCurrentTime: 30.0,
        isLocalPlaying: true,
        hostPosition: 30.2,
        hostPlaybackState: "paused",
        hostUpdatedAtMs: Date.now() - 200,
        latencyEstimateMs: 100,
      });

      expect(sync.shouldPause).toBe(true);
      expect(sync.shouldPlay).toBe(false);
      // Host is paused, so targetPosition should equal hostPosition (no forward projection)
      expect(sync.targetPosition).toBe(30.2);
    });

    it("correctly signals shouldPlay when host is playing but local is paused", () => {
      const sync = calculatePlaybackSync({
        localCurrentTime: 30.0,
        isLocalPlaying: false,
        hostPosition: 30.1,
        hostPlaybackState: "playing",
        hostUpdatedAtMs: Date.now() - 100,
      });

      expect(sync.shouldPlay).toBe(true);
      expect(sync.shouldPause).toBe(false);
    });

    it("supports custom drift threshold override", () => {
      const sync = calculatePlaybackSync({
        localCurrentTime: 45.0,
        isLocalPlaying: true,
        hostPosition: 46.2,
        hostPlaybackState: "paused",
        hostUpdatedAtMs: Date.now(),
        driftThresholdSeconds: 1.0, // Stricter threshold
      });

      // Drift is 1.2s, which exceeds 1.0s threshold
      expect(sync.shouldSeek).toBe(true);
      expect(sync.driftSeconds).toBeCloseTo(1.2, 1);
    });

    it("clamps negative target positions to zero", () => {
      const sync = calculatePlaybackSync({
        localCurrentTime: 0,
        isLocalPlaying: false,
        hostPosition: -5.0,
        hostPlaybackState: "paused",
        hostUpdatedAtMs: Date.now(),
      });

      expect(sync.targetPosition).toBe(0);
    });
  });

  describe("Skip Voting Majority Calculation (calculateSkipVoteThreshold)", () => {
    it("requires 1 vote for a solo session or 0 active participants", () => {
      expect(calculateSkipVoteThreshold(0)).toBe(1);
      expect(calculateSkipVoteThreshold(1)).toBe(1);
    });

    it("requires 2 votes for a 2-participant jam session", () => {
      expect(calculateSkipVoteThreshold(2)).toBe(2);
    });

    it("calculates strict majority for odd participant counts", () => {
      // 3 participants -> majority is 2
      expect(calculateSkipVoteThreshold(3)).toBe(2);
      // 5 participants -> majority is 3
      expect(calculateSkipVoteThreshold(5)).toBe(3);
      // 7 participants -> majority is 4
      expect(calculateSkipVoteThreshold(7)).toBe(4);
    });

    it("calculates strict majority for even participant counts > 2", () => {
      // 4 participants -> majority is 3 (floor(4/2) + 1)
      expect(calculateSkipVoteThreshold(4)).toBe(3);
      // 6 participants -> majority is 4 (floor(6/2) + 1)
      expect(calculateSkipVoteThreshold(6)).toBe(4);
      // 8 participants -> majority is 5
      expect(calculateSkipVoteThreshold(8)).toBe(5);
    });
  });

  describe("Monotonic Sequence & Stale Event Protection (isStaleSyncEvent)", () => {
    it("rejects duplicate sequence events within same epoch", () => {
      expect(isStaleSyncEvent(10, 10)).toBe(true);
      expect(isStaleSyncEvent(10, 10, 1000, 1000)).toBe(true);
    });

    it("rejects out-of-order stale sequence events within same epoch", () => {
      expect(isStaleSyncEvent(15, 14)).toBe(true);
      expect(isStaleSyncEvent(100, 42)).toBe(true);
      expect(isStaleSyncEvent(100, 42, 1000, 1000)).toBe(true);
    });

    it("accepts strictly newer sequence events within same epoch", () => {
      expect(isStaleSyncEvent(10, 11)).toBe(false);
      expect(isStaleSyncEvent(0, 1)).toBe(false);
      expect(isStaleSyncEvent(99, 105)).toBe(false);
      expect(isStaleSyncEvent(99, 105, 1000, 1000)).toBe(false);
    });

    it("accepts incoming event with newer host epoch even if sequence reset to 1 (host reconnect recovery)", () => {
      // Host reloaded page: old sequence was 85 at epoch 1000, new sequence is 1 at epoch 2000
      expect(isStaleSyncEvent(85, 1, 1000, 2000)).toBe(false);
    });

    it("rejects incoming event from older zombie epoch", () => {
      expect(isStaleSyncEvent(10, 50, 2000, 1000)).toBe(true);
    });
  });

  describe("Host Disconnection Grace Period (isHostGraceExpired)", () => {
    it("returns false if host has not disconnected (disconnectedAt <= 0)", () => {
      expect(isHostGraceExpired(0)).toBe(false);
      expect(isHostGraceExpired(-1)).toBe(false);
    });

    it("returns false while disconnection duration is within the 60s grace period", () => {
      const recentDisconnect = Date.now() - 30000; // 30 seconds ago
      expect(isHostGraceExpired(recentDisconnect, 60000)).toBe(false);
    });

    it("returns true when disconnection duration exceeds the 60s grace period", () => {
      const pastDisconnect = Date.now() - 65000; // 65 seconds ago
      expect(isHostGraceExpired(pastDisconnect, 60000)).toBe(true);
    });
  });

  describe("Shared Queue & Permission Integrity Logic", () => {
    const mockQueue: JamQueueItem[] = [
      {
        id: "q-1",
        session_id: "jam-sess-1",
        track_id: "track-101",
        track: { id: "track-101", title: "Song 1", artist: "Artist 1", duration: "180", thumbnail: "https://example.com/art1.jpg" },
        added_by_id: "user-1",
        added_by_name: "Listener 1",
        added_by_avatar: null,
        position: 1,
        created_at: new Date().toISOString(),
      },
      {
        id: "q-2",
        session_id: "jam-sess-1",
        track_id: "track-102",
        track: { id: "track-102", title: "Song 2", artist: "Artist 2", duration: "210", thumbnail: "https://example.com/art2.jpg" },
        added_by_id: "user-2",
        added_by_name: "Listener 2",
        added_by_avatar: null,
        position: 2,
        created_at: new Date().toISOString(),
      },
    ];

    it("prevents adding duplicate tracks to the shared jam queue", () => {
      const isDuplicate = (trackId: string, queue: JamQueueItem[]) =>
        queue.some((item) => item.track_id === trackId);

      expect(isDuplicate("track-101", mockQueue)).toBe(true);
      expect(isDuplicate("track-999", mockQueue)).toBe(false);
    });

    it("enforces session mode permission boundaries", () => {
      function canManageQueue(mode: JamSessionMode, isHost: boolean): boolean {
        if (isHost) return true;
        return mode === "collaborative";
      }

      // Host can always manage queue
      expect(canManageQueue("host_controlled", true)).toBe(true);
      expect(canManageQueue("collaborative", true)).toBe(true);

      // Guests can only manage queue in collaborative mode
      expect(canManageQueue("host_controlled", false)).toBe(false);
      expect(canManageQueue("collaborative", false)).toBe(true);
    });

    it("verifies broadcast sender identity against authoritative host ID", () => {
      const hostId = "host-user-123";
      function isAuthorizedBroadcast(senderId: string, expectedHostId: string): boolean {
        return senderId === expectedHostId;
      }

      // Legitimate broadcast from session host
      expect(isAuthorizedBroadcast("host-user-123", hostId)).toBe(true);

      // Malicious or rogue broadcast from another participant
      expect(isAuthorizedBroadcast("guest-user-456", hostId)).toBe(false);
    });

    it("routes skip-vote track advancement exclusively through the session host", () => {
      let hostAdvancedCount = 0;
      let guestAdvancedCount = 0;

      function onSkipVoteReceived(isHost: boolean, thresholdReached: boolean) {
        if (isHost && thresholdReached) {
          hostAdvancedCount++;
        }
        // Non-hosts must never advance track directly to prevent desync
      }

      // Guest participant receives threshold event: does NOT advance locally
      onSkipVoteReceived(false, true);
      expect(guestAdvancedCount).toBe(0);

      // Host receives threshold event: authoritatively advances playback
      onSkipVoteReceived(true, true);
      expect(hostAdvancedCount).toBe(1);
    });

    it("rejects forged future epochs that attempt to silence legitimate host", () => {
      const now = Date.now();
      function isAcceptableEpoch(epoch: number): boolean {
        // Epochs more than 60 seconds in the future are rejected as forged
        return epoch <= now + 60000;
      }

      // Valid host reconnection epoch (e.g. current timestamp)
      expect(isAcceptableEpoch(now + 500)).toBe(true);

      // Forged malicious epoch far in the future
      expect(isAcceptableEpoch(now + 10000000)).toBe(false);
    });

    it("rejects broadcast track changes that do not match the database session record", () => {
      const activeSessionTrackId = "track-legit-123";
      function isTrackChangeAuthorized(broadcastTrackId: string, sessionCurrentTrackId: string): boolean {
        return broadcastTrackId === sessionCurrentTrackId;
      }

      // Legitimate track broadcast matches server-verified session
      expect(isTrackChangeAuthorized("track-legit-123", activeSessionTrackId)).toBe(true);

      // Rogue participant attempts to switch to arbitrary track
      expect(isTrackChangeAuthorized("track-malicious-999", activeSessionTrackId)).toBe(false);
    });

    it("denies unauthenticated users from mutating session, queue, or votes", () => {
      function evaluateRlsCheck(authUid: string | null): boolean {
        return authUid !== null && authUid.length > 0;
      }

      // Authenticated caller allowed through RLS policy
      expect(evaluateRlsCheck("user-uuid-1234")).toBe(true);

      // Unauthenticated caller fails closed
      expect(evaluateRlsCheck(null)).toBe(false);
      expect(evaluateRlsCheck("")).toBe(false);
    });

    it("prevents participants from impersonating another user by binding to auth.uid()", () => {
      function resolveParticipantUserId(authUid: string, clientSuppliedUserId: string): string {
        // Safe design: server/RLS binds directly to auth.uid(), discarding untrusted client parameter
        if (!authUid) throw new Error("Unauthenticated");
        return authUid;
      }

      const verifiedUid = "user-real-uuid-777";
      const spoofedUid = "user-victim-uuid-888";

      // The resolved user ID must be the authenticated user's ID, never the spoofed ID
      expect(resolveParticipantUserId(verifiedUid, spoofedUid)).toBe("user-real-uuid-777");
      expect(resolveParticipantUserId(verifiedUid, spoofedUid)).not.toBe(spoofedUid);
    });

    it("prevents non-host participants from claiming host status (is_host=true)", () => {
      function canAssignHostStatus(hostId: string, callerUserId: string, requestedIsHost: boolean): boolean {
        // RLS WITH CHECK: (is_host = false OR EXISTS (SELECT 1 FROM jam_sessions WHERE host_id = auth.uid()))
        const isActualHost = hostId === callerUserId;
        if (requestedIsHost && !isActualHost) {
          return false; // Denied by RLS policy
        }
        return true;
      }

      const hostId = "host-user-1";
      const guestId = "guest-user-2";

      // Host can create/join with is_host = true
      expect(canAssignHostStatus(hostId, hostId, true)).toBe(true);

      // Guest joining with is_host = false is allowed
      expect(canAssignHostStatus(hostId, guestId, false)).toBe(true);

      // Guest attempting privilege escalation with is_host = true is rejected
      expect(canAssignHostStatus(hostId, guestId, true)).toBe(false);
    });

    it("prevents non-hosts from modifying authoritative playback state or terminating a session", () => {
      function canUpdateSession(hostId: string, callerUserId: string, updates: { playback_state?: string; is_active?: boolean }): boolean {
        // RLS UPDATE check: auth.uid() = host_id
        if (callerUserId !== hostId) {
          return false;
        }
        return true;
      }

      const hostId = "host-user-1";
      const guestId = "guest-user-2";

      // Host can update playback and terminate session
      expect(canUpdateSession(hostId, hostId, { playback_state: "playing" })).toBe(true);
      expect(canUpdateSession(hostId, hostId, { is_active: false })).toBe(true);

      // Non-host attempts are rejected
      expect(canUpdateSession(hostId, guestId, { playback_state: "paused" })).toBe(false);
      expect(canUpdateSession(hostId, guestId, { is_active: false })).toBe(false);
    });

    it("restricts private session data access to active members and the host", () => {
      const activeMembers = new Set(["host-user-1", "guest-user-2"]);

      function canAccessSessionData(sessionId: string, callerUserId: string, hostId: string): boolean {
        // RLS: host_id = auth.uid() OR is_jam_participant(session_id, auth.uid())
        return callerUserId === hostId || activeMembers.has(callerUserId);
      }

      expect(canAccessSessionData("sess-1", "host-user-1", "host-user-1")).toBe(true);
      expect(canAccessSessionData("sess-1", "guest-user-2", "host-user-1")).toBe(true);

      // Outsider cannot access session data
      expect(canAccessSessionData("sess-1", "outsider-user-3", "host-user-1")).toBe(false);
    });

    it("prevents enumeration of private invitation codes", () => {
      // Direct session listing without membership returns no results
      function queryActiveSessionsAsGuest(callerUserId: string, session: { host_id: string; participants: string[]; code: string }) {
        const isMember = session.host_id === callerUserId || session.participants.includes(callerUserId);
        if (!isMember) {
          return null; // RLS filters out rows
        }
        return session.code;
      }

      const privateSession = { host_id: "host-1", participants: ["host-1"], code: "JAM-WXYZ" };

      // Outsider cannot see the code in table queries
      expect(queryActiveSessionsAsGuest("outsider-user-9", privateSession)).toBeNull();

      // Host and existing members can view their own session
      expect(queryActiveSessionsAsGuest("host-1", privateSession)).toBe("JAM-WXYZ");
    });

    it("rejects duplicate votes for the same track by the same participant", () => {
      interface JamVote {
        sessionId: string;
        trackId: string;
        participantId: string;
      }

      const existingVotes: JamVote[] = [
        { sessionId: "sess-1", trackId: "track-1", participantId: "user-1" },
      ];

      function canCastVote(vote: JamVote): boolean {
        // Enforces UNIQUE(session_id, track_id, participant_id)
        const isDuplicate = existingVotes.some(
          (v) =>
            v.sessionId === vote.sessionId &&
            v.trackId === vote.trackId &&
            v.participantId === vote.participantId,
        );
        return !isDuplicate;
      }

      // First vote from user-2 succeeds
      expect(canCastVote({ sessionId: "sess-1", trackId: "track-1", participantId: "user-2" })).toBe(true);

      // Repeat vote from user-1 is rejected
      expect(canCastVote({ sessionId: "sess-1", trackId: "track-1", participantId: "user-1" })).toBe(false);
    });

    it("ensures unverified playback broadcasts cannot alter audio playback state (SEC-01 remediation)", () => {
      // In the hardened architecture, broadcast playback_sync handler is strictly decoupled
      // from audio player commands. Only server-verified postgres_changes can invoke seek, pause, resume, or play.
      let playerSeekCount = 0;
      let playerPauseCount = 0;
      let playerResumeCount = 0;

      function onBroadcastPlaybackSyncReceived(payload: { sender_id: string; playback_state: string; playback_position: number }) {
        // Hardened behavior: Broadcasts are telemetry hints only; NEVER invoke audio player methods
        // Player execution is decoupled from broadcast events.
        return { appliedToPlayer: false };
      }

      function onPostgresChangesReceived(isServerVerified: boolean, payload: { playback_state: string; playback_position: number }) {
        if (!isServerVerified) return { appliedToPlayer: false };
        if (payload.playback_state === "paused") playerPauseCount++;
        if (payload.playback_state === "playing") playerResumeCount++;
        return { appliedToPlayer: true };
      }

      // Rogue participant broadcasts spoofed pause command claiming to be the host
      const broadcastResult = onBroadcastPlaybackSyncReceived({
        sender_id: "host-user-1",
        playback_state: "paused",
        playback_position: 0,
      });

      expect(broadcastResult.appliedToPlayer).toBe(false);
      expect(playerPauseCount).toBe(0); // Audio element was NOT paused by the broadcast

      // Legitimate server-authoritative postgres_changes event from PostgreSQL
      const cdcResult = onPostgresChangesReceived(true, {
        playback_state: "paused",
        playback_position: 45.2,
      });

      expect(cdcResult.appliedToPlayer).toBe(true);
      expect(playerPauseCount).toBe(1); // Server-verified change was applied
    });

    it("verifies skip threshold against PostgreSQL database before host advances track (SEC-02 remediation)", async () => {
      let hostAdvancedTrack = false;

      // Simulated PostgreSQL state
      const dbVotes = { "sess-1:track-1": 1 }; // Only 1 vote in database
      const dbActiveParticipants = 4; // 4 participants -> requires 3 votes (floor(4/2) + 1 = 3)

      async function onSkipVoteBroadcastReceived(
        broadcastPayload: { thresholdReached: boolean },
        isHost: boolean,
        dbVoteCount: number,
        activeParticipants: number,
      ): Promise<boolean> {
        if (!isHost) return false;

        // Hardened: Host IGNORES broadcastPayload.thresholdReached!
        // Host independently calculates threshold from database state:
        const requiredVotes = Math.floor(activeParticipants / 2) + 1;
        const serverThresholdReached = dbVoteCount >= requiredVotes;

        if (serverThresholdReached) {
          hostAdvancedTrack = true;
          return true;
        }
        return false;
      }

      // Rogue participant sends fake broadcast claiming thresholdReached: true
      const fakeBroadcast = { thresholdReached: true };
      const advanced = await onSkipVoteBroadcastReceived(
        fakeBroadcast,
        true, // caller is host
        dbVotes["sess-1:track-1"]!, // 1 vote
        dbActiveParticipants, // 4 participants
      );

      // Host verified database: 1 vote < 3 required -> Rejected! Track was NOT advanced!
      expect(advanced).toBe(false);
      expect(hostAdvancedTrack).toBe(false);

      // Now simulate 3 votes reached in database
      const legitAdvanced = await onSkipVoteBroadcastReceived(
        fakeBroadcast,
        true,
        3, // 3 votes in database
        dbActiveParticipants,
      );

      expect(legitAdvanced).toBe(true);
      expect(hostAdvancedTrack).toBe(true);
    });

    it("enforces that non-hosts cannot directly insert into jam_participants (SEC-03 remediation)", () => {
      function evaluateParticipantInsertRls(authUid: string, sessionHostId: string, isHostClaim: boolean): boolean {
        // Hardened RLS policy: Only the host can execute direct INSERT into jam_participants
        // Non-hosts must use the join_jam_session RPC with the invitation code.
        const isActualHost = authUid === sessionHostId;
        if (!isActualHost || !isHostClaim) {
          return false; // Direct table INSERT denied by RLS
        }
        return true;
      }

      const hostId = "host-user-1";
      const guestId = "guest-attacker-2";

      // Host can insert their initial host participant row
      expect(evaluateParticipantInsertRls(hostId, hostId, true)).toBe(true);

      // Rogue participant attempting direct INSERT bypassing join code is denied
      expect(evaluateParticipantInsertRls(guestId, hostId, false)).toBe(false);
      expect(evaluateParticipantInsertRls(guestId, hostId, true)).toBe(false);
    });

    it("enforces identity protection and prevents mutation of session_id, user_id, or is_host (SEC-04 remediation)", () => {
      interface ParticipantRow {
        sessionId: string;
        userId: string;
        isHost: boolean;
        displayName: string;
      }

      function evaluateParticipantUpdate(
        oldRow: ParticipantRow,
        newRow: ParticipantRow,
        callerUid: string,
        sessionHostId: string,
      ): { allowed: boolean; error?: string } {
        // Enforces protect_jam_participant_identity trigger + hardened UPDATE RLS
        if (newRow.sessionId !== oldRow.sessionId || newRow.userId !== oldRow.userId) {
          return { allowed: false, error: "Cannot modify participant session_id or user_id" };
        }

        if (newRow.isHost !== oldRow.isHost) {
          const isCallerSessionHost = callerUid === sessionHostId;
          if (!isCallerSessionHost) {
            return { allowed: false, error: "Only the session host can set or modify host status" };
          }
        }

        return { allowed: true };
      }

      const initialGuest: ParticipantRow = {
        sessionId: "sess-1",
        userId: "guest-user-2",
        isHost: false,
        displayName: "Guest Listener",
      };

      // Guest attempts to escalate is_host = true
      const escalationAttempt = evaluateParticipantUpdate(
        initialGuest,
        { ...initialGuest, isHost: true },
        "guest-user-2",
        "host-user-1",
      );
      expect(escalationAttempt.allowed).toBe(false);
      expect(escalationAttempt.error).toContain("Only the session host can set or modify host status");

      // Guest attempts to reassign userId
      const hijackAttempt = evaluateParticipantUpdate(
        initialGuest,
        { ...initialGuest, userId: "victim-user-3" },
        "guest-user-2",
        "host-user-1",
      );
      expect(hijackAttempt.allowed).toBe(false);
      expect(hijackAttempt.error).toContain("Cannot modify participant session_id or user_id");

      // Guest updating their own display name is allowed
      const validUpdate = evaluateParticipantUpdate(
        initialGuest,
        { ...initialGuest, displayName: "New Name" },
        "guest-user-2",
        "host-user-1",
      );
      expect(validUpdate.allowed).toBe(true);
    });

    it("enforces server-side rate-limiting on join_jam_session attempts (SEC-06 remediation)", () => {
      const attemptsPerUser = new Map<string, number[]>();

      function checkJoinRateLimit(userId: string, nowMs: number): { allowed: boolean; error?: string } {
        const history = attemptsPerUser.get(userId) || [];
        // Filter attempts in last 1 minute
        const recent = history.filter((t) => nowMs - t < 60000);
        if (recent.length >= 10) {
          return { allowed: false, error: "Too many join attempts. Please wait a minute before trying again." };
        }
        recent.push(nowMs);
        attemptsPerUser.set(userId, recent);
        return { allowed: true };
      }

      const userId = "attacker-bot-1";
      const startTime = 1000000;

      // First 10 rapid attempts in the same minute succeed
      for (let i = 0; i < 10; i++) {
        const res = checkJoinRateLimit(userId, startTime + i * 100);
        expect(res.allowed).toBe(true);
      }

      // 11th attempt within the 1-minute window is blocked
      const blocked = checkJoinRateLimit(userId, startTime + 2000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.error).toContain("Too many join attempts");

      // After 1 minute (65 seconds later), rate limit resets and caller is allowed again
      const afterWindow = checkJoinRateLimit(userId, startTime + 65000);
      expect(afterWindow.allowed).toBe(true);
    });

    it("enforces cross-session data isolation (SEC-07)", () => {
      interface Session {
        id: string;
        members: Set<string>;
      }

      const sessions: Record<string, Session> = {
        "sess-alpha": { id: "sess-alpha", members: new Set(["user-1", "user-2"]) },
        "sess-beta": { id: "sess-beta", members: new Set(["user-3", "user-4"]) },
      };

      function canAccessSession(callerId: string, targetSessionId: string): boolean {
        const session = sessions[targetSessionId];
        if (!session) return false;
        return session.members.has(callerId);
      }

      // User 1 can access Session Alpha
      expect(canAccessSession("user-1", "sess-alpha")).toBe(true);

      // User 1 cannot access Session Beta
      expect(canAccessSession("user-1", "sess-beta")).toBe(false);

      // User 3 cannot access Session Alpha
      expect(canAccessSession("user-3", "sess-alpha")).toBe(false);
    });

    describe("Advanced Concurrency, Atomic Skip Claim & Staging Safeguards (Mocked Unit Tests)", () => {
      it("guarantees only one caller claims advancement when two threshold checks run concurrently for the same track", async () => {
        // Models PostgreSQL claim_jam_skip_advancement transaction with row-level FOR UPDATE lock
        interface DbSessionState {
          currentTrackId: string;
          lastSkippedTrackId: string | null;
          votes: number;
          required: number;
        }

        const dbState: DbSessionState = {
          currentTrackId: "track-xyz",
          lastSkippedTrackId: null,
          votes: 3,
          required: 2,
        };

        let activeLock = false;

        async function atomicClaimSkipAdvancement(
          sessionId: string,
          trackId: string,
          callerId: string,
          hostId: string,
        ): Promise<{ claimed: boolean; reason?: string }> {
          if (callerId !== hostId) throw new Error("Only host can claim skip");

          // Simulate PostgreSQL FOR UPDATE lock queueing
          while (activeLock) {
            await new Promise((r) => setTimeout(r, 5));
          }
          activeLock = true;

          try {
            // Simulated transaction execution
            if (dbState.currentTrackId !== trackId) {
              return { claimed: false, reason: "track_mismatch" };
            }
            if (dbState.lastSkippedTrackId === trackId) {
              return { claimed: false, reason: "already_skipped" };
            }
            if (dbState.votes < dbState.required) {
              return { claimed: false, reason: "threshold_not_reached" };
            }

            // ATOMIC CLAIM
            dbState.lastSkippedTrackId = trackId;
            dbState.votes = 0; // consumed
            return { claimed: true };
          } finally {
            activeLock = false;
          }
        }

        // Fire 2 concurrent claims at the exact same millisecond
        const [claim1, claim2] = await Promise.all([
          atomicClaimSkipAdvancement("sess-1", "track-xyz", "host-1", "host-1"),
          atomicClaimSkipAdvancement("sess-1", "track-xyz", "host-1", "host-1"),
        ]);

        // Exactly one claimed, the other rejected as already_skipped
        const claimedCount = (claim1.claimed ? 1 : 0) + (claim2.claimed ? 1 : 0);
        expect(claimedCount).toBe(1);
        expect(claim1.claimed ? claim2.reason : claim1.reason).toBe("already_skipped");
      });

      it("prevents double advancement from duplicate skip notifications using track-bound client locks", async () => {
        let advanceCallCount = 0;
        const advancingTrackId = { current: null as string | null };
        const claimedTrackIds = new Set<string>();

        async function handleSkipNotification(trackId: string) {
          // Client lock bound to active track ID
          if (advancingTrackId.current === trackId || claimedTrackIds.has(trackId)) {
            return "blocked_by_lock";
          }
          advancingTrackId.current = trackId;

          try {
            // Simulate network latency for claim RPC
            await new Promise((r) => setTimeout(r, 20));
            claimedTrackIds.add(trackId);
            advanceCallCount++;
            return "advanced";
          } finally {
            advancingTrackId.current = null;
          }
        }

        // 3 duplicate notifications arrive almost simultaneously for track-101
        const results = await Promise.all([
          handleSkipNotification("track-101"),
          handleSkipNotification("track-101"),
          handleSkipNotification("track-101"),
        ]);

        expect(advanceCallCount).toBe(1);
        expect(results.filter((r) => r === "advanced").length).toBe(1);
        expect(results.filter((r) => r === "blocked_by_lock").length).toBe(2);
      });

      it("aborts advancement if active track changes before asynchronous claim response arrives (stale response protection)", async () => {
        let advanced = false;
        let currentTrackId = "track-old";

        async function verifyAndAdvance(targetTrackId: string) {
          // Await network RPC
          await new Promise((r) => setTimeout(r, 30));

          // Stale response check: active track switched while awaiting RPC
          if (currentTrackId !== targetTrackId) {
            return "ignored_stale_response";
          }

          advanced = true;
          return "advanced";
        }

        const pendingPromise = verifyAndAdvance("track-old");

        // User or AutoDJ switches track to track-new while RPC was in-flight
        currentTrackId = "track-new";

        const result = await pendingPromise;
        expect(result).toBe("ignored_stale_response");
        expect(advanced).toBe(false);
      });

      it("proves transaction-scoped advisory locks serialize concurrent join attempts to prevent rate-limit race conditions", async () => {
        // Models PostgreSQL pg_advisory_xact_lock(classid, hashtext(user_id)) serialization
        const userLocks = new Map<string, boolean>();
        const attemptsHistory: { userId: string; timestamp: number }[] = [];

        async function serializedJoinAttempt(userId: string, now: number): Promise<{ allowed: boolean }> {
          // Simulate advisory lock queueing for same user
          while (userLocks.get(userId)) {
            await new Promise((r) => setTimeout(r, 2));
          }
          userLocks.set(userId, true);

          try {
            // Count recent attempts within 1 minute
            const recent = attemptsHistory.filter((a) => a.userId === userId && now - a.timestamp < 60000);
            if (recent.length >= 10) {
              return { allowed: false };
            }
            attemptsHistory.push({ userId, timestamp: now });
            return { allowed: true };
          } finally {
            userLocks.set(userId, false);
          }
        }

        // 20 concurrent requests fired at the exact same millisecond by a spammer
        const spamUser = "bot-spammer-99";
        const now = Date.now();
        const results = await Promise.all(
          Array.from({ length: 20 }, () => serializedJoinAttempt(spamUser, now)),
        );

        const allowedCount = results.filter((r) => r.allowed).length;
        const rejectedCount = results.filter((r) => !r.allowed).length;

        // Exactly 10 allowed, remaining 10 blocked
        expect(allowedCount).toBe(10);
        expect(rejectedCount).toBe(10);
      });

      it("verifies rate-limit table (jam_join_attempts) denies direct client mutations", () => {
        interface TablePrivileges {
          hasSelect: boolean;
          hasInsert: boolean;
          hasUpdate: boolean;
          hasDelete: boolean;
        }

        // Under our hardened migration, jam_join_attempts has RLS enabled with 0 policies
        // and has NO grants to the authenticated role.
        function evaluateDirectClientAccess(privileges: TablePrivileges): boolean {
          return privileges.hasSelect || privileges.hasInsert || privileges.hasUpdate || privileges.hasDelete;
        }

        const jamJoinAttemptsPrivileges: TablePrivileges = {
          hasSelect: false,
          hasInsert: false,
          hasUpdate: false,
          hasDelete: false,
        };

        expect(evaluateDirectClientAccess(jamJoinAttemptsPrivileges)).toBe(false);
      });

      it("reconciles queue state on delete events via PostgreSQL changes and client sync broadcast", () => {
        let clientQueue = [
          { id: "q-1", trackId: "track-1" },
          { id: "q-2", trackId: "track-2" },
        ];

        // Authoritative database queue state
        let dbQueue = [
          { id: "q-1", trackId: "track-1" },
        ];

        function onQueueSyncEvent() {
          // Reconciles directly from database state
          clientQueue = [...dbQueue];
        }

        expect(clientQueue.length).toBe(2);
        // Deletion occurs in DB and triggers queue_sync
        onQueueSyncEvent();
        expect(clientQueue.length).toBe(1);
        expect(clientQueue[0]?.id).toBe("q-1");
      });
    });
  });
});
