use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

use crate::AppState;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TraySettings {
    pub close_to_tray: bool,
    pub startup: bool,
}

/// Get current tray settings (close-to-tray & startup).
#[tauri::command]
pub async fn get_tray_settings(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<TraySettings, String> {
    let close_to_tray = state.close_to_tray.load(std::sync::atomic::Ordering::SeqCst);
    let startup = is_startup_enabled();
    Ok(TraySettings { close_to_tray, startup })
}

/// Toggle the "close button minimizes to tray" behavior.
#[tauri::command]
pub async fn set_close_to_tray(
    state: tauri::State<'_, Arc<AppState>>,
    app: AppHandle,
    enabled: bool,
) -> Result<TraySettings, String> {
    state
        .close_to_tray
        .store(enabled, std::sync::atomic::Ordering::SeqCst);
    if let Ok(data_dir) = app.path().app_data_dir() {
        write_tray_setting(&data_dir, "close_to_tray", &serde_json::Value::Bool(enabled));
    }
    let startup = is_startup_enabled();
    Ok(TraySettings { close_to_tray: enabled, startup })
}

/// Toggle Windows auto-start via registry.
#[tauri::command]
pub async fn set_startup_enabled(enabled: bool) -> Result<bool, String> {
    set_startup_enabled_platform(enabled);
    crate::refresh_tray_menu();
    Ok(is_startup_enabled())
}

// ── Platform helpers ────────────────────────────────────────────────

#[cfg(target_os = "windows")]
pub fn is_startup_enabled() -> bool {
    use std::process::Command;
    let output = Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
            "/v",
            "Mineradio-Next",
        ])
        .output();
    match output {
        Ok(o) => o.status.success(),
        Err(_) => false,
    }
}

#[cfg(not(target_os = "windows"))]
pub fn is_startup_enabled() -> bool {
    false
}

#[cfg(target_os = "windows")]
pub fn set_startup_enabled_platform(enabled: bool) {
    use std::process::Command;
    if enabled {
        let exe = std::env::current_exe()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let _ = Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "Mineradio-Next",
                "/t",
                "REG_SZ",
                "/d",
                &format!("\"{}\"", exe),
                "/f",
            ])
            .output();
    } else {
        let _ = Command::new("reg")
            .args([
                "delete",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "Mineradio-Next",
                "/f",
            ])
            .output();
    }
}

#[cfg(not(target_os = "windows"))]
pub fn set_startup_enabled_platform(_enabled: bool) {}

// ── Settings file helpers ───────────────────────────────────────────

fn read_settings_file(data_dir: &std::path::Path) -> serde_json::Value {
    let file = data_dir.join("tray-settings.json");
    match std::fs::read_to_string(&file) {
        Ok(text) => serde_json::from_str(&text).unwrap_or(serde_json::Value::Null),
        Err(_) => serde_json::Value::Null,
    }
}

pub fn write_tray_setting(data_dir: &std::path::Path, key: &str, value: &serde_json::Value) {
    let file = data_dir.join("tray-settings.json");
    let mut obj = match read_settings_file(data_dir) {
        serde_json::Value::Object(m) => serde_json::Value::Object(m),
        _ => serde_json::json!({}),
    };
    if let Some(map) = obj.as_object_mut() {
        map.insert(key.to_string(), value.clone());
    }
    let _ = std::fs::create_dir_all(data_dir);
    let _ = std::fs::write(&file, serde_json::to_string_pretty(&obj).unwrap_or_default());
}

/// Read `close_to_tray` from persisted settings file. Called at startup.
pub fn load_close_to_tray(data_dir: &std::path::Path) -> bool {
    let val = read_settings_file(data_dir);
    val.get("close_to_tray").and_then(|v| v.as_bool()).unwrap_or(true) // default ON
}
