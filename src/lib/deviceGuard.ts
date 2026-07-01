/**
 * Anti-abuse checks tied to this Windows installation's stable device ID
 * (see `get_device_id` in Rust — the OS's own MachineGuid). Two things are
 * enforced, both best-effort (fail open on any network hiccup so a flaky
 * connection never locks out an honest user):
 *
 *  - One free trial per device: registering a fresh email on the same PC
 *    after the first trial does not grant a new one.
 *  - A cap on how many distinct devices one account can be used from, so a
 *    login can't just be handed around to an unlimited number of installs.
 *
 * A determined abuser could still reinstall Windows or spoof the device ID —
 * this raises the bar meaningfully, it does not claim to be unbeatable.
 */
import { supabase } from "./supabase";
import { getDeviceId } from "./api";

const MAX_DEVICES_PER_ACCOUNT = 3;

export interface DeviceGuardResult {
  /** Whether the account-based free trial may apply on this device. */
  trialEligible: boolean;
  /** True once this account has been used from too many distinct devices. */
  deviceBlocked: boolean;
}

export async function checkDeviceGuard(email: string): Promise<DeviceGuardResult> {
  const open: DeviceGuardResult = { trialEligible: true, deviceBlocked: false };
  if (!supabase) return open;

  let deviceId: string | null = null;
  try {
    deviceId = await getDeviceId();
  } catch {
    return open;
  }
  if (!deviceId) return open;

  const normalizedEmail = email.toLowerCase();
  let trialEligible = true;
  try {
    const { data: existing } = await supabase
      .from("trial_devices")
      .select("email")
      .eq("device_id", deviceId)
      .maybeSingle();
    if (existing) {
      trialEligible = existing.email.toLowerCase() === normalizedEmail;
    } else {
      await supabase.from("trial_devices").insert({ device_id: deviceId, email: normalizedEmail });
    }
  } catch {
    /* best-effort — don't punish the user for a transient network error */
  }

  let deviceBlocked = false;
  try {
    const { data: devices } = await supabase
      .from("account_devices")
      .select("device_id")
      .eq("email", normalizedEmail);
    const known = (devices ?? []).map((d) => d.device_id as string);
    if (!known.includes(deviceId)) {
      if (known.length >= MAX_DEVICES_PER_ACCOUNT) {
        deviceBlocked = true;
      } else {
        await supabase.from("account_devices").insert({ email: normalizedEmail, device_id: deviceId });
      }
    }
  } catch {
    /* best-effort */
  }

  return { trialEligible, deviceBlocked };
}
