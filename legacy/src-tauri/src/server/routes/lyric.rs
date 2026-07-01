use actix_web::{web, HttpRequest, HttpResponse};
use crate::netease::api::lyric as netease_lyric;
use crate::AppState;
use std::sync::Arc;

pub async fn handle_lyric(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let id: u64 = match query.get("id").and_then(|s| s.parse().ok()) {
        Some(id) => id,
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing song id", "lyric": ""})),
    };
    let cookie = state.netease_cookie.read().await.clone();

    // Try lyric_new first, fallback to lyric
    let mut body = serde_json::Value::Null;
    if let Ok(resp) = netease_lyric::lyric_new(id, &cookie).await {
        body = resp.body;
    }
    let has_lyric = body.get("lrc").and_then(|l| l.get("lyric")).and_then(|l| l.as_str()).map(|s| !s.is_empty()).unwrap_or(false)
        || body.get("yrc").and_then(|l| l.get("lyric")).and_then(|l| l.as_str()).map(|s| !s.is_empty()).unwrap_or(false);

    if !has_lyric {
        if let Ok(resp) = netease_lyric::lyric(id, &cookie).await {
            body = resp.body;
        }
    }

    HttpResponse::Ok().json(serde_json::json!({
        "lyric": body.get("lrc").and_then(|l| l.get("lyric")).and_then(|l| l.as_str()).unwrap_or(""),
        "tlyric": body.get("tlyric").and_then(|l| l.get("lyric")).and_then(|l| l.as_str()).unwrap_or(""),
        "yrc": body.get("yrc").and_then(|l| l.get("lyric")).and_then(|l| l.as_str()).unwrap_or(""),
    }))
}
