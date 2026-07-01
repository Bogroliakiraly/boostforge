//! Real, measurable RAM reclamation.
//!
//! This is deliberately NOT a placebo "RAM booster". It performs two genuine
//! Windows operations and reports the *measured* change in available physical
//! memory (read from the OS), never an invented number:
//!
//! 1. **Working-set trim** — calls `EmptyWorkingSet` on background processes,
//!    asking Windows to move their cold pages out of physical RAM. The OS would
//!    do this under pressure anyway; doing it proactively *before* launching a
//!    game frees RAM up front so the game pages in less during play.
//! 2. **Standby-list purge** (administrator only) — asks the memory manager to
//!    drop the cached "standby" pages back to the free list. Useful in the rare
//!    cases where a large standby list is not released quickly enough.
//!
//! Honest downside (shown in the UI): trimmed apps reload their pages from disk
//! the next time you switch to them, so they feel slightly slower for a moment.

use std::ffi::c_void;

use serde::Serialize;
use sysinfo::System;

use crate::error::{AppError, AppResult};

use windows::core::{s, w, PCWSTR};
use windows::Win32::Foundation::{CloseHandle, HANDLE, LUID};
use windows::Win32::Security::{
    AdjustTokenPrivileges, LookupPrivilegeValueW, LUID_AND_ATTRIBUTES, SE_PRIVILEGE_ENABLED,
    TOKEN_ADJUST_PRIVILEGES, TOKEN_PRIVILEGES, TOKEN_QUERY,
};
use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryA};
use windows::Win32::System::ProcessStatus::EmptyWorkingSet;
use windows::Win32::System::Threading::{
    GetCurrentProcess, OpenProcess, OpenProcessToken, PROCESS_QUERY_INFORMATION, PROCESS_SET_QUOTA,
};

#[derive(Serialize)]
pub struct MemoryFreeResult {
    /// Measured change in available memory (after - before). Can be small or
    /// even negative if other apps allocated during the operation — we report
    /// the true delta rather than a flattering one.
    pub freed_bytes: i64,
    pub available_before: u64,
    pub available_after: u64,
    pub total: u64,
    pub processes_trimmed: u32,
    pub standby_purged: bool,
}

#[tauri::command]
pub fn free_memory(purge_standby: bool) -> AppResult<MemoryFreeResult> {
    let mut sys = System::new();
    sys.refresh_memory();
    let before = sys.available_memory();
    let total = sys.total_memory();

    let self_pid = std::process::id();
    let processes_trimmed = trim_all_working_sets(self_pid);

    let mut standby_purged = false;
    if purge_standby {
        // Best-effort: silently fails without administrator rights.
        standby_purged = purge_standby_list().is_ok();
    }

    // Give the memory manager a moment to settle before re-measuring.
    std::thread::sleep(std::time::Duration::from_millis(350));
    sys.refresh_memory();
    let after = sys.available_memory();
    let freed_bytes = after as i64 - before as i64;
    crate::commands::stats::record_memory_freed(freed_bytes);

    Ok(MemoryFreeResult {
        freed_bytes,
        available_before: before,
        available_after: after,
        total,
        processes_trimmed,
        standby_purged,
    })
}

/// Trims the working set of every process we are allowed to open, except our
/// own process and the kernel/System idle pseudo-processes.
fn trim_all_working_sets(skip_pid: u32) -> u32 {
    let mut sys = System::new();
    sys.refresh_processes();
    let mut count = 0u32;

    for pid in sys.processes().keys() {
        let id = pid.as_u32();
        if id == 0 || id == 4 || id == skip_pid {
            continue;
        }
        unsafe {
            if let Ok(handle) = OpenProcess(
                PROCESS_QUERY_INFORMATION | PROCESS_SET_QUOTA,
                false,
                id,
            ) {
                if handle.0 != std::ptr::null_mut() {
                    let _ = EmptyWorkingSet(handle);
                    let _ = CloseHandle(handle);
                    count += 1;
                }
            }
        }
    }
    count
}

/// Purges the system standby (cached) page list via the undocumented but
/// long-stable `NtSetSystemInformation(SystemMemoryListInformation)` call,
/// the same mechanism Sysinternals RAMMap uses.
fn purge_standby_list() -> AppResult<()> {
    const SYSTEM_MEMORY_LIST_INFORMATION: i32 = 0x50; // 80
    const MEMORY_PURGE_STANDBY_LIST: i32 = 4;

    unsafe {
        enable_privilege(w!("SeProfileSingleProcessPrivilege"))?;

        let ntdll = LoadLibraryA(s!("ntdll.dll"))
            .map_err(|e| AppError::other(format!("LoadLibrary ntdll: {e}")))?;
        let proc = GetProcAddress(ntdll, s!("NtSetSystemInformation"))
            .ok_or_else(|| AppError::other("NtSetSystemInformation not found"))?;

        type NtSetSystemInformation =
            unsafe extern "system" fn(i32, *mut c_void, u32) -> i32;
        let func: NtSetSystemInformation = std::mem::transmute(proc);

        let mut command: i32 = MEMORY_PURGE_STANDBY_LIST;
        let status = func(
            SYSTEM_MEMORY_LIST_INFORMATION,
            &mut command as *mut _ as *mut c_void,
            std::mem::size_of::<i32>() as u32,
        );
        if status != 0 {
            return Err(AppError::other(format!(
                "standby purge failed (status {status:#x}) — requires administrator"
            )));
        }
    }
    Ok(())
}

/// Enables a named privilege on the current process token.
unsafe fn enable_privilege(name: PCWSTR) -> AppResult<()> {
    let mut token = HANDLE::default();
    OpenProcessToken(
        GetCurrentProcess(),
        TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY,
        &mut token,
    )
    .map_err(|e| AppError::other(format!("OpenProcessToken: {e}")))?;

    let mut luid = LUID::default();
    LookupPrivilegeValueW(PCWSTR::null(), name, &mut luid)
        .map_err(|e| AppError::other(format!("LookupPrivilegeValue: {e}")))?;

    let tp = TOKEN_PRIVILEGES {
        PrivilegeCount: 1,
        Privileges: [LUID_AND_ATTRIBUTES {
            Luid: luid,
            Attributes: SE_PRIVILEGE_ENABLED,
        }],
    };

    let result = AdjustTokenPrivileges(token, false, Some(&tp), 0, None, None);
    let _ = CloseHandle(token);
    result.map_err(|e| AppError::other(format!("AdjustTokenPrivileges: {e}")))?;
    Ok(())
}
