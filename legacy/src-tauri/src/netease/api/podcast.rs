use crate::netease::request::{self, CryptoMode, RequestOptions};

pub async fn dj_detail(rid: u64, cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({ "id": rid });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/djradio/v2/get", &data, &opts).await
}

pub async fn dj_program(
    rid: u64,
    limit: u32,
    offset: u32,
    asc: bool,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "radioId": rid,
        "limit": limit,
        "offset": offset,
        "asc": asc,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/dj/program/byradio", &data, &opts).await
}

pub async fn dj_hot(limit: u32, offset: u32, cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "limit": limit,
        "offset": offset,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/djradio/hot/v1", &data, &opts).await
}

pub async fn dj_sublist(limit: u32, offset: u32, cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "limit": limit,
        "offset": offset,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/djradio/get/subed", &data, &opts).await
}
