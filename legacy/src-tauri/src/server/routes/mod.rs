pub mod app;
pub mod search;
pub mod song;
pub mod login;
pub mod lyric;
pub mod playlist;
pub mod like;
pub mod artist;
pub mod comment;
pub mod podcast;
pub mod discover;
pub mod proxy;
pub mod static_files;
pub mod qq;
pub mod beatmap;
pub mod weather;
pub mod update;

use actix_web::{HttpRequest, HttpResponse, web::Json};
use std::collections::HashMap;
use serde_json::Value;
use tauri::Manager;

/// Parse query string from an actix-web request into a HashMap.
pub fn parse_query(req: &HttpRequest) -> HashMap<String, String> {
    actix_web::web::Query::<HashMap<String, String>>::from_query(req.query_string())
        .map(|q| q.into_inner())
        .unwrap_or_default()
}

// ── Stub handlers for not-yet-implemented routes ──

#[allow(dead_code)]
pub async fn stub_empty_array() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "data": [], "code": 200 }))
}

pub async fn stub_no_content() -> HttpResponse {
    HttpResponse::NoContent().finish()
}

/// Generic invoke fallback: dispatches Tauri commands over HTTP when IPC fails.
/// POST /api/invoke/{command}
pub async fn handle_invoke(
    path: actix_web::web::Path<String>,
    body: Json<Value>,
    state: actix_web::web::Data<std::sync::Arc<crate::AppState>>,
) -> HttpResponse {
    let command = path.into_inner();
    let _body = body.into_inner();

    // Get AppHandle from state
    let app_handle = {
        let guard = state.app_handle.lock().ok();
        guard.and_then(|g| g.clone())
    };

    match command.as_str() {
        "open_netease_login" => {
            if let Some(handle) = app_handle {
                match crate::commands::login::open_netease_webview_login(handle).await {
                    Ok(_) => HttpResponse::Ok().json(serde_json::json!({"ok": true})),
                    Err(e) => {
                        log::warn!("[invoke-fallback] webview login failed: {}", e);
                        HttpResponse::Ok().json(serde_json::json!({"ok": false, "error": e}))
                    }
                }
            } else {
                HttpResponse::Ok().json(serde_json::json!({"ok": false, "error": "no AppHandle"}))
            }
        }
        "clear_netease_login" | "clear_qq_login" => {
            if let Some(handle) = app_handle {
                let label = if command == "clear_netease_login" { "login-netease" } else { "login-qq" };
                if let Some(win) = handle.get_webview_window(label) {
                    win.close().ok();
                }
            }
            HttpResponse::Ok().json(serde_json::json!({"ok": true}))
        }
        "open_qq_login" => {
            if let Some(handle) = app_handle {
                match crate::commands::login::open_qq_webview_login(handle).await {
                    Ok(_) => HttpResponse::Ok().json(serde_json::json!({"ok": true})),
                    Err(e) => {
                        log::warn!("[invoke-fallback] QQ webview login failed: {}", e);
                        HttpResponse::Ok().json(serde_json::json!({"ok": false, "error": e}))
                    }
                }
            } else {
                HttpResponse::Ok().json(serde_json::json!({"ok": false, "error": "no AppHandle"}))
            }
        }
        "window_get_state" => {
            if let Some(handle) = app_handle {
                if let Some(win) = handle.get_webview_window("main") {
                    let sf = win.scale_factor().unwrap_or(1.0);
                    let size = win.inner_size().unwrap_or_default();
                    let pos = win.outer_position().unwrap_or_default();
                    let is_fs = win.is_fullscreen().unwrap_or(false);
                    HttpResponse::Ok().json(serde_json::json!({
                        "isMaximized": win.is_maximized().unwrap_or(false),
                        "isMinimized": win.is_minimized().unwrap_or(false),
                        "isFullscreen": is_fs,
                        "isFullScreen": is_fs,
                        "isNativeFullScreen": is_fs,
                        "width": size.width as f64 / sf,
                        "height": size.height as f64 / sf,
                        "x": pos.x as f64 / sf,
                        "y": pos.y as f64 / sf,
                        "focused": win.is_focused().unwrap_or(false)
                    }))
                } else {
                    HttpResponse::Ok().json(serde_json::json!({"ok": false, "error": "main window not found"}))
                }
            } else {
                HttpResponse::Ok().json(serde_json::json!({"ok": false, "error": "no AppHandle"}))
            }
        }
        "window_minimize" => {
            if let Some(handle) = app_handle {
                if let Some(win) = handle.get_webview_window("main") {
                    let _ = win.minimize();
                }
            }
            HttpResponse::Ok().json(serde_json::json!({"ok": true}))
        }
        "window_toggle_maximize" => {
            if let Some(handle) = app_handle {
                if let Some(win) = handle.get_webview_window("main") {
                    if win.is_maximized().unwrap_or(false) {
                        let _ = win.unmaximize();
                    } else {
                        let _ = win.maximize();
                    }
                }
            }
            HttpResponse::Ok().json(serde_json::json!({"ok": true}))
        }
        "window_toggle_fullscreen" => {
            if let Some(handle) = app_handle {
                if let Some(win) = handle.get_webview_window("main") {
                    let fs = win.is_fullscreen().unwrap_or(false);
                    let _ = win.set_fullscreen(!fs);
                }
            }
            HttpResponse::Ok().json(serde_json::json!({"ok": true}))
        }
        "window_exit_fullscreen_windowed" => {
            if let Some(handle) = app_handle {
                if let Some(win) = handle.get_webview_window("main") {
                    if win.is_fullscreen().unwrap_or(false) {
                        let _ = win.set_fullscreen(false);
                    }
                }
            }
            HttpResponse::Ok().json(serde_json::json!({"ok": true}))
        }
        "window_close" => {
            if let Some(handle) = app_handle {
                if let Some(win) = handle.get_webview_window("main") {
                    let _ = win.close();
                }
            }
            HttpResponse::Ok().json(serde_json::json!({"ok": true}))
        }
        "configure_global_hotkeys" => {
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            if let Some(handle) = app_handle {
                #[derive(serde::Deserialize)]
                struct HotkeyBinding { accelerator: String, action: String }
                #[derive(serde::Deserialize)]
                struct HotkeyArgs { #[serde(default)] bindings: Vec<HotkeyBinding> }
                let args: HotkeyArgs = serde_json::from_value(_body.clone()).unwrap_or(HotkeyArgs { bindings: vec![] });
                let gs = handle.global_shortcut();
                let _ = gs.unregister_all();
                for binding in args.bindings {
                    let action = binding.action.clone();
                    let h = handle.clone();
                    let _ = gs.on_shortcut(binding.accelerator.as_str(), move |_app, _sc, event| {
                        if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                            use tauri::Emitter;
                            let _ = h.emit("mineradio-global-hotkey", serde_json::json!({"action": action}));
                        }
                    });
                }
            }
            HttpResponse::Ok().json(serde_json::json!({"ok": true}))
        }
        "desktop_lyrics_set_enabled" => {
            if let Some(handle) = app_handle {
                #[derive(serde::Deserialize)]
                #[allow(dead_code)]
                struct Args { enabled: bool, #[serde(default)] payload: serde_json::Value }
                let args: Args = serde_json::from_value(_body.clone()).unwrap_or(Args { enabled: false, payload: serde_json::Value::Null });
                if args.enabled {
                    if handle.get_webview_window("desktop-lyrics").is_none() {
                        use tauri::{WebviewUrl, WebviewWindowBuilder};
                        let _ = WebviewWindowBuilder::new(&handle, "desktop-lyrics", WebviewUrl::App("desktop-lyrics.html".into()))
                            .title("桌面歌词").inner_size(800.0, 200.0).decorations(false).transparent(true).always_on_top(true).build();
                    }
                    if let Some(win) = handle.get_webview_window("desktop-lyrics") {
                        let _ = win.show();
                    }
                } else {
                    if let Some(win) = handle.get_webview_window("desktop-lyrics") {
                        let _ = win.hide();
                    }
                }
            }
            HttpResponse::Ok().json(serde_json::json!({"ok": true}))
        }
        "desktop_lyrics_update" => {
            if let Some(handle) = app_handle {
                if let Some(win) = handle.get_webview_window("desktop-lyrics") {
                    use tauri::Emitter;
                    let _ = win.emit("lyrics-update", &_body);
                }
            }
            HttpResponse::Ok().json(serde_json::json!({"ok": true}))
        }
        "wallpaper_set_enabled" => {
            if let Some(handle) = app_handle {
                #[derive(serde::Deserialize)]
                #[allow(dead_code)]
                struct Args { enabled: bool, #[serde(default)] payload: serde_json::Value }
                let args: Args = serde_json::from_value(_body.clone()).unwrap_or(Args { enabled: false, payload: serde_json::Value::Null });
                if args.enabled {
                    if handle.get_webview_window("wallpaper").is_none() {
                        use tauri::{WebviewUrl, WebviewWindowBuilder};
                        let _ = WebviewWindowBuilder::new(&handle, "wallpaper", WebviewUrl::App("wallpaper.html".into()))
                            .title("壁纸模式").decorations(false).transparent(true).build();
                    }
                    if let Some(win) = handle.get_webview_window("wallpaper") {
                        let _ = win.show();
                    }
                } else {
                    if let Some(win) = handle.get_webview_window("wallpaper") {
                        let _ = win.hide();
                    }
                }
            }
            HttpResponse::Ok().json(serde_json::json!({"ok": true}))
        }
        "wallpaper_update" => {
            if let Some(handle) = app_handle {
                if let Some(win) = handle.get_webview_window("wallpaper") {
                    use tauri::Emitter;
                    let _ = win.emit("wallpaper-update", &_body);
                }
            }
            HttpResponse::Ok().json(serde_json::json!({"ok": true}))
        }
        _ => {
            log::warn!("[invoke-fallback] unhandled command: {}", command);
            HttpResponse::Ok().json(serde_json::json!({"ok": true, "note": "no-op fallback"}))
        }
    }
}
