import { createClient } from "@supabase/supabase-js";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export function getSupabaseEnv() {
  const localUrl = typeof window !== "undefined" ? localStorage.getItem("melodymap.supabase_url") || "" : "";
  const localKey = typeof window !== "undefined" ? localStorage.getItem("melodymap.supabase_key") || "" : "";

  const metaUrl = (import.meta as any).env?.["VITE_SUPABASE_URL"];
  const metaKey = (import.meta as any).env?.["VITE_SUPABASE_PUBLISHABLE_KEY"] || (import.meta as any).env?.["VITE_SUPABASE_ANON_KEY"];

  const nodeUrl = typeof process !== "undefined" ? process.env?.["VITE_SUPABASE_URL"] || process.env?.["SUPABASE_URL"] : "";
  const nodeKey = typeof process !== "undefined" ? process.env?.["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env?.["VITE_SUPABASE_ANON_KEY"] || process.env?.["SUPABASE_PUBLISHABLE_KEY"] || process.env?.["SUPABASE_ANON_KEY"] : "";

  const rawUrl = (metaUrl || localUrl || nodeUrl || "https://ewdkptexcovmqqrlfwlf.supabase.co").trim();
  const rawKey = (metaKey || localKey || nodeKey || "sb_publishable_kgADtqCpLcOGGcSt7v9o9Q_Xubtre32").trim();

  const isConfigured = Boolean(
    rawUrl &&
    rawKey &&
    !rawUrl.includes("placeholder-project") &&
    rawUrl.startsWith("http")
  );

  return {
    url: rawUrl,
    key: rawKey,
    isConfigured,
  };
}

export function setLocalSupabaseCredentials(url: string, key: string) {
  if (typeof window !== "undefined") {
    if (url && key) {
      localStorage.setItem("melodymap.supabase_url", url.trim());
      localStorage.setItem("melodymap.supabase_key", key.trim());
    } else {
      localStorage.removeItem("melodymap.supabase_url");
      localStorage.removeItem("melodymap.supabase_key");
    }
    _supabase = undefined;
  }
}

function createSupabaseClient() {
  const { url, key, isConfigured } = getSupabaseEnv();

  const effectiveUrl = isConfigured ? url : "https://ewdkptexcovmqqrlfwlf.supabase.co";
  const effectiveKey = isConfigured ? key : "sb_publishable_kgADtqCpLcOGGcSt7v9o9Q_Xubtre32";

  return createClient(effectiveUrl, effectiveKey, {
    global: {
      fetch: createSupabaseFetch(effectiveKey),
    },
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
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
