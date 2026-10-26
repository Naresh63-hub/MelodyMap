-- ====================================================================
-- MelodyMap Profile & Auth Sync Migration
-- Automatically mirrors Supabase auth.users into public.profiles
-- Captures: email, login provider (Google, Email, Anonymous), avatar, name
-- ====================================================================

-- 1. Ensure public.profiles table exists
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NULL,
  provider TEXT NULL,
  display_name TEXT NOT NULL DEFAULT 'Listener',
  avatar_url TEXT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  last_sign_in_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Safely add columns if profiles table already existed without them
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS provider TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 5. Trigger Function: automatically copy auth.users into public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  extracted_provider TEXT;
  extracted_name TEXT;
  extracted_avatar TEXT;
BEGIN
  -- Determine provider (google, email, anonymous)
  extracted_provider := COALESCE(
    new.raw_app_meta_data->>'provider',
    (new.raw_app_meta_data->'providers'->>0),
    CASE WHEN new.is_anonymous THEN 'anonymous' ELSE 'email' END
  );

  -- Determine display name
  extracted_name := COALESCE(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    NULLIF(split_part(new.email, '@', 1), ''),
    CASE WHEN new.is_anonymous THEN 'Guest Listener' ELSE 'Listener' END
  );

  -- Determine avatar URL
  extracted_avatar := COALESCE(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    NULL
  );

  -- Upsert into public.profiles
  INSERT INTO public.profiles (
    id,
    email,
    provider,
    display_name,
    avatar_url,
    is_anonymous,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    new.email,
    extracted_provider,
    extracted_name,
    extracted_avatar,
    COALESCE(new.is_anonymous, false),
    new.last_sign_in_at,
    COALESCE(new.created_at, now()),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(excluded.email, public.profiles.email),
    provider = COALESCE(excluded.provider, public.profiles.provider),
    display_name = CASE
      WHEN public.profiles.display_name IS NULL OR public.profiles.display_name = 'Listener' OR public.profiles.display_name = 'Guest Listener'
      THEN excluded.display_name
      ELSE public.profiles.display_name
    END,
    avatar_url = COALESCE(public.profiles.avatar_url, excluded.avatar_url),
    is_anonymous = excluded.is_anonymous,
    last_sign_in_at = COALESCE(excluded.last_sign_in_at, public.profiles.last_sign_in_at),
    updated_at = now();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data, raw_app_meta_data, last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. Backfill existing users from auth.users into public.profiles
INSERT INTO public.profiles (
  id,
  email,
  provider,
  display_name,
  avatar_url,
  is_anonymous,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_app_meta_data->>'provider',
    (u.raw_app_meta_data->'providers'->>0),
    CASE WHEN u.is_anonymous THEN 'anonymous' ELSE 'email' END
  ),
  COALESCE(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    NULLIF(split_part(u.email, '@', 1), ''),
    CASE WHEN u.is_anonymous THEN 'Guest Listener' ELSE 'Listener' END
  ),
  COALESCE(
    u.raw_user_meta_data->>'avatar_url',
    u.raw_user_meta_data->>'picture',
    NULL
  ),
  COALESCE(u.is_anonymous, false),
  u.last_sign_in_at,
  COALESCE(u.created_at, now()),
  now()
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  email = COALESCE(excluded.email, public.profiles.email),
  provider = COALESCE(excluded.provider, public.profiles.provider),
  display_name = CASE
    WHEN public.profiles.display_name IS NULL OR public.profiles.display_name = 'Listener' OR public.profiles.display_name = 'Guest Listener'
    THEN excluded.display_name
    ELSE public.profiles.display_name
  END,
  avatar_url = COALESCE(public.profiles.avatar_url, excluded.avatar_url),
  is_anonymous = excluded.is_anonymous,
  last_sign_in_at = COALESCE(excluded.last_sign_in_at, public.profiles.last_sign_in_at),
  updated_at = now();
