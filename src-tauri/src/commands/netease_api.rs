use std::sync::Arc;
use tauri::State;
use crate::AppState;
use crate::netease::api::{search as netease_search, song as netease_song, lyric as netease_lyric,
    playlist as netease_playlist, like as netease_like, artist as netease_artist,
    comment as netease_comment, login as netease_login, podcast as netease_podcast,
    personalized};
use super::helpers::*;

// ── 搜索 ────────────────────────────────────────────────────

#[tauri::command]
pub async fn netease_search(
    state: State<'_, Arc<AppState>>,
    keywords: String,
    search_type: Option<u32>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<serde_json::Value, String> {
    let st = search_type.unwrap_or(1);
    let lim = limit.unwrap_or(30);
    let off = offset.unwrap_or(0);
    let cookie = read_netease_cookie(&state).await;

    let result = match netease_search::cloudsearch(&keywords, st, lim, off, &cookie).await {
        Ok(r) => Ok(r),
        Err(_) => netease_search::search(&keywords, st, lim, off, &cookie).await,
    };

    match result {
        Ok(resp) => {
            let raw_songs = resp.body.get("result")
                .and_then(|r| r.get("songs"))
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            let songs: Vec<serde_json::Value> = raw_songs.iter()
                .map(|s| map_song(s))
                .filter(|s| s.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0)
                .collect();
            Ok(serde_json::json!({"songs": songs}))
        }
        Err(e) => Ok(serde_json::json!({"error": e, "songs": []}))
    }
}

// ── 歌曲 URL ────────────────────────────────────────────────

#[tauri::command]
pub async fn netease_song_url(
    state: State<'_, Arc<AppState>>,
    id: u64,
    quality: Option<String>,
) -> Result<serde_json::Value, String> {
    let q = quality.as_deref().unwrap_or("standard");
    let cookie = read_netease_cookie(&state).await;

    let result = match netease_song::song_url_v1(id, q, &cookie).await {
        Ok(resp) => Ok(resp),
        Err(_) => netease_song::song_url(id, 320000, &cookie).await,
    };

    match result {
        Ok(resp) => {
            let data = resp.body.get("data")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first());
            if let Some(d) = data {
                let url = d.get("url").and_then(|v| v.as_str()).unwrap_or("");
                let free_trial = d.get("freeTrialInfo").and_then(|v| v.as_object()).is_some()
                    && d.get("freeTrialInfo").map(|v| !v.is_null()).unwrap_or(false);
                let playable = !url.is_empty() && !free_trial;
                let level = d.get("level").and_then(|v| v.as_str()).unwrap_or(q);
                let br = d.get("br").and_then(|v| v.as_u64()).unwrap_or(0);
                let typ = d.get("type").and_then(|v| v.as_str()).unwrap_or("mp3");
                Ok(serde_json::json!({
                    "url": url, "trial": free_trial, "playable": playable,
                    "level": level, "br": br, "type": typ, "requestedQuality": q,
                }))
            } else {
                Ok(serde_json::json!({"url": "", "trial": false, "playable": false}))
            }
        }
        Err(e) => Ok(serde_json::json!({"url": "", "trial": false, "playable": false, "error": e}))
    }
}

// ── 歌词 ────────────────────────────────────────────────────

#[tauri::command]
pub async fn netease_lyric(
    state: State<'_, Arc<AppState>>,
    id: u64,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;

    let mut body = serde_json::Value::Null;
    if let Ok(resp) = netease_lyric::lyric_new(id, &cookie).await {
        body = resp.body;
    }
    let has_lyric = body.get("lrc").and_then(|l| l.get("lyric")).and_then(|l| l.as_str()).map(|s| !s.is_empty()).unwrap_or(false)
        || body.get("yrc").and_then(|l| l.get("lyric")).and_then(|l| l.as_str()).map(|s| !s.is_empty()).unwrap_or(false);

    if !has_lyric {
        if let Ok(resp) = netease_lyric::lyric(id, &cookie).await {
            body = resp.body;
        }
    }

    Ok(serde_json::json!({
        "lyric": body.get("lrc").and_then(|l| l.get("lyric")).and_then(|l| l.as_str()).unwrap_or(""),
        "tlyric": body.get("tlyric").and_then(|l| l.get("lyric")).and_then(|l| l.as_str()).unwrap_or(""),
        "yrc": body.get("yrc").and_then(|l| l.get("lyric")).and_then(|l| l.as_str()).unwrap_or(""),
    }))
}

// ── 歌单 ────────────────────────────────────────────────────

#[tauri::command]
pub async fn netease_user_playlists(
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;
    if cookie.is_empty() {
        return Ok(serde_json::json!({"loggedIn": false, "playlists": []}));
    }

    let uid = match netease_login::login_status(&cookie).await {
        Ok(resp) => resp.body.get("profile")
            .and_then(|p| p.get("userId"))
            .and_then(|id| id.as_u64())
            .unwrap_or(0),
        Err(_) => 0,
    };
    if uid == 0 {
        return Ok(serde_json::json!({"loggedIn": false, "playlists": []}));
    }

    match netease_playlist::user_playlist(uid, 100, &cookie).await {
        Ok(resp) => {
            let raw = resp.body.get("playlist")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            let playlists: Vec<serde_json::Value> = raw.iter().map(|pl| map_playlist_item(pl)).collect();
            Ok(serde_json::json!({"loggedIn": true, "userId": uid, "playlists": playlists}))
        }
        Err(e) => Ok(serde_json::json!({"loggedIn": true, "userId": uid, "playlists": [], "error": e}))
    }
}

#[tauri::command]
pub async fn netease_playlist_tracks(
    state: State<'_, Arc<AppState>>,
    id: u64,
    _offset: Option<u32>,
    _limit: Option<u32>,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;

    let mut playlist_meta = serde_json::json!({"id": id, "name": "", "cover": "", "trackCount": 0});
    let mut raw_tracks: Vec<serde_json::Value> = vec![];

    if let Ok(resp) = netease_playlist::playlist_track_all(id, 500, 0, &cookie).await {
        if let Some(pl) = resp.body.get("playlist") {
            playlist_meta = serde_json::json!({
                "id": pl.get("id").and_then(|v| v.as_u64()).unwrap_or(id),
                "name": pl.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                "cover": pl.get("coverImgUrl").and_then(|v| v.as_str()).unwrap_or(""),
                "trackCount": pl.get("trackCount").and_then(|v| v.as_u64()).unwrap_or(0),
            });
            raw_tracks = pl.get("tracks").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        }
        if raw_tracks.is_empty() {
            raw_tracks = resp.body.get("songs").or_else(|| resp.body.get("tracks"))
                .and_then(|v| v.as_array()).cloned().unwrap_or_default();
        }
    }

    if raw_tracks.is_empty() {
        if let Ok(resp) = netease_playlist::playlist_detail(id, &cookie).await {
            if let Some(pl) = resp.body.get("playlist") {
                playlist_meta = serde_json::json!({
                    "id": pl.get("id").and_then(|v| v.as_u64()).unwrap_or(id),
                    "name": pl.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                    "cover": pl.get("coverImgUrl").and_then(|v| v.as_str()).unwrap_or(""),
                    "trackCount": pl.get("trackCount").and_then(|v| v.as_u64()).unwrap_or(0),
                });
                raw_tracks = pl.get("tracks").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            }
        }
    }

    let tracks: Vec<serde_json::Value> = raw_tracks.iter()
        .map(|s| map_song(s))
        .filter(|s| s.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0)
        .collect();

    if playlist_meta.get("trackCount").and_then(|v| v.as_u64()).unwrap_or(0) == 0 {
        playlist_meta["trackCount"] = serde_json::json!(tracks.len());
    }

    Ok(serde_json::json!({"playlist": playlist_meta, "tracks": tracks}))
}

#[tauri::command]
pub async fn netease_playlist_create(
    state: State<'_, Arc<AppState>>,
    name: String,
    privacy: Option<u32>,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;
    if cookie.is_empty() {
        return Ok(serde_json::json!({"loggedIn": false, "error": "Not logged in"}));
    }
    let p = privacy.unwrap_or(0);
    match netease_playlist::playlist_create(&name, p, &cookie).await {
        Ok(resp) => {
            let created = resp.body.get("playlist").or_else(|| resp.body.get("data"))
                .cloned().unwrap_or(serde_json::Value::Null);
            Ok(serde_json::json!({"loggedIn": true, "playlist": created, "body": resp.body}))
        }
        Err(e) => Ok(serde_json::json!({"error": e, "loggedIn": true}))
    }
}

#[tauri::command]
pub async fn netease_playlist_add_song(
    state: State<'_, Arc<AppState>>,
    pid: u64,
    song_ids: String,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;
    if cookie.is_empty() {
        return Ok(serde_json::json!({"loggedIn": false, "success": false, "error": "LOGIN_REQUIRED"}));
    }

    match netease_playlist::playlist_tracks("add", pid, &song_ids, &cookie).await {
        Ok(resp) => {
            let code = resp.body.get("code").and_then(|c| c.as_u64()).unwrap_or(200);
            let success = code == 200 && resp.body.get("error").is_none();
            if success {
                Ok(serde_json::json!({"loggedIn": true, "pid": pid, "success": true, "code": code}))
            } else {
                match netease_playlist::playlist_track_add(pid, &song_ids, &cookie).await {
                    Ok(fb) => {
                        let fb_code = fb.body.get("code").and_then(|c| c.as_u64()).unwrap_or(200);
                        Ok(serde_json::json!({"loggedIn": true, "pid": pid, "success": fb_code == 200, "code": fb_code}))
                    }
                    Err(e) => Ok(serde_json::json!({"loggedIn": true, "pid": pid, "success": false, "error": e}))
                }
            }
        }
        Err(e) => Ok(serde_json::json!({"loggedIn": true, "pid": pid, "success": false, "error": e}))
    }
}

// ── 红心 ────────────────────────────────────────────────────

#[tauri::command]
pub async fn netease_song_like(
    state: State<'_, Arc<AppState>>,
    id: u64,
    like: bool,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;
    if cookie.is_empty() {
        return Ok(serde_json::json!({"loggedIn": false, "id": id, "error": "Not logged in"}));
    }
    match netease_like::like_song(id, like, &cookie).await {
        Ok(resp) => {
            let code = resp.body.get("code").and_then(|c| c.as_u64()).unwrap_or(200);
            Ok(serde_json::json!({"loggedIn": true, "id": id, "liked": like, "code": code}))
        }
        Err(e) => Ok(serde_json::json!({"error": e, "id": id, "liked": !like}))
    }
}

#[tauri::command]
pub async fn netease_song_like_check(
    state: State<'_, Arc<AppState>>,
    ids: String,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;
    let id_list: Vec<String> = ids.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();

    if id_list.is_empty() || cookie.is_empty() {
        let liked: serde_json::Map<String, serde_json::Value> = id_list.iter()
            .map(|id| (id.clone(), serde_json::json!(false))).collect();
        return Ok(serde_json::json!({"loggedIn": !cookie.is_empty(), "ids": id_list, "liked": liked}));
    }

    let uid = match netease_login::login_status(&cookie).await {
        Ok(resp) => resp.body.get("profile").and_then(|p| p.get("userId"))
            .and_then(|id| id.as_u64()).unwrap_or(0),
        Err(_) => 0,
    };
    if uid == 0 {
        let liked: serde_json::Map<String, serde_json::Value> = id_list.iter()
            .map(|id| (id.clone(), serde_json::json!(false))).collect();
        return Ok(serde_json::json!({"loggedIn": false, "ids": id_list, "liked": liked}));
    }

    let ids_json = serde_json::to_string(&id_list.iter().filter_map(|s| s.parse::<u64>().ok()).collect::<Vec<u64>>()).unwrap_or_default();
    let mut liked_ids: Vec<String> = Vec::new();

    if let Ok(check_resp) = netease_like::song_like_check(&ids_json, &cookie).await {
        let data = check_resp.body.get("data").or(check_resp.body.get("ids"));
        if let Some(arr) = data.and_then(|v| v.as_array()) {
            liked_ids = arr.iter().filter_map(|v| v.as_u64().map(|n| n.to_string())).collect();
        }
    }

    if liked_ids.is_empty() {
        if let Ok(resp) = netease_like::likelist(uid, &cookie).await {
            liked_ids = resp.body.get("ids")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_u64().map(|n| n.to_string())).collect())
                .unwrap_or_default();
        }
    }

    let liked_set: std::collections::HashSet<String> = liked_ids.into_iter().collect();
    let liked: serde_json::Map<String, serde_json::Value> = id_list.iter()
        .map(|id| (id.clone(), serde_json::json!(liked_set.contains(id)))).collect();

    Ok(serde_json::json!({"loggedIn": true, "ids": id_list, "liked": liked}))
}

// ── 歌手 ────────────────────────────────────────────────────

#[tauri::command]
pub async fn netease_artist_detail(
    state: State<'_, Arc<AppState>>,
    id: u64,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;
    let detail = netease_artist::artist_detail(id, &cookie).await;
    let songs_resp = netease_artist::artist_songs(id, "hot", 30, 0, &cookie).await;

    let raw_songs = songs_resp.ok()
        .and_then(|r| r.body.get("songs").cloned())
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default();
    let songs: Vec<serde_json::Value> = raw_songs.iter()
        .map(|s| map_song(s))
        .filter(|s| s.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0)
        .collect();

    Ok(serde_json::json!({
        "id": id,
        "artist": detail.as_ref().ok().map(|r| &r.body).unwrap_or(&serde_json::Value::Null),
        "songs": songs,
    }))
}

// ── 评论 ────────────────────────────────────────────────────

#[tauri::command]
pub async fn netease_song_comments(
    state: State<'_, Arc<AppState>>,
    id: u64,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<serde_json::Value, String> {
    let lim = limit.unwrap_or(20);
    let off = offset.unwrap_or(0);
    let cookie = read_netease_cookie(&state).await;

    match netease_comment::comment_music(id, lim, off, &cookie).await {
        Ok(resp) => {
            let body = &resp.body;
            let has_hot = body.get("hotComments").and_then(|v| v.as_array()).is_some() && off == 0;
            let raw = if has_hot {
                body.get("hotComments").and_then(|v| v.as_array()).cloned().unwrap_or_default()
            } else {
                body.get("comments").and_then(|v| v.as_array()).cloned().unwrap_or_default()
            };
            let comments: Vec<serde_json::Value> = raw.iter()
                .map(|c| {
                    let user = c.get("user").cloned().unwrap_or(serde_json::Value::Null);
                    let user_info = if user.is_object() {
                        serde_json::json!({
                            "id": user.get("userId").and_then(|v| v.as_u64()).unwrap_or(0),
                            "nickname": user.get("nickname").and_then(|v| v.as_str()).unwrap_or(""),
                            "avatar": user.get("avatarUrl").and_then(|v| v.as_str()).unwrap_or(""),
                        })
                    } else { serde_json::Value::Null };
                    serde_json::json!({
                        "id": c.get("commentId").and_then(|v| v.as_u64()).unwrap_or(0),
                        "content": c.get("content").and_then(|v| v.as_str()).unwrap_or(""),
                        "likedCount": c.get("likedCount").and_then(|v| v.as_u64()).unwrap_or(0),
                        "time": c.get("time").and_then(|v| v.as_u64()).unwrap_or(0),
                        "user": user_info,
                    })
                })
                .filter(|c| c.get("content").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false))
                .collect();
            let total = body.get("total").and_then(|v| v.as_u64()).unwrap_or(comments.len() as u64);
            Ok(serde_json::json!({"id": id, "total": total, "comments": comments, "hot": has_hot}))
        }
        Err(e) => Ok(serde_json::json!({"error": e, "comments": []}))
    }
}

// ── 播客 ────────────────────────────────────────────────────

#[tauri::command]
pub async fn netease_podcast_search(
    state: State<'_, Arc<AppState>>,
    keywords: String,
    limit: Option<u32>,
) -> Result<serde_json::Value, String> {
    let lim = limit.unwrap_or(18);
    let cookie = read_netease_cookie(&state).await;

    match netease_search::cloudsearch(&keywords, 1009, lim, 0, &cookie).await {
        Ok(resp) => {
            let result = resp.body.get("result").cloned().unwrap_or(serde_json::Value::Null);
            let raw = result.get("djRadios").or_else(|| result.get("djradios"))
                .or_else(|| result.get("radios"))
                .and_then(|v| v.as_array()).cloned().unwrap_or_default();
            let podcasts: Vec<serde_json::Value> = raw.iter()
                .map(|r| map_podcast(r))
                .filter(|p| p.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0)
                .collect();
            let total = result.get("djRadiosCount").or_else(|| result.get("djradiosCount"))
                .and_then(|v| v.as_u64()).unwrap_or(podcasts.len() as u64);
            Ok(serde_json::json!({"podcasts": podcasts, "total": total}))
        }
        Err(e) => Ok(serde_json::json!({"error": e, "podcasts": []}))
    }
}

#[tauri::command]
pub async fn netease_podcast_hot(
    state: State<'_, Arc<AppState>>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<serde_json::Value, String> {
    let lim = limit.unwrap_or(18);
    let off = offset.unwrap_or(0);
    let cookie = read_netease_cookie(&state).await;

    match netease_podcast::dj_hot(lim, off, &cookie).await {
        Ok(resp) => {
            let raw = resp.body.get("djRadios").or_else(|| resp.body.get("djradios"))
                .or_else(|| resp.body.get("radios")).or_else(|| resp.body.get("data"))
                .and_then(|v| v.as_array()).cloned().unwrap_or_default();
            let podcasts: Vec<serde_json::Value> = raw.iter().map(|r| map_podcast(r))
                .filter(|p| p.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0).collect();
            let more = resp.body.get("hasMore").and_then(|v| v.as_bool()).unwrap_or(false);
            Ok(serde_json::json!({"podcasts": podcasts, "more": more}))
        }
        Err(e) => Ok(serde_json::json!({"error": e, "podcasts": []}))
    }
}

#[tauri::command]
pub async fn netease_podcast_detail(
    state: State<'_, Arc<AppState>>,
    id: u64,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;
    match netease_podcast::dj_detail(id, &cookie).await {
        Ok(resp) => {
            let raw = resp.body.get("data").or_else(|| resp.body.get("djRadio"))
                .or_else(|| resp.body.get("radio")).unwrap_or(&resp.body);
            Ok(serde_json::json!({"podcast": map_podcast(raw)}))
        }
        Err(e) => Ok(serde_json::json!({"error": e}))
    }
}

#[tauri::command]
pub async fn netease_podcast_programs(
    state: State<'_, Arc<AppState>>,
    id: u64,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<serde_json::Value, String> {
    let lim = limit.unwrap_or(30);
    let off = offset.unwrap_or(0);
    let cookie = read_netease_cookie(&state).await;

    match netease_podcast::dj_program(id, lim, off, false, &cookie).await {
        Ok(resp) => {
            let body = &resp.body;
            let raw_programs = body.get("programs")
                .or_else(|| body.get("data").and_then(|d| d.get("list").or_else(|| d.get("programs"))))
                .and_then(|v| v.as_array()).cloned().unwrap_or_default();
            let radio = serde_json::json!({"id": id, "rid": id});
            let programs: Vec<serde_json::Value> = raw_programs.iter()
                .map(|p| {
                    serde_json::json!({
                        "id": p.get("id").and_then(|v| v.as_u64()).unwrap_or(0),
                        "name": p.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                        "duration": p.get("duration").and_then(|v| v.as_u64()).unwrap_or(0),
                        "cover": p.get("coverUrl").or_else(|| p.get("blurCoverUrl")).and_then(|v| v.as_str()).unwrap_or(""),
                        "desc": p.get("description").and_then(|v| v.as_str()).unwrap_or(""),
                        "radio": radio,
                    })
                })
                .filter(|p| p.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0)
                .collect();
            let more = body.get("more").and_then(|v| v.as_bool()).unwrap_or(false);
            let total = body.get("count").and_then(|v| v.as_u64()).unwrap_or(programs.len() as u64);
            Ok(serde_json::json!({"programs": programs, "more": more, "total": total}))
        }
        Err(e) => Ok(serde_json::json!({"error": e, "programs": []}))
    }
}

#[tauri::command]
pub async fn netease_podcast_my(
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;
    if cookie.is_empty() {
        return Ok(serde_json::json!({"loggedIn": false, "collections": []}));
    }
    match netease_podcast::dj_sublist(30, 0, &cookie).await {
        Ok(resp) => {
            let raw = resp.body.get("djRadios").or_else(|| resp.body.get("djradios"))
                .or_else(|| resp.body.get("data")).and_then(|v| v.as_array()).cloned().unwrap_or_default();
            let items: Vec<serde_json::Value> = raw.iter().map(|r| map_podcast(r))
                .filter(|p| p.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0).collect();
            let total = resp.body.get("count").and_then(|v| v.as_u64()).unwrap_or(items.len() as u64);
            let collections = serde_json::json!([
                {"key": "collect", "label": "收藏的播客", "items": items, "total": total},
            ]);
            Ok(serde_json::json!({"loggedIn": true, "collections": collections}))
        }
        Err(e) => Ok(serde_json::json!({"loggedIn": true, "collections": [], "error": e}))
    }
}

// ── 发现页 ──────────────────────────────────────────────────

#[tauri::command]
pub async fn netease_discover_home(
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;
    if cookie.is_empty() {
        return Ok(serde_json::json!({"loggedIn": false, "dailySongs": [], "playlists": [], "podcasts": []}));
    }

    let (personalized_res, dj_hot_res, recommend_res, daily_songs_res) = tokio::join!(
        personalized::personalized(8, &cookie),
        netease_podcast::dj_hot(6, 0, &cookie),
        personalized::recommend_resource(&cookie),
        personalized::recommend_songs(&cookie),
    );

    let public_playlists: Vec<serde_json::Value> = personalized_res.ok()
        .and_then(|r| r.body.get("result").or_else(|| r.body.get("data")).cloned())
        .and_then(|v| v.as_array().cloned()).unwrap_or_default()
        .iter().map(|pl| map_playlist(pl, "推荐歌单"))
        .filter(|pl| pl.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0).take(8).collect();

    let podcasts: Vec<serde_json::Value> = dj_hot_res.ok()
        .and_then(|r| r.body.get("djRadios").or_else(|| r.body.get("djradios"))
            .or_else(|| r.body.get("radios")).or_else(|| r.body.get("data")).cloned())
        .and_then(|v| v.as_array().cloned()).unwrap_or_default()
        .iter().map(|p| map_podcast(p))
        .filter(|p| p.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0).take(6).collect();

    let private_playlists: Vec<serde_json::Value> = recommend_res.ok()
        .and_then(|r| r.body.get("recommend").or_else(|| r.body.get("data")).cloned())
        .and_then(|v| v.as_array().cloned()).unwrap_or_default()
        .iter().map(|pl| map_playlist(pl, "私人推荐"))
        .filter(|pl| pl.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0).take(6).collect();

    let daily_songs: Vec<serde_json::Value> = daily_songs_res.ok()
        .and_then(|r| r.body.get("data").and_then(|d| d.get("dailySongs").or_else(|| d.get("recommend")))
            .or_else(|| r.body.get("recommend")).cloned())
        .and_then(|v| v.as_array().cloned()).unwrap_or_default()
        .iter().map(|s| map_song(s))
        .filter(|s| s.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0).take(12).collect();

    let mut all_playlists = private_playlists;
    all_playlists.extend(public_playlists);
    all_playlists.truncate(10);

    Ok(serde_json::json!({
        "loggedIn": true,
        "dailySongs": daily_songs,
        "playlists": all_playlists,
        "podcasts": podcasts,
    }))
}

// ── 登录状态 / 登出 ────────────────────────────────────────

#[tauri::command]
pub async fn netease_login_status(
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;
    if cookie.is_empty() {
        return Ok(serde_json::json!({"loggedIn": false, "vipType": 0, "vipLevel": "none", "isVip": false, "isSvip": false, "vipLabel": "无VIP"}));
    }
    match netease_login::login_status(&cookie).await {
        Ok(resp) => {
            let mut body = resp.body.clone();
            enrich_login_body(&mut body);
            Ok(body)
        }
        Err(_) => Ok(serde_json::json!({"loggedIn": false, "vipType": 0, "vipLevel": "none", "isVip": false, "isSvip": false, "vipLabel": "无VIP"}))
    }
}

#[tauri::command]
pub async fn netease_logout(
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;
    let _ = netease_login::logout(&cookie).await;
    {
        let mut state_cookie = state.netease_cookie.write().await;
        *state_cookie = String::new();
    }
    crate::cookie_store::save_netease_cookie(&state, "");
    Ok(serde_json::json!({"ok": true}))
}

#[tauri::command]
pub async fn netease_login_cookie(
    state: State<'_, Arc<AppState>>,
    cookie: String,
) -> Result<serde_json::Value, String> {
    {
        let mut state_cookie = state.netease_cookie.write().await;
        *state_cookie = cookie.clone();
        crate::cookie_store::save_netease_cookie(&state, &cookie);
    }
    let stored = read_netease_cookie(&state).await;
    match netease_login::login_status(&stored).await {
        Ok(resp) => {
            let mut result = resp.body.clone();
            enrich_login_body(&mut result);
            result["saved"] = serde_json::json!(true);
            result["hasCookie"] = serde_json::json!(!stored.is_empty());
            Ok(result)
        }
        Err(e) => Ok(serde_json::json!({"loggedIn": false, "error": e.to_string(), "saved": true, "hasCookie": !stored.is_empty()}))
    }
}

// ── 扫码登录 ────────────────────────────────────────────────

#[tauri::command]
pub async fn netease_qr_key(
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;
    match netease_login::login_qr_key(&cookie).await {
        Ok(resp) => {
            let key = resp.body.get("data").and_then(|d| d.get("unikey"))
                .or_else(|| resp.body.get("unikey"))
                .and_then(|k| k.as_str())
                .unwrap_or("");
            Ok(serde_json::json!({"key": key}))
        }
        Err(e) => Ok(serde_json::json!({"error": e}))
    }
}

#[tauri::command]
pub async fn netease_qr_create(
    state: State<'_, Arc<AppState>>,
    key: String,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;
    match netease_login::login_qr_create(&key, &cookie).await {
        Ok(resp) => {
            let data = resp.body.get("data").cloned().unwrap_or(serde_json::Value::Null);
            let img = data.get("qrimg").and_then(|v| v.as_str()).unwrap_or("");
            let url = data.get("qrurl").and_then(|v| v.as_str()).unwrap_or("");
            Ok(serde_json::json!({"img": img, "url": url}))
        }
        Err(e) => Ok(serde_json::json!({"error": e}))
    }
}

#[tauri::command]
pub async fn netease_qr_check(
    state: State<'_, Arc<AppState>>,
    key: String,
) -> Result<serde_json::Value, String> {
    let cookie = read_netease_cookie(&state).await;
    match netease_login::login_qr_check(&key, &cookie).await {
        Ok(resp) => {
            let code = resp.body.get("code").and_then(|c| c.as_u64()).unwrap_or(0) as u16;
            let message = resp.body.get("message").and_then(|m| m.as_str()).unwrap_or("");

            if code == 803 {
                // 登录成功
                let mut saved_cookie = String::new();
                if let Some(cookie_val) = resp.body.get("cookie").and_then(|c| c.as_str()) {
                    saved_cookie = cookie_val.to_string();
                    let mut state_cookie = state.netease_cookie.write().await;
                    *state_cookie = cookie_val.to_string();
                    crate::cookie_store::save_netease_cookie(&state, cookie_val);
                }

                let profile = resp.body.get("profile").cloned().unwrap_or(serde_json::Value::Null);
                let nickname = profile.get("nickname").and_then(|v| v.as_str())
                    .or_else(|| resp.body.get("nickname").and_then(|v| v.as_str()))
                    .unwrap_or("网易云用户");
                let avatar = profile.get("avatarUrl").and_then(|v| v.as_str())
                    .or_else(|| resp.body.get("avatarUrl").and_then(|v| v.as_str()))
                    .unwrap_or("");
                let user_id = profile.get("userId").and_then(|v| v.as_u64()).unwrap_or(0);
                let vip_type = profile.get("vipType").and_then(|v| v.as_u64()).unwrap_or(0);

                Ok(serde_json::json!({
                    "code": code, "message": message,
                    "loggedIn": true, "hasCookie": !saved_cookie.is_empty(),
                    "nickname": nickname, "avatar": avatar,
                    "userId": user_id, "vipType": vip_type,
                    "isVip": vip_type > 0, "isSvip": false,
                    "vipLabel": if vip_type > 0 { "VIP" } else { "无VIP" },
                }))
            } else {
                Ok(serde_json::json!({
                    "code": code, "message": message,
                    "nickname": resp.body.get("nickname").and_then(|v| v.as_str()),
                    "avatar": resp.body.get("avatarUrl").and_then(|v| v.as_str()),
                }))
            }
        }
        Err(e) => Ok(serde_json::json!({"error": e}))
    }
}
