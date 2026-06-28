use actix_web::{web, HttpRequest, HttpResponse};
use crate::netease::api::artist as netease_artist;
use crate::AppState;
use std::sync::Arc;

pub async fn handle_artist_detail(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let id: u64 = match query.get("id").and_then(|s| s.parse().ok()) {
        Some(id) => id,
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing artist id", "songs": []})),
    };
    let cookie = state.netease_cookie.read().await.clone();

    let detail = netease_artist::artist_detail(id, &cookie).await;
    let songs_resp = netease_artist::artist_songs(id, "hot", 30, 0, &cookie).await;

    let raw_songs = songs_resp.ok()
        .and_then(|r| r.body.get("songs").cloned())
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default();

    let songs: Vec<serde_json::Value> = raw_songs.iter()
        .map(|s| super::discover::map_song(s))
        .filter(|s| s.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0)
        .collect();

    HttpResponse::Ok().json(serde_json::json!({
        "id": id,
        "artist": detail.as_ref().ok().map(|r| &r.body).unwrap_or(&serde_json::Value::Null),
        "songs": songs,
    }))
}
