//! Daily reclaimed-space tally (disk + memory), shown on the Dashboard.
//! Purely additive bookkeeping on top of the real, measured results the
//! cleaner and memory commands already return — never an invented number.

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::util::app_data_dir;

#[derive(Serialize, Deserialize, Clone)]
pub struct DailyStat {
    pub date: String, // "YYYY-MM-DD", local time
    pub disk_freed_bytes: u64,
    pub memory_freed_bytes: u64,
}

fn stats_path() -> AppResult<std::path::PathBuf> {
    Ok(app_data_dir()?.join("daily_stats.json"))
}

fn read_all() -> Vec<DailyStat> {
    stats_path()
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

fn write_all(stats: &[DailyStat]) -> AppResult<()> {
    let text = serde_json::to_string_pretty(stats).map_err(|e| AppError::Parse(e.to_string()))?;
    std::fs::write(stats_path()?, text)?;
    Ok(())
}

fn today() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

/// Adds to today's tally (creating it if needed) and keeps at most 30 days of
/// history on disk.
fn add(disk_bytes: u64, memory_bytes: u64) {
    let mut stats = read_all();
    let today_str = today();
    match stats.iter_mut().find(|s| s.date == today_str) {
        Some(entry) => {
            entry.disk_freed_bytes += disk_bytes;
            entry.memory_freed_bytes += memory_bytes;
        }
        None => stats.push(DailyStat {
            date: today_str,
            disk_freed_bytes: disk_bytes,
            memory_freed_bytes: memory_bytes,
        }),
    }
    stats.sort_by(|a, b| a.date.cmp(&b.date));
    if stats.len() > 30 {
        let excess = stats.len() - 30;
        stats.drain(0..excess);
    }
    let _ = write_all(&stats);
}

/// Called after a cleanup (manual, scheduled, or headless) with the bytes it
/// actually freed.
pub fn record_disk_freed(bytes: u64) {
    if bytes > 0 {
        add(bytes, 0);
    }
}

/// Called after `free_memory` with the measured delta. Ignores zero/negative
/// deltas (nothing was actually reclaimed) rather than logging a fake gain.
pub fn record_memory_freed(bytes: i64) {
    if bytes > 0 {
        add(0, bytes as u64);
    }
}

/// Returns up to the last 14 days, oldest first, for the Dashboard's summary
/// card and mini chart.
#[tauri::command]
pub fn get_daily_stats() -> AppResult<Vec<DailyStat>> {
    let mut stats = read_all();
    stats.sort_by(|a, b| a.date.cmp(&b.date));
    let take = stats.len().saturating_sub(14);
    Ok(stats.split_off(take))
}
