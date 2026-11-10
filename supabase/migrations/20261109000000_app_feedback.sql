-- ====================================================================
-- MelodyMap First-Experience App Feedback Migration
-- Table: public.app_feedback
-- Captures: rating, improvement categories, comment, user_id (nullable for guests),
-- platform ('android' | 'web'), is_guest, metadata (session info), created_at
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.app_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  categories TEXT[] NULL DEFAULT '{}',
  comment TEXT NULL,
  platform TEXT NOT NULL DEFAULT 'web',
  is_guest BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safely add columns if table existed without them
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS rating INTEGER NOT NULL DEFAULT 5;
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS categories TEXT[] NULL DEFAULT '{}';
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS comment TEXT NULL;
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web';
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS metadata JSONB NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Enable Row Level Security (RLS)
ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone (authenticated users or guest/anon) can submit feedback
DROP POLICY IF EXISTS "app_feedback_insert_all" ON public.app_feedback;
CREATE POLICY "app_feedback_insert_all"
  ON public.app_feedback
  FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Authenticated users can view their own submitted feedback
DROP POLICY IF EXISTS "app_feedback_select_own" ON public.app_feedback;
CREATE POLICY "app_feedback_select_own"
  ON public.app_feedback
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);
