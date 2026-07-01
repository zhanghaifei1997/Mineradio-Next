use crate::netease::request::{self, CryptoMode, RequestOptions};

pub async fn artist_detail(
    id: u64,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({ "id": id });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/artist/head/info/get", &data, &opts).await
}

#[allow(dead_code)]
pub async fn artist_top_song(
    id: u64,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "id": id,
        "order": "hot",
        "limit": 50,
        "offset": 0,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/artist/top/song", &data, &opts).await
}

pub async fn artist_songs(
    id: u64,
    order: &str,
    limit: u32,
    offset: u32,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "id": id,
        "order": order,
        "limit": limit,
        "offset": offset,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/v1/artist/songs", &data, &opts).await
}
