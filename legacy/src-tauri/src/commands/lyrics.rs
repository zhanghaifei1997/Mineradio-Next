use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct LyricsPayload {
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub translation: String,
}

#[tauri::command]
pub async fn desktop_lyrics_set_enabled(
    app: AppHandle,
    enabled: bool,
    payload: serde_json::Value,
) -> Result<(), String> {
    let _ = &payload; // suppress unused warning
    if enabled {
        // Create desktop lyrics overlay window if it doesn't exist
        if app.get_webview_window("desktop-lyrics").is_none() {
            let win = WebviewWindowBuilder::new(
                &app,
                "desktop-lyrics",
                WebviewUrl::App("desktop-lyrics.html".into()),
            )
            .title("桌面歌词")
            .inner_size(800.0, 200.0)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .build()
            .map_err(|e| e.to_string())?;
            let _ = &win;
        }
        if let Some(win) = app.get_webview_window("desktop-lyrics") {
            win.show().map_err(|e| e.to_string())?;
        }
    } else {
        if let Some(win) = app.get_webview_window("desktop-lyrics") {
            win.hide().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn desktop_lyrics_update(
    app: AppHandle,
    payload: serde_json::Value,
) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("desktop-lyrics") {
        win.emit("lyrics-update", &payload).map_err(|e| e.to_string())?;
    }
    Ok(())
}
