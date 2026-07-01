use crate::netease::request::{self, CryptoMode, RequestOptions};

pub async fn lyric(id: u64, cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({ "id": id });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/song/lyric", &data, &opts).await
}

pub async fn lyric_new(id: u64, cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "id": id,
        "cp": false,
        "tv": 0,
        "lv": 0,
        "rv": 0,
        "kv": 0,
        "yv": 0,
        "ytv": 0,
        "yrv": 0,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/song/lyric/v1", &data, &opts).await
}
