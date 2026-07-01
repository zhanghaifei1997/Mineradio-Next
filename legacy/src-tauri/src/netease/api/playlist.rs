use crate::netease::request::{self, CryptoMode, RequestOptions};

pub async fn user_playlist(
    uid: u64,
    limit: u32,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "uid": uid,
        "limit": limit,
        "offset": 0,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/user/playlist", &data, &opts).await
}

pub async fn playlist_track_all(
    id: u64,
    limit: u32,
    offset: u32,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "id": id,
        "limit": limit,
        "offset": offset,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/v6/playlist/detail", &data, &opts).await
}

pub async fn playlist_detail(
    id: u64,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "id": id,
        "s": 0,
        "n": 100000,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/v6/playlist/detail", &data, &opts).await
}

pub async fn playlist_create(
    name: &str,
    privacy: u32,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "name": name,
        "privacy": privacy,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/playlist/create", &data, &opts).await
}

#[allow(dead_code)]
pub async fn playlist_tracks(
    op: &str,
    pid: u64,
    track_ids: &str,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "op": op,
        "pid": pid,
        "trackIds": track_ids,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/playlist/manipulate/tracks", &data, &opts).await
}

#[allow(dead_code)]
pub async fn playlist_track_add(
    pid: u64,
    ids: &str,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "id": pid,
        "tracks": ids,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/playlist/track/add", &data, &opts).await
}
