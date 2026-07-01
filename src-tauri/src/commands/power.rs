//! Power-plan control and Game Mode.
//!
//! Every Game Mode change is a real, documented Windows mechanism — never a
//! placebo tweak, and never sold with an invented FPS number:
//!   1. Power plan → High/Ultimate Performance (prevents CPU core-parking and
//!      down-clocking).
//!   2. Xbox Game Bar / Game DVR's background capture is turned off (a known,
//!      real source of CPU/GPU overhead in some games).
//!   3. Detected game executables are set to "high performance" in Windows'
//!      per-app GPU preference, and their process priority is raised one
//!      notch (the same technique tools like Process Lasso use).
//! Everything here is reversed exactly when Game Mode is turned off. Tyverix
//! intentionally makes no unverifiable "FPS boost" claims — the real effect
//! depends entirely on the game and the hardware.

use serde::{Deserialize, Serialize};
use tauri::State;
use winreg::enums::*;
use winreg::RegKey;

use crate::error::{AppError, AppResult};
use crate::state::AppState;
use crate::util::{parse_ps_array, run_command, run_powershell};

const ULTIMATE_GUID: &str = "e9a42b02-d5df-448d-aa00-03f14749eb61";
const HIGH_PERF_GUID: &str = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";

#[derive(Serialize, Clone)]
pub struct PowerPlan {
    pub guid: String,
    pub name: String,
    pub active: bool,
}

#[tauri::command]
pub fn list_power_plans() -> AppResult<Vec<PowerPlan>> {
    parse_powercfg_list()
}

#[tauri::command]
pub fn set_power_plan(state: State<AppState>, guid: String) -> AppResult<()> {
    let previous = active_plan_guid().ok();
    set_active(&guid)?;
    if let Some(prev) = previous {
        if prev != guid {
            state.record(
                "power_plan",
                format!("Switched power plan to {}", plan_name(&guid)),
                serde_json::json!({ "previous_guid": prev }),
            );
        }
    }
    Ok(())
}

#[derive(Serialize)]
pub struct GameModeStatus {
    pub active: bool,
    pub previous_plan: Option<String>,
    pub applied_plan: Option<String>,
    pub detected_games: Vec<String>,
}

#[tauri::command]
pub fn get_game_mode_status(state: State<AppState>) -> AppResult<GameModeStatus> {
    let game = state
        .game
        .lock()
        .map_err(|_| AppError::other("game state locked"))?;
    Ok(GameModeStatus {
        active: game.active,
        previous_plan: game.previous_plan.clone(),
        applied_plan: game.applied_plan.clone(),
        detected_games: detect_games(&state),
    })
}

#[tauri::command]
pub fn apply_game_mode(state: State<AppState>) -> AppResult<GameModeStatus> {
    let target = ensure_performance_plan()?;
    let previous = active_plan_guid().ok();
    set_active(&target)?;

    let game_dvr_previous = disable_game_dvr();

    let detected = detect_game_processes(&state);
    let mut gpu_pref_previous = Vec::new();
    let mut boosted_pids = Vec::new();
    for g in &detected {
        if let Some(exe) = &g.exe_path {
            gpu_pref_previous.push((exe.clone(), set_gpu_preference_for(exe)));
        }
        if boost_process_priority(g.pid) {
            boosted_pids.push(g.pid);
        }
    }

    {
        let mut game = state
            .game
            .lock()
            .map_err(|_| AppError::other("game state locked"))?;
        game.active = true;
        game.previous_plan = previous.clone();
        game.applied_plan = Some(target.clone());
        game.game_dvr_previous = game_dvr_previous;
        game.gpu_pref_previous = gpu_pref_previous;
        game.boosted_pids = boosted_pids;
    }

    if let Some(prev) = previous {
        state.record(
            "game_mode",
            "Engaged Game Mode (performance power plan)".into(),
            serde_json::json!({ "previous_guid": prev }),
        );
    }

    get_game_mode_status(state)
}

#[tauri::command]
pub fn restore_game_mode(state: State<AppState>) -> AppResult<GameModeStatus> {
    let (previous, game_dvr_previous, gpu_pref_previous, boosted_pids) = {
        let game = state
            .game
            .lock()
            .map_err(|_| AppError::other("game state locked"))?;
        (
            game.previous_plan.clone(),
            game.game_dvr_previous,
            game.gpu_pref_previous.clone(),
            game.boosted_pids.clone(),
        )
    };
    if let Some(prev) = previous {
        set_active(&prev)?;
    }
    restore_game_dvr(game_dvr_previous);
    for (exe, prev) in &gpu_pref_previous {
        restore_gpu_preference_for(exe, prev.as_ref());
    }
    for pid in &boosted_pids {
        restore_process_priority(*pid);
    }
    {
        let mut game = state
            .game
            .lock()
            .map_err(|_| AppError::other("game state locked"))?;
        game.active = false;
        game.applied_plan = None;
        game.previous_plan = None;
        game.game_dvr_previous = None;
        game.gpu_pref_previous = Vec::new();
        game.boosted_pids = Vec::new();
    }
    get_game_mode_status(state)
}

/// Sets a power plan active. Public so the undo system can reuse it.
pub fn set_active(guid: &str) -> AppResult<()> {
    run_command("powercfg", &["/setactive", guid]).map(|_| ())
}

/// Power plan names are localized (e.g. "Kiegyensúlyozott" on Hungarian
/// Windows) and `powercfg`'s raw console output is encoded in the system's
/// OEM codepage, which mangles non-ASCII text if read as UTF-8. Routing
/// through PowerShell's `ConvertTo-Json` sidesteps that entirely — non-ASCII
/// characters are escaped as `\uXXXX` in the JSON text, which `serde_json`
/// decodes correctly regardless of console codepage.
fn active_plan_guid() -> AppResult<String> {
    let script = r#"
$line = powercfg /getactivescheme
if ($line -match '([0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12})') {
  $matches[1]
}
"#;
    let out = run_powershell(script)?;
    let guid = out.trim().to_string();
    if guid.is_empty() {
        Err(AppError::other("could not determine active power plan"))
    } else {
        Ok(guid)
    }
}

fn parse_powercfg_list() -> AppResult<Vec<PowerPlan>> {
    // `powercfg`'s narrow-text console output is decoded by PowerShell itself
    // using the active console codepage (the OEM codepage, e.g. 852 on
    // Hungarian Windows) — not UTF-8 — which is what actually mangles
    // accented plan names. Switching the session to the UTF-8 codepage
    // before invoking it, and telling PowerShell to decode with the same
    // encoding, fixes the capture at the source.
    let script = r#"
chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
powercfg /list | ForEach-Object {
  if ($_ -match '([0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12})\s*\(([^)]*)\)\s*(\*)?\s*$') {
    [pscustomobject]@{
      Guid = $matches[1]
      Name = $matches[2]
      Active = [bool]$matches[3]
    }
  }
} | ConvertTo-Json -Depth 2
"#;

    #[derive(Deserialize)]
    struct Raw {
        #[serde(rename = "Guid")]
        guid: String,
        #[serde(rename = "Name")]
        name: String,
        #[serde(rename = "Active")]
        active: bool,
    }

    let raw: Vec<Raw> = parse_ps_array(&run_powershell(script)?)?;
    Ok(raw
        .into_iter()
        .map(|r| PowerPlan {
            guid: r.guid,
            name: r.name.trim().to_string(),
            active: r.active,
        })
        .collect())
}

/// Returns the GUID of a performance plan, creating the Ultimate Performance
/// plan from its template if neither it nor High Performance exist yet.
fn ensure_performance_plan() -> AppResult<String> {
    let plans = parse_powercfg_list()?;
    if let Some(p) = plans
        .iter()
        .find(|p| p.guid.eq_ignore_ascii_case(ULTIMATE_GUID) || p.name.to_lowercase().contains("ultimate"))
    {
        return Ok(p.guid.clone());
    }
    if let Some(p) = plans
        .iter()
        .find(|p| p.guid.eq_ignore_ascii_case(HIGH_PERF_GUID) || p.name.to_lowercase().contains("high performance"))
    {
        return Ok(p.guid.clone());
    }
    // Create Ultimate Performance from the well-known template.
    let script = format!(
        r#"
$out = powercfg -duplicatescheme {ULTIMATE_GUID}
if ($out -match '([0-9a-fA-F-]{{8}}-[0-9a-fA-F-]{{4}}-[0-9a-fA-F-]{{4}}-[0-9a-fA-F-]{{4}}-[0-9a-fA-F-]{{12}})') {{
  $matches[1]
}}
"#
    );
    let out = run_powershell(&script)?;
    let guid = out.trim().to_string();
    if !guid.is_empty() {
        Ok(guid)
    } else {
        // Fall back to the canonical High Performance GUID.
        Ok(HIGH_PERF_GUID.to_string())
    }
}

fn plan_name(guid: &str) -> String {
    parse_powercfg_list()
        .ok()
        .and_then(|plans| plans.into_iter().find(|p| p.guid.eq_ignore_ascii_case(guid)))
        .map(|p| p.name)
        .unwrap_or_else(|| guid.to_string())
}

const KNOWN_GAMES: &[(&str, &str)] = &[
    ("steam.exe", "Steam"),
    ("EpicGamesLauncher.exe", "Epic Games"),
    ("Battle.net.exe", "Battle.net"),
    ("RiotClientServices.exe", "Riot Client"),
    ("cs2.exe", "Counter-Strike 2"),
    ("VALORANT-Win64-Shipping.exe", "VALORANT"),
    ("FortniteClient-Win64-Shipping.exe", "Fortnite"),
    ("javaw.exe", "Minecraft (Java)"),
    ("LeagueofLegends.exe", "League of Legends"),
    ("GTA5.exe", "Grand Theft Auto V"),
    ("Cyberpunk2077.exe", "Cyberpunk 2077"),
    ("eldenring.exe", "Elden Ring"),
];

struct DetectedGame {
    pid: u32,
    exe_path: Option<String>,
    label: String,
}

/// Detects well-known game / launcher processes currently running, with their
/// PID and full path so Game Mode can target them (GPU preference, priority).
fn detect_game_processes(state: &State<AppState>) -> Vec<DetectedGame> {
    let Ok(sys) = state.sys.lock() else {
        return Vec::new();
    };
    sys.processes()
        .iter()
        .filter_map(|(pid, p)| {
            let name = p.name();
            KNOWN_GAMES
                .iter()
                .find(|(exe, _)| exe.eq_ignore_ascii_case(name))
                .map(|(_, label)| DetectedGame {
                    pid: pid.as_u32(),
                    exe_path: p.exe().map(|e| e.to_string_lossy().to_string()),
                    label: label.to_string(),
                })
        })
        .collect()
}

/// Informational only — Game Mode never auto-engages without user consent.
fn detect_games(state: &State<AppState>) -> Vec<String> {
    let mut found = Vec::new();
    for g in detect_game_processes(state) {
        if !found.contains(&g.label) {
            found.push(g.label);
        }
    }
    found
}

// --- Xbox Game Bar / Game DVR ------------------------------------------------
/// Game DVR's background capture hooks are a documented, real source of
/// CPU/GPU overhead in some games. Disabling it is a plain per-user registry
/// value, no admin needed. Returns the previous value (`None` if it didn't
/// exist) so it can be restored exactly.
fn disable_game_dvr() -> Option<u32> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let Ok((key, _)) = hkcu.create_subkey(r"System\GameConfigStore") else {
        return None;
    };
    let previous: Option<u32> = key.get_value("GameDVR_Enabled").ok();
    let _ = key.set_value("GameDVR_Enabled", &0u32);
    previous
}

fn restore_game_dvr(previous: Option<u32>) {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let Ok(key) = hkcu.open_subkey_with_flags(r"System\GameConfigStore", KEY_SET_VALUE) else {
        return;
    };
    match previous {
        Some(v) => {
            let _ = key.set_value("GameDVR_Enabled", &v);
        }
        None => {
            let _ = key.delete_value("GameDVR_Enabled");
        }
    }
}

// --- Per-app GPU preference ---------------------------------------------------
/// Sets a detected game's Windows GPU preference to "High performance"
/// (`HKCU\...\DirectX\UserGpuPreferences`, keyed by full exe path) — the same
/// setting Settings → Display → Graphics exposes per-app. Returns the
/// previous value for that exe, if any, so it can be restored exactly.
fn set_gpu_preference_for(exe_path: &str) -> Option<String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let Ok((key, _)) = hkcu.create_subkey(r"Software\Microsoft\DirectX\UserGpuPreferences") else {
        return None;
    };
    let previous: Option<String> = key.get_value(exe_path).ok();
    let _ = key.set_value(exe_path, &"GpuPreference=2;".to_string());
    previous
}

fn restore_gpu_preference_for(exe_path: &str, previous: Option<&String>) {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let Ok(key) = hkcu.open_subkey_with_flags(
        r"Software\Microsoft\DirectX\UserGpuPreferences",
        KEY_SET_VALUE,
    ) else {
        return;
    };
    match previous {
        Some(v) => {
            let _ = key.set_value(exe_path, v);
        }
        None => {
            let _ = key.delete_value(exe_path);
        }
    }
}

// --- Process priority ---------------------------------------------------------
/// Raises a detected game's scheduling priority one notch (Normal → Above
/// Normal) — the same technique tools like Process Lasso use to give a game's
/// threads a scheduling edge over background processes. Returns whether it
/// actually took effect.
fn boost_process_priority(pid: u32) -> bool {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, SetPriorityClass, ABOVE_NORMAL_PRIORITY_CLASS, PROCESS_QUERY_INFORMATION,
        PROCESS_SET_INFORMATION,
    };
    unsafe {
        let Ok(handle) = OpenProcess(PROCESS_SET_INFORMATION | PROCESS_QUERY_INFORMATION, false, pid)
        else {
            return false;
        };
        let ok = SetPriorityClass(handle, ABOVE_NORMAL_PRIORITY_CLASS).is_ok();
        let _ = CloseHandle(handle);
        ok
    }
}

fn restore_process_priority(pid: u32) {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, SetPriorityClass, NORMAL_PRIORITY_CLASS, PROCESS_QUERY_INFORMATION,
        PROCESS_SET_INFORMATION,
    };
    unsafe {
        if let Ok(handle) =
            OpenProcess(PROCESS_SET_INFORMATION | PROCESS_QUERY_INFORMATION, false, pid)
        {
            let _ = SetPriorityClass(handle, NORMAL_PRIORITY_CLASS);
            let _ = CloseHandle(handle);
        }
    }
}
