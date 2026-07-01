use serde::Serialize;
use tauri::{Emitter, Window};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
    pub is_maximized: bool,
    pub is_minimized: bool,
    pub is_fullscreen: bool,
    #[serde(rename = "isFullScreen")]
    pub is_full_screen: bool,
    #[serde(rename = "isNativeFullScreen")]
    pub is_native_full_screen: bool,
    pub width: f64,
    pub height: f64,
    pub x: f64,
    pub y: f64,
    pub focused: bool,
}

pub fn get_state(win: &Window) -> WindowState {
    let sf = win.scale_factor().unwrap_or(1.0);
    let size = win.inner_size().unwrap_or_default();
    let pos = win.outer_position().unwrap_or_default();
    let is_fs = win.is_fullscreen().unwrap_or(false);
    WindowState {
        is_maximized: win.is_maximized().unwrap_or(false),
        is_minimized: win.is_minimized().unwrap_or(false),
        is_fullscreen: is_fs,
        is_full_screen: is_fs,
        is_native_full_screen: is_fs,
        width: size.width as f64 / sf,
        height: size.height as f64 / sf,
        x: pos.x as f64 / sf,
        y: pos.y as f64 / sf,
        focused: win.is_focused().unwrap_or(false),
    }
}

fn emit_state(win: &Window) {
    let _ = win.emit("desktop-window-state", get_state(win));
}

#[tauri::command]
pub async fn window_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_toggle_maximize(window: Window) -> Result<(), String> {
    let maximized = window.is_maximized().unwrap_or(false);
    if maximized {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn window_toggle_fullscreen(window: Window) -> Result<(), String> {
    let fs = window.is_fullscreen().unwrap_or(false);
    window.set_fullscreen(!fs).map_err(|e| e.to_string())?;
    // Emit state change so frontend updates CSS classes (titlebar visibility, etc.)
    std::thread::sleep(std::time::Duration::from_millis(50));
    emit_state(&window);
    Ok(())
}

#[tauri::command]
pub async fn window_exit_fullscreen_windowed(window: Window) -> Result<(), String> {
    if window.is_fullscreen().unwrap_or(false) {
        window.set_fullscreen(false).map_err(|e| e.to_string())?;
    }
    // Always emit state so frontend reliably clears desktop-fullscreen class
    std::thread::sleep(std::time::Duration::from_millis(50));
    emit_state(&window);
    Ok(())
}

#[tauri::command]
pub async fn window_close(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_get_state(window: Window) -> Result<WindowState, String> {
    Ok(get_state(&window))
}
