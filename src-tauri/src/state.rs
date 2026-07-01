//! Shared, mutable application state guarded by mutexes. Sysinfo objects are
//! kept alive between calls so CPU/network deltas are accurate, and the action
//! log is persisted so undo history survives restarts.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Instant;

use serde::{Deserialize, Serialize};
use sysinfo::{Networks, System};

use crate::error::AppResult;
use crate::util::app_data_dir;

/// A single reversible change the user made through Tyverix.
#[derive(Clone, Serialize, Deserialize)]
pub struct ActionRecord {
    pub id: String,
    pub kind: String, // "startup_toggle" | "power_plan" | "game_mode"
    pub description: String,
    pub timestamp: String,
    pub reversible: bool,
    pub undone: bool,
    /// Opaque data needed to reverse the action; ignored by the frontend.
    #[serde(default)]
    pub payload: serde_json::Value,
}

#[derive(Default)]
pub struct GameModeState {
    pub active: bool,
    pub previous_plan: Option<String>,
    pub applied_plan: Option<String>,
    /// Previous `GameDVR_Enabled` registry value (`None` = the value didn't
    /// exist before, so restoring means deleting it rather than writing back).
    pub game_dvr_previous: Option<u32>,
    /// (exe path, previous `UserGpuPreferences` value) for each detected game
    /// we set to "High performance", so it can be restored exactly.
    pub gpu_pref_previous: Vec<(String, Option<String>)>,
    /// PIDs whose priority class we raised, to reset back to Normal.
    pub boosted_pids: Vec<u32>,
}

pub struct AppState {
    pub sys: Mutex<System>,
    pub networks: Mutex<Networks>,
    pub last_net_refresh: Mutex<Instant>,
    pub game: Mutex<GameModeState>,
    pub actions: Mutex<Vec<ActionRecord>>,
}

static COUNTER: AtomicU64 = AtomicU64::new(0);

impl AppState {
    pub fn new() -> Self {
        AppState {
            sys: Mutex::new(System::new()),
            networks: Mutex::new(Networks::new_with_refreshed_list()),
            last_net_refresh: Mutex::new(Instant::now()),
            game: Mutex::new(GameModeState::default()),
            actions: Mutex::new(load_actions()),
        }
    }

    /// Records a reversible action and persists the log to disk.
    pub fn record(&self, kind: &str, description: String, payload: serde_json::Value) {
        let id = format!(
            "act-{}-{}",
            chrono::Utc::now().timestamp_millis(),
            COUNTER.fetch_add(1, Ordering::Relaxed)
        );
        let rec = ActionRecord {
            id,
            kind: kind.to_string(),
            description,
            timestamp: chrono::Utc::now().to_rfc3339(),
            reversible: true,
            undone: false,
            payload,
        };
        if let Ok(mut log) = self.actions.lock() {
            log.insert(0, rec);
            log.truncate(200);
            let _ = save_actions(&log);
        }
    }

    pub fn mark_undone(&self, id: &str) {
        if let Ok(mut log) = self.actions.lock() {
            if let Some(rec) = log.iter_mut().find(|r| r.id == id) {
                rec.undone = true;
            }
            let _ = save_actions(&log);
        }
    }
}

fn actions_path() -> AppResult<std::path::PathBuf> {
    Ok(app_data_dir()?.join("actions.json"))
}

fn load_actions() -> Vec<ActionRecord> {
    let Ok(path) = actions_path() else {
        return Vec::new();
    };
    match std::fs::read_to_string(path) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

fn save_actions(log: &[ActionRecord]) -> AppResult<()> {
    let path = actions_path()?;
    std::fs::write(path, serde_json::to_string_pretty(log).unwrap_or_default())?;
    Ok(())
}
