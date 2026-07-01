import { create } from "zustand";
import { getLicenseStatus } from "../lib/api";
import type { LicenseStatus } from "../lib/types";

/**
 * Effective Pro status = an active signed key (paid) OR an account trial —
 * unless this device has been flagged for account-sharing (too many distinct
 * devices on one account), which forces Free regardless of either.
 * The free trial is account-based: 1 day from the registration date, applied
 * via `setTrialUntil` once a Supabase account is known and device-eligible
 * (see `src/lib/deviceGuard.ts`).
 */
interface LicenseState {
  /** Raw status from the Rust side (paid key only). */
  rawStatus: LicenseStatus | null;
  /** Effective status shown in the UI (reflects the account trial too). */
  status: LicenseStatus | null;
  loaded: boolean;
  isPro: boolean; // active paid key OR active trial, and not device-blocked
  /** ISO timestamp when the account trial ends, or null. */
  trialUntil: string | null;
  /** True once this account has been used from too many distinct devices. */
  deviceBlocked: boolean;
  refresh: () => Promise<void>;
  set: (s: LicenseStatus) => void;
  setTrialUntil: (iso: string | null) => void;
  setDeviceBlocked: (blocked: boolean) => void;
}

function derive(raw: LicenseStatus | null, trialUntil: string | null, deviceBlocked: boolean) {
  if (deviceBlocked) {
    return {
      isPro: false,
      status: {
        tier: "free",
        valid: false,
        email: raw?.email ?? null,
        expires: null,
        days_remaining: null,
        trial_days_remaining: null,
        reason: "This account is already in use on the maximum number of devices.",
      } as LicenseStatus,
    };
  }

  const keyPro = !!raw?.valid;
  const trialActive =
    !keyPro && !!trialUntil && Date.now() < Date.parse(trialUntil);
  const isPro = keyPro || trialActive;

  let status = raw;
  if (trialActive && trialUntil) {
    const days = Math.max(1, Math.ceil((Date.parse(trialUntil) - Date.now()) / 86400000));
    status = {
      tier: "trial",
      valid: true,
      email: null,
      expires: trialUntil.slice(0, 10),
      days_remaining: null,
      trial_days_remaining: days,
      reason: null,
    };
  }
  return { isPro, status };
}

export const useLicense = create<LicenseState>((set, get) => ({
  rawStatus: null,
  status: null,
  loaded: false,
  isPro: false,
  trialUntil: null,
  deviceBlocked: false,
  refresh: async () => {
    try {
      const raw = await getLicenseStatus();
      const { isPro, status } = derive(raw, get().trialUntil, get().deviceBlocked);
      set({ rawStatus: raw, status, isPro, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  set: (raw) => {
    const { isPro, status } = derive(raw, get().trialUntil, get().deviceBlocked);
    set({ rawStatus: raw, status, isPro });
  },
  setTrialUntil: (iso) => {
    const { isPro, status } = derive(get().rawStatus, iso, get().deviceBlocked);
    set({ trialUntil: iso, status, isPro });
  },
  setDeviceBlocked: (blocked) => {
    const { isPro, status } = derive(get().rawStatus, get().trialUntil, blocked);
    set({ deviceBlocked: blocked, status, isPro });
  },
}));
