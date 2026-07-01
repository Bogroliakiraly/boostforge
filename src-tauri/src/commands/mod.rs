//! Command modules grouped by feature area. Each `#[tauri::command]` is
//! re-exported through these sub-modules and registered in `lib.rs`.

pub mod cleaner;
pub mod disk;
pub mod license;
pub mod memory;
pub mod monitor;
pub mod network;
pub mod power;
pub mod safety;
pub mod schedule;
pub mod startup;
pub mod stats;
pub mod system_info;
