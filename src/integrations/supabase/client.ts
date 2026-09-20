// This file connects MelodyMap to Supabase backend services.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export function getSupabaseEnv() {
  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('melodymap.supabase_url') || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('melodymap.supabase_key') || '' : '';

  // Use static dot property access so Vite compiles and replaces them at build time
  const metaUrl = import.meta.env.VITE_SUPABASE_URL;
  const metaKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

  const nodeUrl = typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL : '';
  const nodeKey = typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_PUBLISHABLE_KEY || process.env?.SUPABASE_ANON_KEY : '';

  const rawUrl = (metaUrl || localUrl || nodeUrl || '').trim();
  const rawKey = (metaKey || localKey || nodeKey || '').trim();

  const isConfigured = Boolean(
    rawUrl &&
    rawKey &&
    !rawUrl.includes('placeholder-project') &&
    rawUrl.startsWith('http')
  );

  return {
    url: rawUrl,
    key: rawKey,
    isConfigured,
  };
}

export function setLocalSupabaseCredentials(url: string, key: string) {
  if (typeof window !== 'undefined') {
    if (url && key) {
      localStorage.setItem('melodymap.supabase_url', url.trim());
      localStorage.setItem('melodymap.supabase_key', key.trim());
    } else {
      localStorage.removeItem('melodymap.supabase_url');
      localStorage.removeItem('melodymap.supabase_key');
    }
    _supabase = undefined;
  }
}

function createSupabaseClient() {
  const { url, key, isConfigured } = getSupabaseEnv();

  if (!isConfigured) {
    console.warn(
      '[Supabase] Environment variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not configured. Running in local-first guest mode.',
    );
  } else {
    console.info(`[Supabase] Initialized client for ${url}`);
  }

  const effectiveUrl = isConfigured ? url : 'https://placeholder-project.supabase.co';
  const effectiveKey = isConfigured ? key : 'placeholder-anon-key';

  return createClient<Database>(effectiveUrl, effectiveKey, {
    global: {
      fetch: createSupabaseFetch(effectiveKey),
    },
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
