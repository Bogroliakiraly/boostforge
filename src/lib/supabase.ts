/**
 * Supabase wiring for online accounts. The client only ever uses the *anon*
 * (public) key, which is safe to ship. Account login and reading one's own
 * licenses happen with supabase-js; minting a key (which needs the secret
 * Ed25519 private key) happens server-side in the `issue-license` edge function
 * and is gated by an admin token only the vendor knows.
 *
 * Everything here degrades gracefully: if the env vars are absent the app still
 * works fully offline with manual license-key entry — `isSupabaseConfigured`
 * stays false and `supabase` is null.
 */
import { createClient, type SupabaseClient, type SupportedStorage } from "@supabase/supabase-js";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { Store } from "@tauri-apps/plugin-store";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anon);

// Persist the auth session through Tauri's own Store plugin (a JSON file in
// the app's data directory — the same reliable location the license key lives
// in) instead of the WebView's localStorage. This is what makes "stay signed
// in across restarts" actually reliable regardless of WebView2 storage quirks.
let storePromise: Promise<Store> | null = null;
function getStore(): Promise<Store> {
  if (!storePromise) storePromise = Store.load("auth-store.json");
  return storePromise;
}

const tauriStorage: SupportedStorage = {
  async getItem(key) {
    const store = await getStore();
    return (await store.get<string>(key)) ?? null;
  },
  async setItem(key, value) {
    const store = await getStore();
    await store.set(key, value);
    await store.save();
  },
  async removeItem(key) {
    const store = await getStore();
    await store.delete(key);
    await store.save();
  },
};

// Route all Supabase traffic through Tauri's HTTP layer (Rust/reqwest) instead
// of the WebView's fetch. The webview is locked down by CSP and is subject to
// CORS; the native layer bypasses both, so auth and REST calls work reliably.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anon!, {
      auth: { persistSession: true, autoRefreshToken: true, storage: tauriStorage },
      global: { fetch: tauriFetch },
    })
  : null;

const functionsBase = url ? `${url.replace(/\/$/, "")}/functions/v1` : "";

/** A row of the `licenses` table as exposed to its owner (or the admin). */
export interface LicenseRow {
  id: string;
  email: string;
  tier: string;
  license_key: string;
  issued: string;
  expires: string;
  days: number;
  revoked: boolean;
  created_at: string;
}

export interface IssuedLicense {
  key: string;
  email: string;
  tier: string;
  issued: string;
  expires: string;
  days: number;
}

/**
 * Calls the admin-only `issue-license` edge function to mint and store a signed
 * Pro key for `email`, valid `days` days. The function verifies `adminToken`
 * server-side, so the secret signing key never reaches the client.
 */
export async function issueLicense(params: {
  email: string;
  days: number;
  tier: string;
  adminToken: string;
}): Promise<IssuedLicense> {
  if (!url || !anon) throw new Error("Supabase is not configured");
  const res = await tauriFetch(`${functionsBase}/issue-license`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "x-admin-token": params.adminToken,
    },
    body: JSON.stringify({
      email: params.email.trim().toLowerCase(),
      days: params.days,
      tier: params.tier,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as IssuedLicense;
}
