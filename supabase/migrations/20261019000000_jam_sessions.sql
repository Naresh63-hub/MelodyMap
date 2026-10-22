-- ====================================================================
-- MelodyMap Jam Session Migration: Hardened Collaborative Listening Architecture
-- Version: 20261019000000
-- ====================================================================

-- 1. Helper function: check if an authenticated user is an active participant in a session
-- Uses SECURITY DEFINER to avoid RLS recursion when policies query membership
CREATE OR REPLACE FUNCTION public.is_jam_participant(p_session_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jam_participants
    WHERE session_id = p_session_id AND user_id = p_user_id AND status = 'active'
  );
$$;

-- 2. Jam Sessions: Core session state, host identity, and authoritative playback
CREATE TABLE IF NOT EXISTS public.jam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) NOT NULL UNIQUE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'MelodyMap Jam',
  mode TEXT NOT NULL DEFAULT 'host_controlled' CHECK (mode IN ('host_controlled', 'collaborative')),
  current_track_id TEXT NULL,
  current_track JSONB NULL,
  playback_state TEXT NOT NULL DEFAULT 'idle' CHECK (playback_state IN ('playing', 'paused', 'buffering', 'idle')),
  playback_position DOUBLE PRECISION NOT NULL DEFAULT 0,
  playback_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  allow_participant_queue BOOLEAN NOT NULL DEFAULT true,
  allow_participant_control BOOLEAN NOT NULL DEFAULT false,
  last_skipped_track_id TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Jam Participants: Connected users, avatars, host badge, and online status
CREATE TABLE IF NOT EXISTS public.jam_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.jam_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT NULL,
  is_host BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'left')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_jam_participants UNIQUE (session_id, user_id)
);

-- 4. Jam Shared Queue: Collaborative playlist with contributor tracking
CREATE TABLE IF NOT EXISTS public.jam_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.jam_sessions(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  track JSONB NOT NULL,
  added_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by_name TEXT NOT NULL,
  added_by_avatar TEXT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_jam_queue UNIQUE (session_id, track_id)
);

-- 5. Jam Skip Votes: Track voting for collaborative session mode
CREATE TABLE IF NOT EXISTS public.jam_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.jam_sessions(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  participant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_jam_votes UNIQUE (session_id, track_id, participant_id)
);

-- 6. Rate Limiting Table: Tracks code join attempts per authenticated identity
CREATE TABLE IF NOT EXISTS public.jam_join_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_jam_sessions_code ON public.jam_sessions(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_jam_participants_session ON public.jam_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_jam_queue_session_pos ON public.jam_queue(session_id, position);
CREATE INDEX IF NOT EXISTS idx_jam_votes_track ON public.jam_votes(session_id, track_id);
CREATE INDEX IF NOT EXISTS idx_jam_join_attempts_user_time ON public.jam_join_attempts(user_id, attempted_at);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.jam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jam_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jam_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jam_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jam_join_attempts ENABLE ROW LEVEL SECURITY;

-- 8b. REPLICA IDENTITY FULL for Realtime CDC
-- Ensures WAL records for DELETE contain all columns including session_id,
-- allowing Supabase Realtime to evaluate filter: session_id=eq.${sessionId} on deletion.
ALTER TABLE public.jam_queue REPLICA IDENTITY FULL;

-- 9. Participant Identity Protection Trigger
-- Strictly prevents modifying session_id, user_id, or escalating is_host
CREATE OR REPLACE FUNCTION public.protect_jam_participant_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Prevent modifying session_id or user_id
  IF NEW.session_id <> OLD.session_id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify participant session_id or user_id';
  END IF;

  -- Prevent non-hosts from escalating or changing is_host
  IF NEW.is_host <> OLD.is_host THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.jam_sessions s
      WHERE s.id = NEW.session_id AND s.host_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Only the session host can set or modify host status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_jam_participant_identity ON public.jam_participants;
CREATE TRIGGER trg_protect_jam_participant_identity
  BEFORE UPDATE ON public.jam_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_jam_participant_identity();

-- 10. Hardened RLS Policies: Strictly authenticated, zero auth.uid() IS NULL bypasses
-- Jam Sessions:
-- Non-members CANNOT list all active sessions. Only the host or active members can SELECT.
DROP POLICY IF EXISTS "Members or host can view session" ON public.jam_sessions;
CREATE POLICY "Members or host can view session" ON public.jam_sessions
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (
      host_id = auth.uid()
      OR public.is_jam_participant(id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create sessions" ON public.jam_sessions;
CREATE POLICY "Authenticated users can create sessions" ON public.jam_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND host_id = auth.uid()
  );

-- ONLY the authorized host can modify playback state, change modes, or end a session
DROP POLICY IF EXISTS "Only host can update session" ON public.jam_sessions;
CREATE POLICY "Only host can update session" ON public.jam_sessions
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND host_id = auth.uid()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND host_id = auth.uid()
  );

-- Jam Participants:
DROP POLICY IF EXISTS "Participants can view their session participants" ON public.jam_participants;
CREATE POLICY "Participants can view their session participants" ON public.jam_participants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_jam_participant(session_id, auth.uid())
  );

-- Direct INSERT on jam_participants is strictly restricted to the SESSION HOST.
-- All guest listeners MUST join through the secure join_jam_session RPC with a valid code.
DROP POLICY IF EXISTS "Users can join as themselves" ON public.jam_participants;
DROP POLICY IF EXISTS "Host can register host participant" ON public.jam_participants;
CREATE POLICY "Host can register host participant" ON public.jam_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND is_host = true
    AND EXISTS (
      SELECT 1 FROM public.jam_sessions s
      WHERE s.id = session_id AND s.host_id = auth.uid() AND s.is_active = true
    )
  );

DROP POLICY IF EXISTS "Users can update their own participant row" ON public.jam_participants;
CREATE POLICY "Users can update their own participant row" ON public.jam_participants
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    -- Ordinary participants cannot set is_host = true
    AND (
      is_host = false
      OR EXISTS (
        SELECT 1 FROM public.jam_sessions s
        WHERE s.id = jam_participants.session_id AND s.host_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can leave or host can remove participant" ON public.jam_participants;
CREATE POLICY "Users can leave or host can remove participant" ON public.jam_participants
  FOR DELETE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.jam_sessions s
        WHERE s.id = jam_participants.session_id AND s.host_id = auth.uid()
      )
    )
  );

-- Jam Queue:
DROP POLICY IF EXISTS "Session members can view queue" ON public.jam_queue;
CREATE POLICY "Session members can view queue" ON public.jam_queue
  FOR SELECT TO authenticated
  USING (
    public.is_jam_participant(session_id, auth.uid())
  );

DROP POLICY IF EXISTS "Participants can add tracks if queue allowed" ON public.jam_queue;
CREATE POLICY "Participants can add tracks if queue allowed" ON public.jam_queue
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND added_by_id = auth.uid()
    AND public.is_jam_participant(session_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.jam_sessions s
      WHERE s.id = jam_queue.session_id
        AND s.is_active = true
        AND (s.allow_participant_queue = true OR s.host_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Adder or host can delete queue items" ON public.jam_queue;
CREATE POLICY "Adder or host can delete queue items" ON public.jam_queue
  FOR DELETE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      added_by_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.jam_sessions s
        WHERE s.id = jam_queue.session_id AND s.host_id = auth.uid()
      )
    )
  );

-- Jam Votes:
DROP POLICY IF EXISTS "Session members can view votes" ON public.jam_votes;
CREATE POLICY "Session members can view votes" ON public.jam_votes
  FOR SELECT TO authenticated
  USING (
    public.is_jam_participant(session_id, auth.uid())
  );

DROP POLICY IF EXISTS "Members can vote in collaborative mode for current track" ON public.jam_votes;
CREATE POLICY "Members can vote in collaborative mode for current track" ON public.jam_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND participant_id = auth.uid()
    AND public.is_jam_participant(session_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.jam_sessions s
      WHERE s.id = jam_votes.session_id
        AND s.is_active = true
        AND s.mode = 'collaborative'
        AND s.current_track_id = jam_votes.track_id
    )
  );

DROP POLICY IF EXISTS "Voter or host can delete vote" ON public.jam_votes;
CREATE POLICY "Voter or host can delete vote" ON public.jam_votes
  FOR DELETE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      participant_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.jam_sessions s
        WHERE s.id = jam_votes.session_id AND s.host_id = auth.uid()
      )
    )
  );

-- 11. Secure Session Join RPC Function with Authenticated Rate Limiting
-- Enables participants to join using the invitation code without exposing global session lists.
-- Serializes join attempts using transaction-scoped advisory locks to eliminate concurrent TOCTOU races.
CREATE OR REPLACE FUNCTION public.join_jam_session(
  p_code TEXT,
  p_display_name TEXT DEFAULT 'Listener',
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session RECORD;
  v_participant RECORD;
  v_user_id UUID;
  v_clean_code TEXT;
  v_recent_attempts INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Serialize join attempts for this authenticated user to prevent concurrent TOCTOU race conditions
  -- Class 4866381 ('JAM') isolates the advisory lock namespace from other database locks
  PERFORM pg_advisory_xact_lock(4866381, hashtext(v_user_id::text));

  -- Clean up stale attempts older than 5 minutes for this user
  DELETE FROM public.jam_join_attempts
  WHERE user_id = v_user_id AND attempted_at < (now() - INTERVAL '5 minutes');

  SELECT COUNT(*) INTO v_recent_attempts
  FROM public.jam_join_attempts
  WHERE user_id = v_user_id AND attempted_at > (now() - INTERVAL '1 minute');

  IF v_recent_attempts >= 10 THEN
    RAISE EXCEPTION 'Too many join attempts. Please wait a minute before trying again.';
  END IF;

  INSERT INTO public.jam_join_attempts (user_id, attempted_at)
  VALUES (v_user_id, now());

  -- 2. Code format validation
  v_clean_code := upper(trim(p_code));
  IF length(v_clean_code) < 4 OR length(v_clean_code) > 12 THEN
    RAISE EXCEPTION 'Invalid session code format';
  END IF;

  -- 3. Lookup active session
  SELECT * INTO v_session
  FROM public.jam_sessions
  WHERE code = v_clean_code AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jam session not found or has already ended';
  END IF;

  -- 4. Secure insert/update: derive is_host strictly from session host_id
  INSERT INTO public.jam_participants (
    session_id,
    user_id,
    display_name,
    avatar_url,
    is_host,
    status,
    last_seen_at
  )
  VALUES (
    v_session.id,
    v_user_id,
    COALESCE(NULLIF(trim(p_display_name), ''), 'Listener'),
    p_avatar_url,
    (v_session.host_id = v_user_id),
    'active',
    now()
  )
  ON CONFLICT (session_id, user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    status = 'active',
    last_seen_at = now()
  RETURNING * INTO v_participant;

  RETURN jsonb_build_object(
    'session', to_jsonb(v_session),
    'participant', to_jsonb(v_participant)
  );
END;
$$;

-- 12. Server-Authoritative Skip Advancement & Atomic Claim RPC
-- Atomically verifies the threshold, claims the advancement for the active track,
-- and consumes the skip votes in a single transaction to prevent concurrent double-skips.
CREATE OR REPLACE FUNCTION public.claim_jam_skip_advancement(
  p_session_id UUID,
  p_track_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session RECORD;
  v_active_count INT;
  v_votes_count INT;
  v_required INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Atomically lock session row for update and verify caller is the session host
  SELECT * INTO v_session
  FROM public.jam_sessions
  WHERE id = p_session_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or inactive';
  END IF;

  IF v_session.host_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the session host can claim and execute a skip advancement';
  END IF;

  -- Stale check: Verify the track being skipped matches the active current track
  IF v_session.current_track_id IS DISTINCT FROM p_track_id THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'reason', 'track_mismatch',
      'current_track_id', v_session.current_track_id
    );
  END IF;

  -- Idempotency check: Has this track already been skipped?
  IF v_session.last_skipped_track_id = p_track_id THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'reason', 'already_skipped',
      'track_id', p_track_id
    );
  END IF;

  -- Count active participants
  SELECT COUNT(*) INTO v_active_count
  FROM public.jam_participants
  WHERE session_id = p_session_id AND status = 'active';

  -- Calculate threshold:
  -- <=1 -> 1; 2 -> 2; odd/even > 2 -> floor(n/2) + 1
  IF v_active_count <= 1 THEN
    v_required := 1;
  ELSIF v_active_count = 2 THEN
    v_required := 2;
  ELSE
    v_required := floor(v_active_count / 2) + 1;
  END IF;

  -- Count distinct valid votes for this track
  SELECT COUNT(*) INTO v_votes_count
  FROM public.jam_votes
  WHERE session_id = p_session_id AND track_id = p_track_id;

  IF v_votes_count < v_required THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'reason', 'threshold_not_reached',
      'votes_count', v_votes_count,
      'required_votes', v_required
    );
  END IF;

  -- ATOMIC CLAIM: Mark track as skipped and consume the votes
  UPDATE public.jam_sessions
  SET last_skipped_track_id = p_track_id,
      updated_at = now()
  WHERE id = p_session_id;

  DELETE FROM public.jam_votes
  WHERE session_id = p_session_id AND track_id = p_track_id;

  RETURN jsonb_build_object(
    'claimed', true,
    'votes_count', v_votes_count,
    'required_votes', v_required,
    'track_id', p_track_id
  );
END;
$$;

-- 12b. Read-Only Skip Vote Status Query Helper for Participants
CREATE OR REPLACE FUNCTION public.get_jam_skip_vote_status(
  p_session_id UUID,
  p_track_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_session RECORD;
  v_active_count INT;
  v_votes_count INT;
  v_required INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_session
  FROM public.jam_sessions
  WHERE id = p_session_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or inactive';
  END IF;

  IF v_session.host_id <> auth.uid() AND NOT public.is_jam_participant(p_session_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM public.jam_participants
  WHERE session_id = p_session_id AND status = 'active';

  IF v_active_count <= 1 THEN
    v_required := 1;
  ELSIF v_active_count = 2 THEN
    v_required := 2;
  ELSE
    v_required := floor(v_active_count / 2) + 1;
  END IF;

  SELECT COUNT(*) INTO v_votes_count
  FROM public.jam_votes
  WHERE session_id = p_session_id AND track_id = p_track_id;

  RETURN jsonb_build_object(
    'votes_count', v_votes_count,
    'required_votes', v_required,
    'threshold_reached', (v_votes_count >= v_required)
  );
END;
$$;

-- 13. Enable Supabase Realtime Publication for Jam Tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'jam_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jam_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'jam_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jam_participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'jam_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jam_queue;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'jam_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jam_votes;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- 14. Explicit Permissions and Hardened Revocations
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jam_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jam_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jam_queue TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.jam_votes TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_jam_participant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_jam_session(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_jam_skip_advancement(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_jam_skip_vote_status(UUID, TEXT) TO authenticated;

-- Revoke execute from public/anon to avoid unauthenticated function probes
REVOKE EXECUTE ON FUNCTION public.is_jam_participant(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_jam_session(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_jam_skip_advancement(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_jam_skip_vote_status(UUID, TEXT) FROM PUBLIC;
