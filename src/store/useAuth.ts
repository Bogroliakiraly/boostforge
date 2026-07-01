import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured, type LicenseRow } from "../lib/supabase";
import { checkDeviceGuard } from "../lib/deviceGuard";
import { useLicense } from "./useLicense";

/** Free trial = 1 day counted from the account's registration date. */
const TRIAL_MS = 24 * 60 * 60 * 1000;

/** Recomputes the trial window and device-sharing flag for the signed-in
 *  account (or clears both when signed out). Runs the device-guard checks
 *  (one trial per device, a device cap per account) before deciding. */
async function applyAccountState(user: User | null) {
  const license = useLicense.getState();
  if (!user?.email) {
    license.setTrialUntil(null);
    license.setDeviceBlocked(false);
    return;
  }
  const guard = await checkDeviceGuard(user.email);
  license.setDeviceBlocked(guard.deviceBlocked);
  const createdAt = user.created_at;
  const until =
    guard.trialEligible && createdAt
      ? new Date(new Date(createdAt).getTime() + TRIAL_MS).toISOString()
      : null;
  license.setTrialUntil(until);
}

interface AuthState {
  /** True once the initial session has been resolved (or auth is unconfigured). */
  ready: boolean;
  session: Session | null;
  user: User | null;
  init: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns whether the project requires email confirmation before sign-in. */
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  /** The owner's newest active (non-revoked, unexpired) license, if any. */
  fetchActiveLicense: () => Promise<LicenseRow | null>;
}

export const useAuth = create<AuthState>((set, get) => ({
  ready: !isSupabaseConfigured,
  session: null,
  user: null,

  init: () => {
    if (!supabase) {
      set({ ready: true });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null, ready: true });
      applyAccountState(data.session?.user ?? null);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
      applyAccountState(session?.user ?? null);
    });
  },

  signIn: async (email, password) => {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(error.message);
  },

  signUp: async (email, password) => {
    if (!supabase) throw new Error("Supabase is not configured");
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(error.message);
    // When confirmation is required, Supabase returns a user but no session.
    return { needsConfirmation: !data.session };
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },

  fetchActiveLicense: async () => {
    const { user } = get();
    if (!supabase || !user?.email) return null;
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("licenses")
      .select("*")
      .eq("email", user.email.toLowerCase())
      .eq("revoked", false)
      .gte("expires", today)
      .order("expires", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return (data?.[0] as LicenseRow) ?? null;
  },
}));
