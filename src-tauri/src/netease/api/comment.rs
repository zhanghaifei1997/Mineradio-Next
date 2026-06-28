use crate::netease::request::{self, CryptoMode, RequestOptions};

pub async fn comment_music(
    id: u64,
    limit: u32,
    offset: u32,
    cookie: &str,
) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "rid": id,
        "limit": limit,
        "offset": offset,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request(&format!("/api/v1/resource/comments/R_SO_4_{}", id), &data, &opts).await
}
