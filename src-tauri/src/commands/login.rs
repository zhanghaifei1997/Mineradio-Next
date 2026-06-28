use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use log::info;
use crate::{AppState, cookie_store};
use std::sync::Arc;

/// Open Netease login in an in-app webview and poll for MUSIC_U cookie.
pub async fn open_netease_webview_login(app: AppHandle) -> Result<String, String> {
    let url = "https://music.163.com/#/login";

    // If a login window already exists, just focus it — do NOT destroy and recreate
    if let Some(existing) = app.get_webview_window("login-netease") {
        existing.show().ok();
        existing.set_focus().ok();
        return Ok("already_open".into());
    }

    let win = WebviewWindowBuilder::new(
        &app,
        "login-netease",
        WebviewUrl::External(url.parse().map_err(|e: url::ParseError| e.to_string())?),
    )
    .title("网易云音乐登录")
    .inner_size(940.0, 760.0)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    // Show the window
    win.show().map_err(|e| e.to_string())?;
    win.set_focus().map_err(|e| e.to_string())?;

    // Spawn background task to poll for MUSIC_U cookie
    let poll_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        poll_netease_cookie(&poll_handle).await;
    });

    Ok("opened".into())
}

/// Poll for MUSIC_U cookie from the login webview.
async fn poll_netease_cookie(app: &AppHandle) {
    for _ in 0..120 {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        // Try to get cookies for music.163.com via reqwest
        // The webview shares the same cookie jar in Tauri
        let has_cookie = check_netease_cookie(app).await;

        if let Some(cookie) = has_cookie {
            info!("[login] Netease MUSIC_U cookie captured via webview");
            // Emit event to frontend
            app.emit("netease-login-cookie", serde_json::json!({
                "ok": true,
                "cookie": cookie,
            })).ok();

            // Close the login window after a short delay
            tokio::time::sleep(std::time::Duration::from_millis(800)).await;
            if let Some(win) = app.get_webview_window("login-netease") {
                win.close().ok();
            }
            return;
        }
    }
    // Timeout — no cookie found after 4 minutes
    info!("[login] Netease cookie polling timed out");
}

/// Check if MUSIC_U cookie exists for Netease domain.
async fn check_netease_cookie(app: &AppHandle) -> Option<String> {
    // Use the webview's cookie API if available
    if let Some(win) = app.get_webview_window("login-netease") {
        // Try Tauri v2 cookies() method on the webview
        match win.cookies() {
            Ok(cookies) => {
                if cookies.iter().any(|c| c.name() == "MUSIC_U") {
                    // Build full cookie header from all Netease cookies
                    let full: String = cookies
                        .iter()
                        .filter(|c| {
                            c.domain().map_or(false, |d| d.contains("163.com") || d.contains("music.163"))
                        })
                        .map(|c| format!("{}={}", c.name(), c.value()))
                        .collect::<Vec<_>>()
                        .join("; ");
                    if !full.is_empty() {
                        return Some(full);
                    }
                }
            }
            Err(_) => {
                // cookies() not available — fallback to JavaScript evaluation
                // Try to read cookies from the webview page via JS
            }
        }
    }
    None
}

#[tauri::command]
pub async fn open_netease_login(app: AppHandle) -> Result<String, String> {
    open_netease_webview_login(app).await
}

#[tauri::command]
pub async fn clear_netease_login(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("login-netease") {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_qq_login(app: AppHandle) -> Result<String, String> {
    open_qq_webview_login(app).await
}

pub async fn open_qq_webview_login(app: AppHandle) -> Result<String, String> {
    let url = "https://y.qq.com/n/ryqq/profile";

    if let Some(existing) = app.get_webview_window("login-qq") {
        existing.destroy().ok();
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }

    let win = WebviewWindowBuilder::new(
        &app,
        "login-qq",
        WebviewUrl::External(url.parse().map_err(|e: url::ParseError| e.to_string())?),
    )
    .title("QQ 音乐登录")
    .inner_size(940.0, 760.0)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    win.show().map_err(|e| e.to_string())?;
    win.set_focus().map_err(|e| e.to_string())?;

    // Spawn background task to poll for QQ login cookies
    // Get AppState from the managed Tauri state via AppHandle
    let poll_app = app.clone();
    let poll_state = app.state::<Arc<AppState>>().inner().clone();
    tauri::async_runtime::spawn(async move {
        poll_qq_cookie(&poll_app, &poll_state).await;
    });

    Ok("opened".into())
}

/// QQ 登录所需的关键 cookie 名
const QQ_KEY_COOKIE_NAMES: &[&str] = &[
    "qm_keyst", "qqmusic_key", "music_key",
];
const QQ_UIN_COOKIE_NAMES: &[&str] = &[
    "uin", "qqmusic_uin", "wxuin", "p_uin",
];

/// Poll for QQ login cookies from the webview.
async fn poll_qq_cookie(app: &AppHandle, state: &Arc<AppState>) {
    for _ in 0..150 {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        if let Some(cookie) = check_qq_cookie(app).await {
            info!("[login] QQ login cookie captured via webview ({} chars)", cookie.len());

            // Save to AppState
            {
                let mut qq = state.qq_cookie.write().await;
                *qq = cookie.clone();
            }
            // Persist to disk
            cookie_store::save_qq_cookie(state, &cookie);

            // Emit event to frontend
            app.emit("qq-login-cookie", serde_json::json!({
                "ok": true,
                "cookie": cookie,
            })).ok();

            // Close the login window after a short delay
            tokio::time::sleep(std::time::Duration::from_millis(800)).await;
            if let Some(win) = app.get_webview_window("login-qq") {
                win.close().ok();
            }
            return;
        }
    }
    // Timeout — no cookie found after 5 minutes
    info!("[login] QQ cookie polling timed out");
}

/// Check if valid QQ login cookies exist in the webview.
/// Returns the full cookie header string if both uin and music key are present.
async fn check_qq_cookie(app: &AppHandle) -> Option<String> {
    if let Some(win) = app.get_webview_window("login-qq") {
        match win.cookies() {
            Ok(cookies) => {
                // Filter cookies belonging to qq.com domain
                let qq_cookies: Vec<_> = cookies.iter().filter(|c| {
                    c.domain().map_or(false, |d| {
                        let norm = d.trim_start_matches('.').to_lowercase();
                        norm == "qq.com" || norm.ends_with(".qq.com")
                    })
                }).collect();

                let has_uin = qq_cookies.iter().any(|c| {
                    QQ_UIN_COOKIE_NAMES.contains(&c.name()) && !c.value().is_empty()
                });
                let has_key = qq_cookies.iter().any(|c| {
                    QQ_KEY_COOKIE_NAMES.contains(&c.name()) && !c.value().is_empty()
                });

                if has_uin && has_key {
                    let full: String = qq_cookies
                        .iter()
                        .map(|c| format!("{}={}", c.name(), c.value()))
                        .collect::<Vec<_>>()
                        .join("; ");
                    if !full.is_empty() {
                        return Some(full);
                    }
                }
            }
            Err(e) => {
                info!("[login] QQ cookies() call failed: {}", e);
            }
        }
    }
    None
}

#[tauri::command]
pub async fn clear_qq_login(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("login-qq") {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}
