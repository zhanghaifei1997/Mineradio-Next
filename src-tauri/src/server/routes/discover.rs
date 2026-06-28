use actix_web::{web, HttpResponse};
use crate::netease::api::{personalized, podcast};
use crate::netease::api::login as netease_login;
use crate::AppState;
use log::info;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

fn now_millis() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64
}

/// Helper: map a raw Netease song record to the flat shape the frontend expects.
pub(crate) fn map_song(s: &serde_json::Value) -> serde_json::Value {
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

/// Helper: map a Netease playlist object.
fn map_playlist(pl: &serde_json::Value, tag: &str) -> serde_json::Value {
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

/// Helper: map a Netease podcast/djradio object.
pub(crate) fn map_podcast(r: &serde_json::Value) -> serde_json::Value {
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

pub async fn handle_home(
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let cookie = state.netease_cookie.read().await.clone();

    if cookie.is_empty() {
        return HttpResponse::Ok().json(serde_json::json!({
            "loggedIn": false,
            "user": null,
            "dailySongs": [],
            "playlists": [],
            "podcasts": [],
            "mode": "starter",
            "updatedAt": now_millis(),
        }));
    }

    // Call 4 Netease APIs in parallel
    let (personalized_res, dj_hot_res, recommend_res, daily_songs_res) = tokio::join!(
        personalized::personalized(8, &cookie),
        podcast::dj_hot(6, 0, &cookie),
        personalized::recommend_resource(&cookie),
        personalized::recommend_songs(&cookie),
    );

    // 1. Public playlists (personalized)
    let public_playlists: Vec<serde_json::Value> = personalized_res.ok()
        .and_then(|r| r.body.get("result").or_else(|| r.body.get("data")).cloned())
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default()
        .iter()
        .map(|pl| map_playlist(pl, "推荐歌单"))
        .filter(|pl| pl.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0)
        .take(8)
        .collect();

    // 2. Hot podcasts
    let podcasts: Vec<serde_json::Value> = dj_hot_res.ok()
        .and_then(|r| {
            r.body.get("djRadios").or_else(|| r.body.get("djradios"))
                .or_else(|| r.body.get("radios")).or_else(|| r.body.get("data"))
                .cloned()
        })
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default()
        .iter()
        .map(|p| map_podcast(p))
        .filter(|p| p.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0)
        .take(6)
        .collect();

    // 3. Private playlists (recommend_resource)
    let private_playlists: Vec<serde_json::Value> = recommend_res.ok()
        .and_then(|r| r.body.get("recommend").or_else(|| r.body.get("data")).cloned())
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default()
        .iter()
        .map(|pl| map_playlist(pl, "私人推荐"))
        .filter(|pl| pl.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0)
        .take(6)
        .collect();

    // 4. Daily songs (recommend_songs)
    let daily_songs: Vec<serde_json::Value> = daily_songs_res.ok()
        .and_then(|r| {
            r.body.get("data")
                .and_then(|d| d.get("dailySongs").or_else(|| d.get("recommend")))
                .or_else(|| r.body.get("recommend"))
                .cloned()
        })
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default()
        .iter()
        .map(|s| map_song(s))
        .filter(|s| s.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0)
        .take(12)
        .collect();

    // Merge playlists: private first, then public
    let mut all_playlists = private_playlists;
    all_playlists.extend(public_playlists);
    all_playlists.truncate(10);

    // Get user info for response
    let user_info = netease_login::login_status(&cookie).await.ok().map(|resp| {
        let profile = resp.body.get("profile").cloned().unwrap_or(serde_json::Value::Null);
        serde_json::json!({
            "userId": profile.get("userId").and_then(|v| v.as_u64()).unwrap_or(0),
            "nickname": profile.get("nickname").and_then(|v| v.as_str()).unwrap_or(""),
            "avatar": profile.get("avatarUrl").and_then(|v| v.as_str()).unwrap_or(""),
        })
    });

    info!("[discover/home] dailySongs={}, playlists={}, podcasts={}",
        daily_songs.len(), all_playlists.len(), podcasts.len());

    HttpResponse::Ok().json(serde_json::json!({
        "loggedIn": true,
        "user": user_info,
        "dailySongs": daily_songs,
        "playlists": all_playlists,
        "podcasts": podcasts,
        "mode": "member",
        "updatedAt": now_millis(),
    }))
}
