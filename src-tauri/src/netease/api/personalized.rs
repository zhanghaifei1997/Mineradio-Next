use crate::netease::request::{self, CryptoMode, RequestOptions};

pub async fn personalized(limit: u32, cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({ "limit": limit });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/personalized/playlist", &data, &opts).await
}

pub async fn recommend_resource(cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({});
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/v1/discovery/recommend/resource", &data, &opts).await
}

pub async fn recommend_songs(cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({});
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/v3/discovery/recommend/songs", &data, &opts).await
}
