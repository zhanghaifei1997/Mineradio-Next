use crate::netease::request::{self, CryptoMode, RequestOptions};

#[allow(dead_code)]
pub async fn song_detail(ids: &[u64], cookie: &str) -> Result<request::ApiResponse, String> {
    let c: Vec<serde_json::Value> = ids.iter().map(|id| serde_json::json!({"id": id})).collect();
    let data = serde_json::json!({ "c": serde_json::to_string(&c).unwrap_or_default() });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/v3/song/detail", &data, &opts).await
}

pub async fn song_url(id: u64, br: u32, cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "ids": format!("[{}]", id),
        "br": br,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/song/enhance/player/url", &data, &opts).await
}

pub async fn song_url_v1(
    id: u64,
    level: &str,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let mut data = serde_json::json!({
        "ids": format!("[{}]", id),
        "level": level,
        "encodeType": "flac",
    });
    if level == "sky" {
        data["immerseType"] = serde_json::Value::String("c51".into());
    }
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/song/enhance/player/url/v1", &data, &opts).await
}
