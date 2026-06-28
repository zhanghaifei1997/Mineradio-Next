use actix_web::{web, HttpRequest, HttpResponse};
use crate::netease::api::song as netease_song;
use crate::AppState;
use std::sync::Arc;

pub async fn handle_song_url(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);

    let id: u64 = match query.get("id").and_then(|s| s.parse().ok()) {
        Some(id) => id,
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing song id"})),
    };
    let quality = query.get("quality").map(|s| s.as_str()).unwrap_or("standard");
    let cookie = state.netease_cookie.read().await.clone();

    // Try v1 first, fallback to regular
    let result = match netease_song::song_url_v1(id, quality, &cookie).await {
        Ok(resp) => Ok(resp),
        Err(_) => netease_song::song_url(id, 320000, &cookie).await,
    };

    match result {
        Ok(resp) => {
            let data = resp.body.get("data")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first());

            if let Some(d) = data {
                let url = d.get("url").and_then(|v| v.as_str()).unwrap_or("");
                let free_trial = d.get("freeTrialInfo").and_then(|v| v.as_object()).is_some()
                    && d.get("freeTrialInfo").map(|v| !v.is_null()).unwrap_or(false);
                let playable = !url.is_empty() && !free_trial;
                let level = d.get("level").and_then(|v| v.as_str()).unwrap_or(quality);
                let br = d.get("br").and_then(|v| v.as_u64()).unwrap_or(0);
                let typ = d.get("type").and_then(|v| v.as_str()).unwrap_or("mp3");

                HttpResponse::Ok().json(serde_json::json!({
                    "url": url,
                    "trial": free_trial,
                    "playable": playable,
                    "level": level,
                    "br": br,
                    "type": typ,
                    "requestedQuality": quality,
                }))
            } else {
                HttpResponse::Ok().json(serde_json::json!({"url": "", "trial": false, "playable": false}))
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "url": "", "trial": false, "playable": false, "error": e,
        })),
    }
}
