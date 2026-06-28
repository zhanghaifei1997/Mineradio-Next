use crate::netease::request::{self, CryptoMode, RequestOptions};

pub async fn search(
    keywords: &str,
    search_type: u32,
    limit: u32,
    offset: u32,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "s": keywords,
        "type": search_type,
        "limit": limit,
        "offset": offset,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/search/get", &data, &opts).await
}

pub async fn cloudsearch(
    keywords: &str,
    search_type: u32,
    limit: u32,
    offset: u32,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "s": keywords,
        "type": search_type,
        "limit": limit,
        "offset": offset,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/cloudsearch/pc", &data, &opts).await
}
