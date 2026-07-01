//! Read-only system information: GPU, Windows build, drivers, pending updates,
//! installed software and services. These power the "Tools" tab.

use serde::{Deserialize, Serialize};
use winreg::enums::*;
use winreg::RegKey;

use crate::error::AppResult;
use crate::util::{parse_ps_array, run_powershell, run_powershell_timeout};

// --- GPU -------------------------------------------------------------------
#[derive(Serialize)]
pub struct GpuInfo {
    pub name: String,
    pub driver_version: Option<String>,
    pub driver_date: Option<String>,
    pub vram_total: Option<u64>,
    /// Real 3D-engine utilization from Windows' own performance counters —
    /// the same data source Task Manager's GPU graph uses. Works for any
    /// vendor without a proprietary SDK. `None` when the counter is
    /// unavailable (e.g. on some virtual machines) or when more than one GPU
    /// is present, since the counter does not reliably attribute usage to a
    /// specific adapter and we will not guess.
    pub utilization: Option<f32>,
}

#[tauri::command]
pub fn get_gpu_info() -> AppResult<Vec<GpuInfo>> {
    let script = r#"
Get-CimInstance Win32_VideoController | ForEach-Object {
  [pscustomobject]@{
    Name = $_.Name
    DriverVersion = $_.DriverVersion
    DriverDate = if ($_.DriverDate) { $_.DriverDate.ToString('yyyy-MM-dd') } else { $null }
    AdapterRAM = [int64]$_.AdapterRAM
  }
} | ConvertTo-Json -Depth 2
"#;

    #[derive(Deserialize)]
    struct Raw {
        #[serde(rename = "Name")]
        name: Option<String>,
        #[serde(rename = "DriverVersion")]
        driver_version: Option<String>,
        #[serde(rename = "DriverDate")]
        driver_date: Option<String>,
        #[serde(rename = "AdapterRAM")]
        adapter_ram: Option<i64>,
    }

    let raw: Vec<Raw> = parse_ps_array(&run_powershell(script)?)?;
    let mut gpus: Vec<GpuInfo> = raw
        .into_iter()
        .map(|r| GpuInfo {
            name: r.name.unwrap_or_else(|| "Unknown GPU".into()),
            driver_version: r.driver_version,
            driver_date: r.driver_date,
            // Win32_VideoController.AdapterRAM is a signed 32-bit value and
            // saturates at ~4 GB, so treat that ceiling as "unknown".
            vram_total: r.adapter_ram.and_then(|v| {
                if v > 0 && v < 4_290_000_000 {
                    Some(v as u64)
                } else {
                    None
                }
            }),
            utilization: None,
        })
        .collect();

    // Only attribute the counter to a GPU when exactly one is present —
    // with multiple adapters we cannot reliably tell which one it measured.
    if gpus.len() == 1 {
        if let Some(pct) = read_gpu_3d_utilization() {
            gpus[0].utilization = Some(pct);
        }
    }

    Ok(gpus)
}

/// Reads total "3D engine" utilization across all processes/adapters from
/// Windows' GPU performance counters — the same source Task Manager's GPU
/// graph uses. Real and measured, not vendor-specific, not invented.
fn read_gpu_3d_utilization() -> Option<f32> {
    let script = r#"
$ErrorActionPreference = 'Stop'
$samples = (Get-Counter '\GPU Engine(*engtype_3D)\Utilization Percentage').CounterSamples
$total = ($samples | Measure-Object -Property CookedValue -Sum).Sum
[math]::Round([math]::Min(100, $total), 1)
"#;
    run_powershell(script)
        .ok()
        .and_then(|out| out.trim().parse::<f32>().ok())
}

// --- Windows info ----------------------------------------------------------
#[derive(Serialize)]
pub struct WindowsInfo {
    pub edition: String,
    pub version: String,
    pub build: String,
    pub display_version: String,
    pub installed_ram: u64,
    pub computer_name: String,
    pub uptime_secs: u64,
}

#[tauri::command]
pub fn get_windows_info() -> AppResult<WindowsInfo> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let cv = hklm
        .open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
        .ok();

    let read = |name: &str| -> Option<String> {
        cv.as_ref().and_then(|k| k.get_value::<String, _>(name).ok())
    };

    let build_number = read("CurrentBuildNumber").unwrap_or_default();
    let ubr: Option<u32> = cv.as_ref().and_then(|k| k.get_value("UBR").ok());
    let build = match ubr {
        Some(u) => format!("{build_number}.{u}"),
        None => build_number.clone(),
    };

    Ok(WindowsInfo {
        edition: read("ProductName").unwrap_or_else(|| "Windows".into()),
        version: read("CurrentVersion").unwrap_or_default(),
        build,
        display_version: read("DisplayVersion")
            .or_else(|| read("ReleaseId"))
            .unwrap_or_default(),
        installed_ram: {
            let mut s = sysinfo::System::new();
            s.refresh_memory();
            s.total_memory()
        },
        computer_name: std::env::var("COMPUTERNAME").unwrap_or_default(),
        uptime_secs: sysinfo::System::uptime(),
    })
}

// --- Drivers ---------------------------------------------------------------
#[derive(Serialize)]
pub struct DriverInfo {
    pub device_name: String,
    pub driver_version: String,
    pub driver_date: Option<String>,
    pub provider: String,
    pub device_class: String,
}

#[tauri::command]
pub fn list_drivers() -> AppResult<Vec<DriverInfo>> {
    let script = r#"
Get-CimInstance Win32_PnPSignedDriver |
  Where-Object { $_.DeviceName -and $_.DriverVersion } |
  Select-Object -First 400 DeviceName, DriverVersion,
    @{N='DriverDate';E={ if ($_.DriverDate) { $_.DriverDate.ToString('yyyy-MM-dd') } else { $null } }},
    DriverProviderName, DeviceClass |
  ConvertTo-Json -Depth 2
"#;

    #[derive(Deserialize)]
    struct Raw {
        #[serde(rename = "DeviceName")]
        device_name: Option<String>,
        #[serde(rename = "DriverVersion")]
        driver_version: Option<String>,
        #[serde(rename = "DriverDate")]
        driver_date: Option<String>,
        #[serde(rename = "DriverProviderName")]
        provider: Option<String>,
        #[serde(rename = "DeviceClass")]
        device_class: Option<String>,
    }

    let raw: Vec<Raw> = parse_ps_array(&run_powershell(script)?)?;
    Ok(raw
        .into_iter()
        .map(|r| DriverInfo {
            device_name: r.device_name.unwrap_or_default(),
            driver_version: r.driver_version.unwrap_or_default(),
            driver_date: r.driver_date,
            provider: r.provider.unwrap_or_default(),
            device_class: r.device_class.unwrap_or_default(),
        })
        .collect())
}

// --- Windows Update --------------------------------------------------------
#[derive(Serialize)]
pub struct UpdateInfo {
    pub title: String,
    pub kb: Option<String>,
    pub severity: Option<String>,
}

#[tauri::command]
pub fn check_windows_updates() -> AppResult<Vec<UpdateInfo>> {
    // Queries the Windows Update agent for not-yet-installed updates. This can
    // take several seconds and may be blocked by policy on managed machines.
    let script = r#"
$ErrorActionPreference='Stop'
$session = New-Object -ComObject Microsoft.Update.Session
$searcher = $session.CreateUpdateSearcher()
$result = $searcher.Search("IsInstalled=0 and IsHidden=0")
$out = foreach ($u in $result.Updates) {
  $kb = ($u.KBArticleIDs | ForEach-Object { "KB$_" }) -join ', '
  [pscustomobject]@{
    Title = $u.Title
    KB = if ($kb) { $kb } else { $null }
    Severity = $u.MsrcSeverity
  }
}
$out | ConvertTo-Json -Depth 2
"#;

    #[derive(Deserialize)]
    struct Raw {
        #[serde(rename = "Title")]
        title: Option<String>,
        #[serde(rename = "KB")]
        kb: Option<String>,
        #[serde(rename = "Severity")]
        severity: Option<String>,
    }

    // The Windows Update agent can legitimately take much longer than a
    // typical WMI query, especially on first run or a managed machine.
    let raw: Vec<Raw> =
        parse_ps_array(&run_powershell_timeout(script, std::time::Duration::from_secs(45))?)?;
    Ok(raw
        .into_iter()
        .map(|r| UpdateInfo {
            title: r.title.unwrap_or_default(),
            kb: r.kb,
            severity: r.severity,
        })
        .collect())
}

// --- Installed software ----------------------------------------------------
#[derive(Serialize)]
pub struct SoftwareInfo {
    pub name: String,
    pub version: Option<String>,
    pub publisher: Option<String>,
    pub install_date: Option<String>,
    pub estimated_size: Option<u64>,
}

#[tauri::command]
pub fn list_installed_software() -> AppResult<Vec<SoftwareInfo>> {
    let mut out = Vec::new();
    let roots = [
        (
            RegKey::predef(HKEY_LOCAL_MACHINE),
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
        (
            RegKey::predef(HKEY_LOCAL_MACHINE),
            r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
        (
            RegKey::predef(HKEY_CURRENT_USER),
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
    ];

    for (root, path) in roots {
        let Ok(key) = root.open_subkey(path) else {
            continue;
        };
        for sub in key.enum_keys().flatten() {
            let Ok(app) = key.open_subkey(&sub) else { continue };
            let name: Option<String> = app.get_value("DisplayName").ok();
            let Some(name) = name else { continue };
            // Skip system components and updates that clutter the list.
            let system: u32 = app.get_value("SystemComponent").unwrap_or(0);
            if system == 1 {
                continue;
            }
            let size_kb: Option<u32> = app.get_value("EstimatedSize").ok();
            out.push(SoftwareInfo {
                name,
                version: app.get_value("DisplayVersion").ok(),
                publisher: app.get_value("Publisher").ok(),
                install_date: app.get_value("InstallDate").ok(),
                estimated_size: size_kb.map(|kb| kb as u64 * 1024),
            });
        }
    }

    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out.dedup_by(|a, b| a.name == b.name && a.version == b.version);
    Ok(out)
}

// --- Services --------------------------------------------------------------
#[derive(Serialize)]
pub struct ServiceInfo {
    pub name: String,
    pub display_name: String,
    pub status: String,
    pub start_type: String,
}

#[tauri::command]
pub fn list_services() -> AppResult<Vec<ServiceInfo>> {
    let script = r#"
Get-Service | Sort-Object DisplayName | Select-Object Name, DisplayName,
  @{N='Status';E={"$($_.Status)"}}, @{N='StartType';E={"$($_.StartType)"}} |
  ConvertTo-Json -Depth 2
"#;

    #[derive(Deserialize)]
    struct Raw {
        #[serde(rename = "Name")]
        name: Option<String>,
        #[serde(rename = "DisplayName")]
        display_name: Option<String>,
        #[serde(rename = "Status")]
        status: Option<String>,
        #[serde(rename = "StartType")]
        start_type: Option<String>,
    }

    let raw: Vec<Raw> = parse_ps_array(&run_powershell(script)?)?;
    Ok(raw
        .into_iter()
        .map(|r| ServiceInfo {
            name: r.name.unwrap_or_default(),
            display_name: r.display_name.unwrap_or_default(),
            status: r.status.unwrap_or_default(),
            start_type: r.start_type.unwrap_or_default(),
        })
        .collect())
}

// --- Device identity ---------------------------------------------------------
/// A stable per-Windows-installation identifier (the OS's own `MachineGuid`,
/// generated once by Windows setup). Used only to keep the free trial and
/// account-sharing checks honest — e.g. so the same PC can't mint a fresh
/// 1-day trial by registering a new email each time. It never leaves the
/// device except as this opaque GUID sent to the vendor's own backend.
#[tauri::command]
pub fn get_device_id() -> AppResult<String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let key = hklm
        .open_subkey(r"SOFTWARE\Microsoft\Cryptography")
        .map_err(|e| crate::error::AppError::Registry(e.to_string()))?;
    let guid: String = key
        .get_value("MachineGuid")
        .map_err(|e| crate::error::AppError::Registry(e.to_string()))?;
    Ok(guid)
}

// --- Elevation -------------------------------------------------------------
#[tauri::command]
pub fn is_elevated() -> AppResult<bool> {
    let script = r#"([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"#;
    let out = run_powershell(script)?;
    Ok(out.trim().eq_ignore_ascii_case("true"))
}
