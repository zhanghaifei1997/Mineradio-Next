use std::sync::Arc;
use tauri::State;
use crate::AppState;

/// Helper to read netease cookie from state
pub async fn read_netease_cookie(state: &State<'_, Arc<AppState>>) -> String {
    state.netease_cookie.read().await.clone()
}

/// Helper to read QQ cookie from state
pub async fn read_qq_cookie(state: &State<'_, Arc<AppState>>) -> String {
    state.qq_cookie.read().await.clone()
}

/// Map a raw Netease song record to the flat shape the frontend expects.
pub fn map_song(s: &serde_json::Value) -> serde_json::Value {
    let artists = s.get("ar").or_else(|| s.get("artists"))
        .and_then(|v| v.as_array())
        .cloned().unwrap_or_default();
    let artist_names: Vec<&str> = artists.iter()
        .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
        .collect();
    let artist_id = artists.first()
        .and_then(|a| a.get("id").and_then(|id| id.as_u64()))
        .unwrap_or(0);
    let album = s.get("al").or_else(|| s.get("album")).cloned().unwrap_or(serde_json::Value::Null);
    serde_json::json!({
        "provider": "netease",
        "source": "netease",
        "type": "song",
        "id": s.get("id").and_then(|v| v.as_u64()).unwrap_or(0),
        "name": s.get("name").and_then(|v| v.as_str()).unwrap_or(""),
        "artist": artist_names.join(" / "),
        "artists": artists,
        "artistId": artist_id,
        "album": album.get("name").and_then(|v| v.as_str()).unwrap_or(""),
        "cover": album.get("picUrl").or_else(|| album.get("coverUrl"))
            .and_then(|v| v.as_str()).unwrap_or(""),
        "duration": s.get("dt").or_else(|| s.get("duration"))
            .and_then(|v| v.as_u64()).unwrap_or(0),
        "fee": s.get("fee").and_then(|v| v.as_u64()).unwrap_or(0),
    })
}

/// Map a Netease playlist object.
pub fn map_playlist(pl: &serde_json::Value, tag: &str) -> serde_json::Value {
    let creator = pl.get("creator").or_else(|| pl.get("user")).cloned().unwrap_or(serde_json::Value::Null);
    serde_json::json!({
        "provider": "netease",
        "source": "netease",
        "type": "playlist",
        "id": pl.get("id").and_then(|v| v.as_u64()).unwrap_or(0),
        "name": pl.get("name").or_else(|| pl.get("title"))
            .and_then(|v| v.as_str()).unwrap_or(""),
        "cover": pl.get("picUrl").or_else(|| pl.get("coverImgUrl"))
            .or_else(|| pl.get("coverUrl"))
            .and_then(|v| v.as_str()).unwrap_or(""),
        "trackCount": pl.get("trackCount").or_else(|| pl.get("songCount"))
            .and_then(|v| v.as_u64()).unwrap_or(0),
        "playCount": pl.get("playCount").or_else(|| pl.get("playcount"))
            .and_then(|v| v.as_u64()).unwrap_or(0),
        "creator": creator.get("nickname").or_else(|| creator.get("name"))
            .and_then(|v| v.as_str()).unwrap_or(""),
        "tag": tag,
    })
}

/// Map a Netease podcast/djradio object.
pub fn map_podcast(r: &serde_json::Value) -> serde_json::Value {
    let dj = r.get("dj").or_else(|| r.get("djSimple"))
        .or_else(|| r.get("creator")).cloned().unwrap_or(serde_json::Value::Null);
    let id = r.get("id").or_else(|| r.get("rid")).or_else(|| r.get("radioId"))
        .and_then(|v| v.as_u64()).unwrap_or(0);
    serde_json::json!({
        "id": id,
        "rid": id,
        "name": r.get("name").or_else(|| r.get("radioName"))
            .and_then(|v| v.as_str()).unwrap_or(""),
        "cover": r.get("picUrl").or_else(|| r.get("coverUrl"))
            .or_else(|| r.get("coverImgUrl")).or_else(|| r.get("avatarUrl"))
            .and_then(|v| v.as_str()).unwrap_or(""),
        "desc": r.get("desc").or_else(|| r.get("description"))
            .or_else(|| r.get("rcmdText"))
            .and_then(|v| v.as_str()).unwrap_or(""),
        "djName": dj.get("nickname").and_then(|v| v.as_str())
            .or_else(|| r.get("djName").and_then(|v| v.as_str()))
            .unwrap_or(""),
        "category": r.get("category").or_else(|| r.get("categoryName"))
            .and_then(|v| v.as_str()).unwrap_or(""),
        "programCount": r.get("programCount").or_else(|| r.get("programNum"))
            .and_then(|v| v.as_u64()).unwrap_or(0),
        "subCount": r.get("subCount").or_else(|| r.get("subedCount"))
            .and_then(|v| v.as_u64()).unwrap_or(0),
    })
}

/// Map a playlist item (user playlists panel).
pub fn map_playlist_item(pl: &serde_json::Value) -> serde_json::Value {
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

/// Enrich a Netease login_status response body with flattened profile fields.
pub fn enrich_login_body(body: &mut serde_json::Value) {
    let code = body.get("code").and_then(|c| c.as_u64()).unwrap_or(0);
    let profile = body.get("profile").cloned().filter(|v| !v.is_null());
    let logged_in = code == 200 && profile.is_some();
    body["loggedIn"] = serde_json::json!(logged_in);

    if let Some(p) = profile {
        if let Some(nick) = p.get("nickname").and_then(|v| v.as_str()) {
            body["nickname"] = serde_json::json!(nick);
        }
        if let Some(url) = p.get("avatarUrl").and_then(|v| v.as_str()) {
            body["avatar"] = serde_json::json!(url);
        }
        if let Some(uid) = p.get("userId").and_then(|v| v.as_u64()) {
            body["userId"] = serde_json::json!(uid);
        }
        let vip_type = p.get("vipType").and_then(|v| v.as_u64()).unwrap_or(0);
        body["vipType"] = serde_json::json!(vip_type);
        let vip_level = p.get("vipLevel").and_then(|v| v.as_str())
            .unwrap_or(if vip_type > 0 { "vip" } else { "none" });
        body["vipLevel"] = serde_json::json!(vip_level);
        let is_vip = vip_type > 0;
        body["isVip"] = serde_json::json!(is_vip);
        let is_svip = p.get("isSvip").and_then(|v| v.as_bool()).unwrap_or(false) || vip_type >= 11;
        body["isSvip"] = serde_json::json!(is_svip);
        let vip_label = if is_svip { "SVIP" } else if is_vip { "VIP" } else { "无VIP" };
        body["vipLabel"] = serde_json::json!(vip_label);
    } else {
        body["vipType"] = serde_json::json!(0);
        body["vipLevel"] = serde_json::json!("none");
        body["isVip"] = serde_json::json!(false);
        body["isSvip"] = serde_json::json!(false);
        body["vipLabel"] = serde_json::json!("无VIP");
    }
}
