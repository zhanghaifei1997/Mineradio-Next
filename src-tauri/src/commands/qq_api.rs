use std::sync::Arc;
use tauri::State;
use crate::AppState;
use crate::qq;
use super::helpers::*;

// ── QQ 搜索 ─────────────────────────────────────────────────

#[tauri::command]
pub async fn qq_search(
    state: State<'_, Arc<AppState>>,
    keywords: String,
    limit: Option<u32>,
) -> Result<serde_json::Value, String> {
    let lim = limit.unwrap_or(8).clamp(4, 12) as usize;
    if keywords.is_empty() {
        return Ok(serde_json::json!({"provider": "qq", "songs": []}));
    }
    let cookie = read_qq_cookie(&state).await;
    match qq::search(&keywords, lim, &cookie).await {
        Ok(songs) => Ok(serde_json::json!({"provider": "qq", "songs": songs})),
        Err(e) => Ok(serde_json::json!({"provider": "qq", "songs": [], "error": e}))
    }
}

// ── QQ 歌曲 URL ─────────────────────────────────────────────

#[tauri::command]
pub async fn qq_song_url(
    state: State<'_, Arc<AppState>>,
    mid: String,
    media_mid: Option<String>,
    quality: Option<String>,
) -> Result<serde_json::Value, String> {
    let mm = media_mid.unwrap_or_default();
    let q = quality.unwrap_or_default();
    let cookie = read_qq_cookie(&state).await;
    Ok(qq::get_song_url(&mid, &mm, &q, &cookie).await)
}

// ── QQ 歌词 ─────────────────────────────────────────────────

#[tauri::command]
pub async fn qq_lyric(
    state: State<'_, Arc<AppState>>,
    mid: String,
    id: Option<String>,
) -> Result<serde_json::Value, String> {
    let song_id = id.unwrap_or_default();
    let cookie = read_qq_cookie(&state).await;
    Ok(qq::get_lyric(&mid, &song_id, &cookie).await)
}

// ── QQ 歌手详情 ─────────────────────────────────────────────

#[tauri::command]
pub async fn qq_artist_detail(
    state: State<'_, Arc<AppState>>,
    mid: String,
    limit: Option<u32>,
) -> Result<serde_json::Value, String> {
    let lim = limit.unwrap_or(36).clamp(10, 80);
    let cookie = read_qq_cookie(&state).await;
    Ok(qq::get_artist_detail(&mid, lim, &cookie).await)
}

// ── QQ 歌单歌曲 ─────────────────────────────────────────────

#[tauri::command]
pub async fn qq_playlist_tracks(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<serde_json::Value, String> {
    let cookie = read_qq_cookie(&state).await;
    Ok(qq::get_playlist_tracks(&id, &cookie).await)
}

// ── QQ 评论 ─────────────────────────────────────────────────

#[tauri::command]
pub async fn qq_song_comments(
    state: State<'_, Arc<AppState>>,
    id: String,
    mid: Option<String>,
    limit: Option<u32>,
) -> Result<serde_json::Value, String> {
    let m = mid.unwrap_or_default();
    let lim = limit.unwrap_or(18).clamp(5, 50);
    let cookie = read_qq_cookie(&state).await;
    Ok(qq::get_song_comments(&id, &m, lim, &cookie).await)
}

// ── QQ 登录状态 ─────────────────────────────────────────────

#[tauri::command]
pub async fn qq_login_status(
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let cookie = read_qq_cookie(&state).await;
    if cookie.is_empty() {
        return Ok(serde_json::json!({"provider": "qq", "loggedIn": false, "nickname": "", "avatar": "", "hasCookie": false}));
    }
    Ok(qq::get_qq_login_info(&cookie).await)
}

#[tauri::command]
pub async fn qq_logout(
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    {
        let mut state_cookie = state.qq_cookie.write().await;
        *state_cookie = String::new();
    }
    crate::cookie_store::save_qq_cookie(&state, "");
    Ok(serde_json::json!({"provider": "qq", "ok": true, "loggedIn": false}))
}

#[tauri::command]
pub async fn qq_login_cookie(
    state: State<'_, Arc<AppState>>,
    cookie: String,
) -> Result<serde_json::Value, String> {
    let normalized = qq::normalize_qq_cookie_input(&cookie);
    let obj = qq::parse_cookie_string(&normalized);
    let uin = qq::qq_cookie_uin(&obj);
    let music_key = qq::qq_cookie_music_key(&obj);

    if uin.is_empty() || music_key.is_empty() {
        return Ok(serde_json::json!({
            "provider": "qq", "loggedIn": false, "error": "INVALID_QQ_COOKIE",
            "message": "QQ cookie 缺少 uin 或有效登录票据"
        }));
    }

    {
        let mut state_cookie = state.qq_cookie.write().await;
        *state_cookie = normalized.clone();
    }
    crate::cookie_store::save_qq_cookie(&state, &normalized);

    let stored = read_qq_cookie(&state).await;
    let mut info = qq::get_qq_login_info(&stored).await;
    info["saved"] = serde_json::json!(true);
    Ok(info)
}

#[tauri::command]
pub async fn qq_user_playlists(
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let cookie = read_qq_cookie(&state).await;
    if cookie.is_empty() {
        return Ok(serde_json::json!({"provider": "qq", "loggedIn": false, "playlists": []}));
    }
    Ok(qq::fetch_qq_user_playlists(&cookie).await)
}
