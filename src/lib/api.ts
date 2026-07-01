/**
 * Thin, fully-typed wrapper around Tauri's `invoke`. Every backend command is
 * exposed here exactly once so the rest of the UI never touches raw strings.
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  ActionRecord,
  CleanResult,
  CleanTarget,
  CleanupScheduleStatus,
  DailyStat,
  DiskInfo,
  DriverInfo,
  FileEntry,
  GameModeStatus,
  GpuInfo,
  LatencyResult,
  LicenseStatus,
  MemoryFreeResult,
  PhysicalDiskHealth,
  PowerPlan,
  ProcessInfo,
  ServiceInfo,
  SoftwareInfo,
  StartupItem,
  SystemSnapshot,
  UpdateInfo,
  WindowsInfo,
} from "./types";

// --- Live monitoring -------------------------------------------------------
export const getSystemSnapshot = () =>
  invoke<SystemSnapshot>("get_system_snapshot");

export const getGpuInfo = () => invoke<GpuInfo[]>("get_gpu_info");

// --- Processes -------------------------------------------------------------
export const listProcesses = () => invoke<ProcessInfo[]>("list_processes");
export const killProcess = (pid: number) =>
  invoke<void>("kill_process", { pid });

// --- Startup ---------------------------------------------------------------
export const listStartupItems = () =>
  invoke<StartupItem[]>("list_startup_items");
export const setStartupEnabled = (id: string, enabled: boolean) =>
  invoke<void>("set_startup_enabled", { id, enabled });

// --- Cleaner ---------------------------------------------------------------
export const scanCleanTargets = () =>
  invoke<CleanTarget[]>("scan_clean_targets");
export const cleanTargets = (ids: string[]) =>
  invoke<CleanResult>("clean_targets", { ids });

// --- Disk ------------------------------------------------------------------
export const listDisks = () => invoke<DiskInfo[]>("list_disks");
export const diskHealth = () => invoke<PhysicalDiskHealth[]>("disk_health");
export const findLargeFiles = (root: string, minBytes: number) =>
  invoke<FileEntry[]>("find_large_files", { root, minBytes });

// --- Power & Game Mode -----------------------------------------------------
export const listPowerPlans = () => invoke<PowerPlan[]>("list_power_plans");
export const setPowerPlan = (guid: string) =>
  invoke<void>("set_power_plan", { guid });
export const getGameModeStatus = () =>
  invoke<GameModeStatus>("get_game_mode_status");
export const applyGameMode = () => invoke<GameModeStatus>("apply_game_mode");
export const restoreGameMode = () =>
  invoke<GameModeStatus>("restore_game_mode");

// --- Safety ----------------------------------------------------------------
export const createRestorePoint = (description: string) =>
  invoke<string>("create_restore_point", { description });
export const backupRegistry = () => invoke<string>("backup_registry");
export const listActionLog = () => invoke<ActionRecord[]>("list_action_log");
export const undoAction = (id: string) => invoke<void>("undo_action", { id });

// --- System information ----------------------------------------------------
export const getWindowsInfo = () => invoke<WindowsInfo>("get_windows_info");
export const listDrivers = () => invoke<DriverInfo[]>("list_drivers");
export const checkWindowsUpdates = () =>
  invoke<UpdateInfo[]>("check_windows_updates");
export const listInstalledSoftware = () =>
  invoke<SoftwareInfo[]>("list_installed_software");
export const listServices = () => invoke<ServiceInfo[]>("list_services");

export const isElevated = () => invoke<boolean>("is_elevated");
export const getDeviceId = () => invoke<string>("get_device_id");

// --- Daily reclaimed-space stats --------------------------------------------
export const getDailyStats = () => invoke<DailyStat[]>("get_daily_stats");

// --- Memory ----------------------------------------------------------------
export const freeMemory = (purgeStandby: boolean) =>
  invoke<MemoryFreeResult>("free_memory", { purgeStandby });

// --- Network (multiplayer latency) ------------------------------------------
export const measureLatency = (host: string, port: number, samples: number) =>
  invoke<LatencyResult>("measure_latency", { host, port, samples });

// --- Scheduled cleanup -------------------------------------------------------
export const getCleanupSchedule = () =>
  invoke<CleanupScheduleStatus>("get_cleanup_schedule");
export const setCleanupSchedule = (
  enabled: boolean,
  time: string,
  targetIds: string[],
) =>
  invoke<CleanupScheduleStatus>("set_cleanup_schedule", {
    enabled,
    time,
    targetIds,
  });
export const runScheduledCleanupNow = () =>
  invoke<CleanResult>("run_scheduled_cleanup_now");

// --- Licensing -------------------------------------------------------------
export const getLicenseStatus = () =>
  invoke<LicenseStatus>("get_license_status");
export const activateLicense = (key: string) =>
  invoke<LicenseStatus>("activate_license", { key });
export const deactivateLicense = () =>
  invoke<LicenseStatus>("deactivate_license");
