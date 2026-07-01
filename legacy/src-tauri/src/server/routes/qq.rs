use actix_web::{HttpRequest, HttpResponse};
use log::warn;
use crate::qq;
use crate::AppState;
use std::sync::Arc;
use actix_web::web;

/// GET /api/qq/search?keywords=xxx&limit=8
pub async fn handle_qq_search(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let keywords = query.get("keywords").cloned().unwrap_or_default();
    let limit: usize = query.get("limit")
        .and_then(|v| v.parse().ok())
        .unwrap_or(8)
        .clamp(4, 12);

    if keywords.is_empty() {
        return HttpResponse::Ok().json(serde_json::json!({ "provider": "qq", "songs": [] }));
    }

    let cookie = state.qq_cookie.read().await.clone();
    match qq::search(&keywords, limit, &cookie).await {
        Ok(songs) => HttpResponse::Ok().json(serde_json::json!({ "provider": "qq", "songs": songs })),
        Err(e) => {
            warn!("[QQSearch] error: {}", e);
            HttpResponse::Ok().json(serde_json::json!({ "provider": "qq", "songs": [], "error": e }))
        }
    }
}

/// GET /api/qq/song/url?mid=xxx&mediaMid=xxx&quality=xxx
pub async fn handle_qq_song_url(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let mid = query.get("mid").cloned().unwrap_or_default();
    let media_mid = query.get("mediaMid").or_else(|| query.get("media_mid")).cloned().unwrap_or_default();
    let quality = query.get("quality").cloned().unwrap_or_default();

    let cookie = state.qq_cookie.read().await.clone();
    let result = qq::get_song_url(&mid, &media_mid, &quality, &cookie).await;
    HttpResponse::Ok().json(result)
}

/// GET /api/qq/lyric?mid=xxx&id=xxx
pub async fn handle_qq_lyric(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let mid = query.get("mid").cloned().unwrap_or_default();
    let id = query.get("id").cloned().unwrap_or_default();

    let cookie = state.qq_cookie.read().await.clone();
    let result = qq::get_lyric(&mid, &id, &cookie).await;
    HttpResponse::Ok().json(result)
}

/// GET /api/qq/artist/detail?mid=xxx&limit=36
pub async fn handle_qq_artist_detail(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let mid = query.get("mid").or_else(|| query.get("singermid")).cloned().unwrap_or_default();
    let limit: u32 = query.get("limit")
        .and_then(|v| v.parse().ok())
        .unwrap_or(36)
        .clamp(10, 80);

    let cookie = state.qq_cookie.read().await.clone();
    let result = qq::get_artist_detail(&mid, limit, &cookie).await;
    HttpResponse::Ok().json(result)
}

/// GET /api/qq/playlist/tracks?id=xxx
pub async fn handle_qq_playlist_tracks(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let id = query.get("id").or_else(|| query.get("disstid")).cloned().unwrap_or_default();

    let cookie = state.qq_cookie.read().await.clone();
    let result = qq::get_playlist_tracks(&id, &cookie).await;
    HttpResponse::Ok().json(result)
}

/// GET /api/qq/song/comments?id=xxx&mid=xxx&limit=18
pub async fn handle_qq_song_comments(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let id = query.get("id").cloned().unwrap_or_default();
    let mid = query.get("mid").cloned().unwrap_or_default();
    let limit: u32 = query.get("limit")
        .and_then(|v| v.parse().ok())
        .unwrap_or(18)
        .clamp(5, 50);

    let cookie = state.qq_cookie.read().await.clone();
    let result = qq::get_song_comments(&id, &mid, limit, &cookie).await;
    HttpResponse::Ok().json(result)
}
