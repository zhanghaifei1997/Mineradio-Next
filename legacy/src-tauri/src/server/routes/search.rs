use actix_web::{web, HttpRequest, HttpResponse};
use crate::netease::api::search as netease_search;
use crate::AppState;
use std::sync::Arc;

pub async fn handle_search(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);

    let keywords = query.get("keywords").map(|s| s.as_str()).unwrap_or("");
    let limit: u32 = query.get("limit").and_then(|s| s.parse().ok()).unwrap_or(30);
    let offset: u32 = query.get("offset").and_then(|s| s.parse().ok()).unwrap_or(0);

    let cookie = state.netease_cookie.read().await.clone();

    // Try cloudsearch first (better fields), fallback to search
    let result = match netease_search::cloudsearch(keywords, 1, limit, offset, &cookie).await {
        Ok(r) => Ok(r),
        Err(_) => netease_search::search(keywords, 1, limit, offset, &cookie).await,
    };

    match result {
        Ok(resp) => {
            let raw_songs = resp.body
                .get("result")
                .and_then(|r| r.get("songs"))
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            let songs: Vec<serde_json::Value> = raw_songs.iter()
                .map(|s| super::discover::map_song(s))
                .filter(|s| s.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0)
                .collect();

            HttpResponse::Ok().json(serde_json::json!({"songs": songs}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e,
            "songs": [],
        })),
    }
}
