/**
 * TypeScript mirrors of the Rust structs returned by Tauri commands.
 * Field names are kept in snake_case to match serde's default serialization
 * so we never have to maintain a renaming layer.
 */

export interface CpuInfo {
  brand: string;
  usage: number; // overall %, 0-100
  per_core: number[]; // per logical core %, 0-100
  physical_cores: number | null;
  logical_cores: number;
  frequency_mhz: number; // current, may be 0 if unavailable
}

export interface MemoryInfo {
  total: number; // bytes
  used: number;
  available: number;
  swap_total: number;
  swap_used: number;
}

export interface NetworkInfo {
  rx_per_sec: number; // bytes/s since previous snapshot
  tx_per_sec: number;
  rx_total: number; // bytes since boot (per interface sum)
  tx_total: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_usage: number; // %
  memory: number; // bytes
  exe: string | null;
}

export interface SystemSnapshot {
  cpu: CpuInfo;
  memory: MemoryInfo;
  network: NetworkInfo;
  uptime_secs: number;
  process_count: number;
  top_processes: ProcessInfo[]; // sorted, capped server-side
}

/**
 * GPU information is intentionally honest: live utilization / VRAM are only
 * present when a vendor source can actually provide them. When `null`, the UI
 * must show "Not available" rather than inventing a number.
 */
export interface GpuInfo {
  name: string;
  driver_version: string | null;
  driver_date: string | null;
  vram_total: number | null; // bytes
  utilization: number | null; // %, null when not obtainable
}

export type CleanCategory =
  | "windows_temp"
  | "user_temp"
  | "recycle_bin"
  | "shader_cache"
  | "browser_cache"
  | "windows_update_cache"
  | "thumbnail_cache"
  | "error_reports"
  | "memory_dumps";

export interface CleanTarget {
  id: string;
  name: string;
  description: string;
  /** Why removing this is safe and what the measurable benefit is. */
  benefit: string;
  downside: string;
  path: string | null;
  size_bytes: number;
  file_count: number;
  category: CleanCategory;
  /** Whether deletion is permanent (true) or recoverable via Recycle Bin. */
  permanent: boolean;
}

export interface CleanResult {
  freed_bytes: number;
  removed_files: number;
  errors: string[];
}

export type StartupLocation =
  | "registry_hkcu_run"
  | "registry_hklm_run"
  | "startup_folder_user"
  | "startup_folder_common";

export interface StartupItem {
  id: string;
  name: string;
  command: string;
  location: StartupLocation;
  enabled: boolean;
  /** Best-effort publisher / source description. */
  source: string;
}

export interface DiskInfo {
  name: string;
  mount_point: string;
  file_system: string;
  total: number;
  available: number;
  removable: boolean;
  kind: string; // "SSD" | "HDD" | "Unknown"
}

export interface PhysicalDiskHealth {
  friendly_name: string;
  media_type: string;
  health_status: string; // "Healthy" | "Warning" | "Unhealthy" | "Unknown"
  size: number;
  wear: number | null; // % used endurance, SSD only when available
  temperature: number | null; // °C when available
}

export interface PowerPlan {
  guid: string;
  name: string;
  active: boolean;
}

export interface GameModeStatus {
  active: boolean;
  /** GUID of the power plan that was active before Game Mode engaged. */
  previous_plan: string | null;
  applied_plan: string | null;
  detected_games: string[];
}

export interface WindowsInfo {
  edition: string;
  version: string; // e.g. "23H2"
  build: string;
  display_version: string;
  installed_ram: number;
  computer_name: string;
  uptime_secs: number;
}

export interface DriverInfo {
  device_name: string;
  driver_version: string;
  driver_date: string | null;
  provider: string;
  device_class: string;
}

export interface UpdateInfo {
  title: string;
  kb: string | null;
  severity: string | null;
}

export interface SoftwareInfo {
  name: string;
  version: string | null;
  publisher: string | null;
  install_date: string | null;
  estimated_size: number | null; // bytes
}

export interface ServiceInfo {
  name: string;
  display_name: string;
  status: string; // "Running" | "Stopped" | ...
  start_type: string;
}

export type ActionKind =
  | "startup_toggle"
  | "power_plan"
  | "game_mode";

export interface ActionRecord {
  id: string;
  kind: ActionKind;
  description: string;
  timestamp: string; // ISO 8601
  reversible: boolean;
  undone: boolean;
}

export interface FileEntry {
  path: string;
  size: number;
  modified: string | null;
}

export interface MemoryFreeResult {
  freed_bytes: number; // measured delta (after - before), may be negative
  available_before: number;
  available_after: number;
  total: number;
  processes_trimmed: number;
  standby_purged: boolean;
}

export interface LatencyResult {
  host: string;
  port: number;
  sent: number;
  received: number;
  lost: number;
  min_ms: number;
  max_ms: number;
  avg_ms: number;
  jitter_ms: number;
  samples_ms: number[];
}

export interface CleanupSchedule {
  enabled: boolean;
  time: string; // "HH:MM"
  target_ids: string[];
}

export interface CleanupScheduleStatus {
  schedule: CleanupSchedule;
  last_run: string | null;
  last_freed_bytes: number | null;
  last_removed_files: number | null;
}

export interface DailyStat {
  date: string; // "YYYY-MM-DD"
  disk_freed_bytes: number;
  memory_freed_bytes: number;
}

export type Tier = "free" | "trial" | "pro";

export interface LicenseStatus {
  tier: Tier;
  valid: boolean;
  email: string | null;
  expires: string | null;
  days_remaining: number | null;
  trial_days_remaining: number | null;
  reason: string | null;
}
