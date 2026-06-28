use crate::netease::request::{self, CryptoMode, RequestOptions};

pub async fn like_song(
    id: u64,
    like: bool,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "trackId": id,
        "like": like,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/radio/like", &data, &opts).await
}

pub async fn likelist(uid: u64, cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({ "uid": uid });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/song/like/get", &data, &opts).await
}

#[allow(dead_code)]
pub async fn song_like_check(
    ids: &str,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({ "ids": ids });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/song/like/check", &data, &opts).await
}
