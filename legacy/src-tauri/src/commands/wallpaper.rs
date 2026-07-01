use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub async fn wallpaper_set_enabled(
    app: AppHandle,
    enabled: bool,
    payload: serde_json::Value,
) -> Result<(), String> {
    let _ = &payload; // suppress unused warning
    if enabled {
        if app.get_webview_window("wallpaper").is_none() {
            let win = WebviewWindowBuilder::new(
                &app,
                "wallpaper",
                WebviewUrl::App("wallpaper.html".into()),
            )
            .title("壁纸模式")
            .decorations(false)
            .transparent(true)
            .build()
            .map_err(|e| e.to_string())?;
            let _ = &win;
        }
        if let Some(win) = app.get_webview_window("wallpaper") {
            win.show().map_err(|e| e.to_string())?;
        }
    } else {
        if let Some(win) = app.get_webview_window("wallpaper") {
            win.hide().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn wallpaper_update(
    app: AppHandle,
    payload: serde_json::Value,
) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("wallpaper") {
        win.emit("wallpaper-update", &payload).map_err(|e| e.to_string())?;
    }
    Ok(())
}
