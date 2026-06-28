use actix_web::{web, HttpRequest, HttpResponse};
use crate::netease::api::playlist as netease_playlist;
use crate::netease::api::login as netease_login;
use crate::AppState;
use std::sync::Arc;

/// Map a raw Netease playlist record to the flat shape the frontend expects.
fn map_playlist_item(pl: &serde_json::Value) -> serde_json::Value {
    let creator = pl.get("creator").cloned().unwrap_or(serde_json::Value::Null);
    serde_json::json!({
        "id": pl.get("id").and_then(|v| v.as_u64()).unwrap_or(0),
        "name": pl.get("name").and_then(|v| v.as_str()).unwrap_or(""),
        "cover": pl.get("coverImgUrl").and_then(|v| v.as_str()).unwrap_or(""),
        "trackCount": pl.get("trackCount").and_then(|v| v.as_u64()).unwrap_or(0),
        "playCount": pl.get("playCount").and_then(|v| v.as_u64()).unwrap_or(0),
        "creator": creator.get("nickname").and_then(|v| v.as_str()).unwrap_or(""),
        "subscribed": pl.get("subscribed").and_then(|v| v.as_bool()).unwrap_or(false),
        "specialType": pl.get("specialType").and_then(|v| v.as_u64()).unwrap_or(0),
    })
}

pub async fn handle_user_playlists(
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let cookie = state.netease_cookie.read().await.clone();
    if cookie.is_empty() {
        return HttpResponse::Ok().json(serde_json::json!({"loggedIn": false, "playlists": []}));
    }

    // Get user ID from login status
    let uid = match netease_login::login_status(&cookie).await {
        Ok(resp) => {
            resp.body.get("profile")
                .and_then(|p| p.get("userId"))
                .and_then(|id| id.as_u64())
                .unwrap_or(0)
        }
        Err(_) => 0,
    };

    if uid == 0 {
        return HttpResponse::Ok().json(serde_json::json!({"loggedIn": false, "playlists": []}));
    }

    // Fetch user playlists
    match netease_playlist::user_playlist(uid, 100, &cookie).await {
        Ok(resp) => {
            let raw = resp.body.get("playlist")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            let playlists: Vec<serde_json::Value> = raw.iter().map(|pl| map_playlist_item(pl)).collect();
            HttpResponse::Ok().json(serde_json::json!({
                "loggedIn": true,
                "userId": uid,
                "playlists": playlists,
            }))
        }
        Err(e) => HttpResponse::Ok().json(serde_json::json!({
            "loggedIn": true,
            "userId": uid,
            "playlists": [],
            "error": e,
        })),
    }
}

pub async fn handle_playlist_tracks(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let id: u64 = match query.get("id").and_then(|s| s.parse().ok()) {
        Some(id) => id,
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing playlist id", "tracks": []})),
    };
    let cookie = state.netease_cookie.read().await.clone();

    // Try playlist_track_all first (uses /api/v6/playlist/detail)
    let mut playlist_meta = serde_json::json!({"id": id, "name": "", "cover": "", "trackCount": 0});
    let mut raw_tracks: Vec<serde_json::Value> = vec![];

    if let Ok(resp) = netease_playlist::playlist_track_all(id, 500, 0, &cookie).await {
        // The API returns body.playlist.tracks
        if let Some(pl) = resp.body.get("playlist") {
            playlist_meta = serde_json::json!({
                "id": pl.get("id").and_then(|v| v.as_u64()).unwrap_or(id),
                "name": pl.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                "cover": pl.get("coverImgUrl").and_then(|v| v.as_str()).unwrap_or(""),
                "trackCount": pl.get("trackCount").and_then(|v| v.as_u64()).unwrap_or(0),
            });
            raw_tracks = pl.get("tracks")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
        }
        // Fallback: try body.songs or body.tracks directly
        if raw_tracks.is_empty() {
            raw_tracks = resp.body.get("songs").or_else(|| resp.body.get("tracks"))
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
        }
    }

    // Fallback: try playlist_detail
    if raw_tracks.is_empty() {
        if let Ok(resp) = netease_playlist::playlist_detail(id, &cookie).await {
            if let Some(pl) = resp.body.get("playlist") {
                playlist_meta = serde_json::json!({
                    "id": pl.get("id").and_then(|v| v.as_u64()).unwrap_or(id),
                    "name": pl.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                    "cover": pl.get("coverImgUrl").and_then(|v| v.as_str()).unwrap_or(""),
                    "trackCount": pl.get("trackCount").and_then(|v| v.as_u64()).unwrap_or(0),
                });
                raw_tracks = pl.get("tracks")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();
            }
        }
    }

    let tracks: Vec<serde_json::Value> = raw_tracks.iter()
        .map(|s| super::discover::map_song(s))
        .filter(|s| s.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0)
        .collect();

    // Update trackCount if missing
    if playlist_meta.get("trackCount").and_then(|v| v.as_u64()).unwrap_or(0) == 0 {
        playlist_meta["trackCount"] = serde_json::json!(tracks.len());
    }

    HttpResponse::Ok().json(serde_json::json!({
        "playlist": playlist_meta,
        "tracks": tracks,
    }))
}

/// GET /api/playlist/create?name=xxx
/// Frontend sends GET with query params, not POST with JSON body.
pub async fn handle_playlist_create(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let name = query.get("name").map(|s| s.as_str()).unwrap_or("").trim();
    let privacy: u32 = query.get("privacy").and_then(|s| s.parse().ok()).unwrap_or(0);
    let cookie = state.netease_cookie.read().await.clone();

    if name.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing playlist name"}));
    }

    if cookie.is_empty() {
        return HttpResponse::Ok().json(serde_json::json!({
            "loggedIn": false, "error": "Not logged in"
        }));
    }

    match netease_playlist::playlist_create(name, privacy, &cookie).await {
        Ok(resp) => {
            let created = resp.body.get("playlist")
                .or_else(|| resp.body.get("data"))
                .cloned()
                .unwrap_or(serde_json::Value::Null);
            HttpResponse::Ok().json(serde_json::json!({
                "loggedIn": true,
                "playlist": created,
                "body": resp.body,
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e,
            "loggedIn": !cookie.is_empty(),
        })),
    }
}

/// POST /api/playlist/add-song  { pid: number, id: string }
/// Add a song to a playlist.
pub async fn handle_add_song(
    body: web::Json<serde_json::Value>,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let pid: u64 = match body.get("pid").and_then(|v| v.as_u64()) {
        Some(pid) => pid,
        None => return HttpResponse::BadRequest().json(serde_json::json!({
            "success": false, "error": "Missing playlist id"
        })),
    };
    let song_id = body.get("id")
        .or_else(|| body.get("ids"))
        .and_then(|v| v.as_str().or_else(|| v.as_u64().map(|_| "").or(None)))
        .unwrap_or("");

    // Handle both string and numeric id
    let song_id_str = if song_id.is_empty() {
        body.get("id").or_else(|| body.get("ids"))
            .and_then(|v| v.as_u64())
            .map(|n| n.to_string())
            .unwrap_or_default()
    } else {
        song_id.to_string()
    };

    if song_id_str.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "success": false, "error": "Missing song id"
        }));
    }

    let cookie = state.netease_cookie.read().await.clone();
    if cookie.is_empty() {
        return HttpResponse::Ok().json(serde_json::json!({
            "loggedIn": false, "success": false, "error": "LOGIN_REQUIRED"
        }));
    }

    // Try playlist_tracks (manipulate API) first
    match netease_playlist::playlist_tracks("add", pid, &song_id_str, &cookie).await {
        Ok(resp) => {
            let code = resp.body.get("code").and_then(|c| c.as_u64()).unwrap_or(200);
            let success = code == 200 && resp.body.get("error").is_none();
            if success {
                HttpResponse::Ok().json(serde_json::json!({
                    "loggedIn": true,
                    "pid": pid,
                    "id": song_id_str,
                    "success": true,
                    "code": code,
                    "body": resp.body,
                }))
            } else {
                // Fallback to playlist_track_add
                match netease_playlist::playlist_track_add(pid, &song_id_str, &cookie).await {
                    Ok(fallback_resp) => {
                        let fb_code = fallback_resp.body.get("code").and_then(|c| c.as_u64()).unwrap_or(200);
                        let fb_success = fb_code == 200;
                        HttpResponse::Ok().json(serde_json::json!({
                            "loggedIn": true,
                            "pid": pid,
                            "id": song_id_str,
                            "success": fb_success,
                            "code": fb_code,
                            "body": fallback_resp.body,
                        }))
                    }
                    Err(fallback_err) => {
                        HttpResponse::Ok().json(serde_json::json!({
                            "loggedIn": true,
                            "pid": pid,
                            "id": song_id_str,
                            "success": false,
                            "error": fallback_err,
                        }))
                    }
                }
            }
        }
        Err(e) => {
            // Fallback to playlist_track_add
            match netease_playlist::playlist_track_add(pid, &song_id_str, &cookie).await {
                Ok(fallback_resp) => {
                    let fb_code = fallback_resp.body.get("code").and_then(|c| c.as_u64()).unwrap_or(200);
                    HttpResponse::Ok().json(serde_json::json!({
                        "loggedIn": true,
                        "pid": pid,
                        "id": song_id_str,
                        "success": fb_code == 200,
                        "code": fb_code,
                        "body": fallback_resp.body,
                    }))
                }
                Err(_) => {
                    HttpResponse::Ok().json(serde_json::json!({
                        "loggedIn": true,
                        "pid": pid,
                        "id": song_id_str,
                        "success": false,
                        "error": e,
                    }))
                }
            }
        }
    }
}
