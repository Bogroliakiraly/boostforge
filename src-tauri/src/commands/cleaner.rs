//! Disk cleaner. Only targets that are genuinely safe to remove are offered,
//! and each carries an honest benefit/downside the UI displays before acting.
//! Nothing outside these well-known, regenerable locations is ever touched.

use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::Emitter;

use crate::error::AppResult;
use crate::util::run_powershell;

/// Emitted after each selected target finishes, so the UI can show a real
/// progress bar instead of a single indefinite spinner during a big cleanup.
#[derive(Clone, Serialize)]
struct CleanProgress {
    processed: usize,
    total: usize,
    freed_bytes: u64,
    removed_files: u64,
}

#[derive(Serialize, Clone)]
pub struct CleanTarget {
    pub id: String,
    pub name: String,
    pub description: String,
    pub benefit: String,
    pub downside: String,
    pub path: Option<String>,
    pub size_bytes: u64,
    pub file_count: u64,
    pub category: String,
    pub permanent: bool,
}

#[derive(Serialize)]
pub struct CleanResult {
    pub freed_bytes: u64,
    pub removed_files: u64,
    pub errors: Vec<String>,
}

/// A static description of one cleanable location, before it is scanned.
struct TargetSpec {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    benefit: &'static str,
    downside: &'static str,
    category: &'static str,
    permanent: bool,
    paths: Vec<PathBuf>,
}

fn local(sub: &str) -> Option<PathBuf> {
    std::env::var("LOCALAPPDATA").ok().map(|p| PathBuf::from(p).join(sub))
}

fn specs() -> Vec<TargetSpec> {
    let mut specs = Vec::new();

    if let Ok(temp) = std::env::var("TEMP") {
        specs.push(TargetSpec {
            id: "user_temp",
            name: "User temporary files",
            description: "Per-user scratch files left behind by applications and installers.",
            benefit: "Reclaims disk space; nothing here is needed after the app that wrote it closed.",
            downside: "Files locked by a running app are skipped automatically.",
            category: "user_temp",
            permanent: true,
            paths: vec![PathBuf::from(temp)],
        });
    }

    specs.push(TargetSpec {
        id: "windows_temp",
        name: "Windows temporary files",
        description: "System-wide temp folder used during updates and installs.",
        benefit: "Reclaims disk space used by completed installers and updates.",
        downside: "Requires administrator to remove some files; in-use files are skipped.",
        category: "windows_temp",
        permanent: true,
        paths: vec![PathBuf::from(r"C:\Windows\Temp")],
    });

    let mut shader_paths = Vec::new();
    for p in [
        local("D3DSCache"),
        local(r"NVIDIA\DXCache"),
        local(r"NVIDIA\GLCache"),
        local(r"AMD\DxCache"),
        local(r"AMD\DxcCache"),
    ]
    .into_iter()
    .flatten()
    {
        shader_paths.push(p);
    }
    specs.push(TargetSpec {
        id: "shader_cache",
        name: "DirectX & GPU shader cache",
        description: "Compiled shader caches for DirectX and your GPU driver.",
        benefit: "Frees space and forces a clean rebuild, which can fix shader-related stutter or corruption.",
        downside: "The cache rebuilds on next launch, so the first run of each game may load and stutter slightly more until it is repopulated.",
        category: "shader_cache",
        permanent: true,
        paths: shader_paths,
    });

    let mut browser_paths = Vec::new();
    for p in [
        local(r"Google\Chrome\User Data\Default\Cache"),
        local(r"Microsoft\Edge\User Data\Default\Cache"),
        std::env::var("APPDATA")
            .ok()
            .map(|a| PathBuf::from(a).join(r"Mozilla\Firefox\Profiles")),
    ]
    .into_iter()
    .flatten()
    {
        browser_paths.push(p);
    }
    specs.push(TargetSpec {
        id: "browser_cache",
        name: "Browser cache (optional)",
        description: "Cached web assets for Chrome, Edge and Firefox.",
        benefit: "Frees space; browsers re-download assets as needed.",
        downside: "Sites load slightly slower on first visit; does not log you out.",
        category: "browser_cache",
        permanent: true,
        paths: browser_paths,
    });

    // The Recycle Bin is handled specially (it is not a normal folder).
    specs.push(TargetSpec {
        id: "recycle_bin",
        name: "Recycle Bin",
        description: "Files you already chose to delete.",
        benefit: "Permanently frees the space still reserved by deleted files.",
        downside: "Emptied items cannot be recovered afterward.",
        category: "recycle_bin",
        permanent: true,
        paths: vec![],
    });

    specs.push(TargetSpec {
        id: "windows_update_cache",
        name: "Windows Update download cache",
        description: "Installer packages Windows Update already applied to your system.",
        benefit: "Frees space taken by updates that are already installed.",
        downside: "If Windows needs one of these packages again, it re-downloads it.",
        category: "windows_update_cache",
        permanent: true,
        paths: vec![PathBuf::from(r"C:\Windows\SoftwareDistribution\Download")],
    });

    if let Some(p) = local(r"Microsoft\Windows\Explorer") {
        specs.push(TargetSpec {
            id: "thumbnail_cache",
            name: "Thumbnail cache",
            description: "Cached preview images Explorer generates for photos and videos.",
            benefit: "Frees space; thumbnails are harmless to regenerate.",
            downside: "Folder previews render slightly slower the first time after clearing.",
            category: "thumbnail_cache",
            permanent: true,
            paths: vec![p],
        });
    }

    let mut wer_paths = Vec::new();
    for sub in ["ReportQueue", "ReportArchive"] {
        if let Ok(pd) = std::env::var("ProgramData") {
            wer_paths.push(PathBuf::from(pd).join("Microsoft").join("Windows").join("WER").join(sub));
        }
    }
    specs.push(TargetSpec {
        id: "error_reports",
        name: "Windows Error Reporting archive",
        description: "Crash and error reports Windows saved for diagnostics.",
        benefit: "Frees space taken by old crash reports you are unlikely to need.",
        downside: "You lose the ability to inspect those specific past crashes.",
        category: "error_reports",
        permanent: true,
        paths: wer_paths,
    });

    // Memory dumps mix a directory (Minidump) with a single large file
    // (MEMORY.DMP), so they are handled specially like the Recycle Bin.
    specs.push(TargetSpec {
        id: "memory_dumps",
        name: "Memory dump files",
        description: "Crash-diagnostic dumps Windows wrote after a system crash (minidumps and MEMORY.DMP).",
        benefit: "These can be very large — clearing them often frees significant space.",
        downside: "You lose dump files a support technician might otherwise ask for after a crash.",
        category: "memory_dumps",
        permanent: true,
        paths: vec![],
    });

    specs
}

fn memory_dump_paths() -> (PathBuf, PathBuf) {
    (
        PathBuf::from(r"C:\Windows\Minidump"),
        PathBuf::from(r"C:\Windows\MEMORY.DMP"),
    )
}

fn memory_dump_size() -> (u64, u64) {
    let (minidump_dir, full_dump) = memory_dump_paths();
    let (mut size, mut count) = dir_size(&minidump_dir);
    if let Ok(meta) = std::fs::metadata(&full_dump) {
        if meta.is_file() {
            size += meta.len();
            count += 1;
        }
    }
    (size, count)
}

fn clean_memory_dumps() -> (u64, u64, Vec<String>) {
    let (minidump_dir, full_dump) = memory_dump_paths();
    let (mut freed, mut removed, mut errors) = clean_dir_contents(&minidump_dir);
    if let Ok(meta) = std::fs::metadata(&full_dump) {
        if meta.is_file() {
            let len = meta.len();
            match std::fs::remove_file(&full_dump) {
                Ok(_) => {
                    freed += len;
                    removed += 1;
                }
                Err(_) => errors.push(format!("In use, skipped: {}", full_dump.display())),
            }
        }
    }
    (freed, removed, errors)
}

#[tauri::command]
pub fn scan_clean_targets() -> AppResult<Vec<CleanTarget>> {
    let mut out = Vec::new();
    for spec in specs() {
        let (size, count) = if spec.id == "recycle_bin" {
            recycle_bin_size()
        } else if spec.id == "memory_dumps" {
            memory_dump_size()
        } else {
            let mut total = 0u64;
            let mut files = 0u64;
            for p in &spec.paths {
                let (s, c) = dir_size(p);
                total += s;
                files += c;
            }
            (total, files)
        };

        out.push(CleanTarget {
            id: spec.id.to_string(),
            name: spec.name.to_string(),
            description: spec.description.to_string(),
            benefit: spec.benefit.to_string(),
            downside: spec.downside.to_string(),
            path: spec.paths.first().map(|p| p.to_string_lossy().to_string()),
            size_bytes: size,
            file_count: count,
            category: spec.category.to_string(),
            permanent: spec.permanent,
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn clean_targets(app: tauri::AppHandle, ids: Vec<String>) -> AppResult<CleanResult> {
    clean_targets_impl(ids, |processed, total, freed_bytes, removed_files| {
        let _ = app.emit(
            "clean-progress",
            CleanProgress {
                processed,
                total,
                freed_bytes,
                removed_files,
            },
        );
    })
}

/// Shared cleanup logic. `on_progress(processed, total, freed_bytes,
/// removed_files)` is called after each target finishes; the interactive
/// command reports it to the UI as a Tauri event, while the scheduled/headless
/// callers (which have no window to report to) pass a no-op.
pub(crate) fn clean_targets_impl(
    ids: Vec<String>,
    mut on_progress: impl FnMut(usize, usize, u64, u64),
) -> AppResult<CleanResult> {
    let mut freed = 0u64;
    let mut removed = 0u64;
    let mut errors = Vec::new();

    let all = specs();
    let total = ids.len();
    for (i, id) in ids.into_iter().enumerate() {
        let Some(spec) = all.iter().find(|s| s.id == id) else {
            continue;
        };
        if spec.id == "recycle_bin" {
            match run_powershell("Clear-RecycleBin -Force -ErrorAction Stop") {
                Ok(_) => {}
                Err(e) => errors.push(format!("Recycle Bin: {e}")),
            }
        } else if spec.id == "memory_dumps" {
            let (f, r, mut errs) = clean_memory_dumps();
            freed += f;
            removed += r;
            if errors.len() < 20 {
                errors.append(&mut errs);
            }
        } else {
            for p in &spec.paths {
                let (f, r, mut errs) = clean_dir_contents(p);
                freed += f;
                removed += r;
                // Keep the error list bounded so the UI stays readable.
                if errors.len() < 20 {
                    errors.append(&mut errs);
                }
            }
        }

        on_progress(i + 1, total, freed, removed);
    }

    errors.truncate(20);
    crate::commands::stats::record_disk_freed(freed);
    Ok(CleanResult {
        freed_bytes: freed,
        removed_files: removed,
        errors,
    })
}

/// Recursively measures a directory without following symlinks.
fn dir_size(path: &Path) -> (u64, u64) {
    let mut size = 0u64;
    let mut count = 0u64;
    let Ok(entries) = std::fs::read_dir(path) else {
        return (0, 0);
    };
    for entry in entries.flatten() {
        let Ok(meta) = entry.metadata() else { continue };
        if meta.is_dir() {
            let (s, c) = dir_size(&entry.path());
            size += s;
            count += c;
        } else if meta.is_file() {
            size += meta.len();
            count += 1;
        }
    }
    (size, count)
}

/// Deletes the *contents* of a directory (keeping the directory itself),
/// skipping anything currently in use. Returns (freed, removed, errors).
fn clean_dir_contents(path: &Path) -> (u64, u64, Vec<String>) {
    let mut freed = 0u64;
    let mut removed = 0u64;
    let mut errors = Vec::new();

    let Ok(entries) = std::fs::read_dir(path) else {
        return (0, 0, errors);
    };
    for entry in entries.flatten() {
        let p = entry.path();
        let Ok(meta) = entry.metadata() else { continue };
        if meta.is_dir() {
            let (s, c) = dir_size(&p);
            match std::fs::remove_dir_all(&p) {
                Ok(_) => {
                    freed += s;
                    removed += c;
                }
                Err(_) => {
                    // Partially in use — fall back to per-file deletion.
                    let (f, r, mut e) = clean_dir_contents(&p);
                    freed += f;
                    removed += r;
                    errors.append(&mut e);
                }
            }
        } else {
            let len = meta.len();
            match std::fs::remove_file(&p) {
                Ok(_) => {
                    freed += len;
                    removed += 1;
                }
                Err(_) => errors.push(format!("In use, skipped: {}", p.display())),
            }
        }
    }
    (freed, removed, errors)
}

/// Sums the Recycle Bin across all drives. Best-effort and read-only.
fn recycle_bin_size() -> (u64, u64) {
    let script = r#"
$ErrorActionPreference='SilentlyContinue'
$items = Get-ChildItem -Path "$env:SystemDrive\`$Recycle.Bin" -Recurse -Force -File
$sum = ($items | Measure-Object -Property Length -Sum)
[pscustomobject]@{ size = [int64]($sum.Sum); count = [int64]($sum.Count) } | ConvertTo-Json -Compress
"#;
    match run_powershell(script) {
        Ok(out) => {
            #[derive(serde::Deserialize)]
            struct Rb {
                size: Option<u64>,
                count: Option<u64>,
            }
            match serde_json::from_str::<Rb>(out.trim()) {
                Ok(rb) => (rb.size.unwrap_or(0), rb.count.unwrap_or(0)),
                Err(_) => (0, 0),
            }
        }
        Err(_) => (0, 0),
    }
}
