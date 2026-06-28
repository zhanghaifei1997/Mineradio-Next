use actix_web::{web, HttpRequest, HttpResponse};
use crate::netease::api::podcast as netease_podcast;
use crate::netease::api::search as netease_search;
use crate::AppState;
use std::sync::Arc;

pub async fn handle_search(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let keywords = query.get("keywords").map(|s| s.as_str()).unwrap_or("").trim();
    if keywords.is_empty() {
        return HttpResponse::Ok().json(serde_json::json!({"podcasts": [], "total": 0}));
    }
    let limit: u32 = query.get("limit").and_then(|s| s.parse().ok()).unwrap_or(18);
    let cookie = state.netease_cookie.read().await.clone();

    // Use cloudsearch with type=1009 (podcast/djradio search)
    match netease_search::cloudsearch(keywords, 1009, limit, 0, &cookie).await {
        Ok(resp) => {
            let result = resp.body.get("result").cloned().unwrap_or(serde_json::Value::Null);
            let raw = result.get("djRadios")
                .or_else(|| result.get("djradios"))
                .or_else(|| result.get("radios"))
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            let podcasts: Vec<serde_json::Value> = raw.iter()
                .map(|r| super::discover::map_podcast(r))
                .filter(|p| p.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0)
                .collect();

            let total = result.get("djRadiosCount")
                .or_else(|| result.get("djradiosCount"))
                .and_then(|v| v.as_u64())
                .unwrap_or(podcasts.len() as u64);

            HttpResponse::Ok().json(serde_json::json!({"podcasts": podcasts, "total": total}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e, "podcasts": [],
        })),
    }
}

/// Map raw podcast/djradio response to { podcasts: [...], more: bool }
fn extract_podcasts(body: &serde_json::Value) -> Vec<serde_json::Value> {
    let raw = body.get("djRadios")
        .or_else(|| body.get("djradios"))
        .or_else(|| body.get("radios"))
        .or_else(|| body.get("data"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    raw.iter()
        .map(|r| super::discover::map_podcast(r))
        .filter(|p| p.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0)
        .collect()
}

pub async fn handle_hot(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let limit: u32 = query.get("limit").and_then(|s| s.parse().ok()).unwrap_or(18);
    let offset: u32 = query.get("offset").and_then(|s| s.parse().ok()).unwrap_or(0);
    let cookie = state.netease_cookie.read().await.clone();

    match netease_podcast::dj_hot(limit, offset, &cookie).await {
        Ok(resp) => {
            let podcasts = extract_podcasts(&resp.body);
            let more = resp.body.get("hasMore").and_then(|v| v.as_bool()).unwrap_or(false);
            HttpResponse::Ok().json(serde_json::json!({
                "podcasts": podcasts,
                "more": more,
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e, "podcasts": []})),
    }
}

pub async fn handle_detail(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let rid: u64 = match query.get("id").or(query.get("rid")).and_then(|s| s.parse().ok()) {
        Some(id) => id,
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing podcast id"})),
    };
    let cookie = state.netease_cookie.read().await.clone();

    match netease_podcast::dj_detail(rid, &cookie).await {
        Ok(resp) => {
            // The API returns body.data or body.djRadio
            let raw = resp.body.get("data")
                .or_else(|| resp.body.get("djRadio"))
                .or_else(|| resp.body.get("radio"))
                .unwrap_or(&resp.body);
            let podcast = super::discover::map_podcast(raw);
            HttpResponse::Ok().json(serde_json::json!({
                "podcast": podcast,
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e})),
    }
}

/// Map a podcast program record to the flat shape the frontend expects.
fn map_program(p: &serde_json::Value, radio: &serde_json::Value) -> serde_json::Value {
    let id = p.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
    let name = p.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let duration = p.get("duration").and_then(|v| v.as_u64()).unwrap_or(0);
    let cover = p.get("coverUrl").or_else(|| p.get("blurCoverUrl"))
        .and_then(|v| v.as_str()).unwrap_or("");
    let desc = p.get("description").and_then(|v| v.as_str()).unwrap_or("");
    let create_time = p.get("createTime").and_then(|v| v.as_u64()).unwrap_or(0);
    let listener_count = p.get("listenerCount").and_then(|v| v.as_u64()).unwrap_or(0);
    let main_song = p.get("mainSong").cloned().unwrap_or(serde_json::Value::Null);
    let audio_id = main_song.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
    let audio_url = main_song.get("mp3Url").or_else(|| main_song.get("playUrl"))
        .and_then(|v| v.as_str()).unwrap_or("");

    serde_json::json!({
        "id": id,
        "name": name,
        "duration": duration,
        "cover": cover,
        "desc": desc,
        "createTime": create_time,
        "listenerCount": listener_count,
        "audioId": audio_id,
        "audioUrl": audio_url,
        "radio": radio,
    })
}

pub async fn handle_programs(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let rid: u64 = match query.get("id").or(query.get("rid")).and_then(|s| s.parse().ok()) {
        Some(id) => id,
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing podcast id", "programs": []})),
    };
    let limit: u32 = query.get("limit").and_then(|s| s.parse().ok()).unwrap_or(30);
    let offset: u32 = query.get("offset").and_then(|s| s.parse().ok()).unwrap_or(0);
    let cookie = state.netease_cookie.read().await.clone();

    match netease_podcast::dj_program(rid, limit, offset, false, &cookie).await {
        Ok(resp) => {
            let body = &resp.body;
            let raw_programs = body.get("programs")
                .or_else(|| body.get("data").and_then(|d| d.get("list").or_else(|| d.get("programs"))))
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            // Extract radio info from first program or from body
            let first_radio = raw_programs.first()
                .and_then(|p| p.get("radio"))
                .cloned()
                .unwrap_or(serde_json::Value::Null);
            let radio = if first_radio.is_object() {
                super::discover::map_podcast(&first_radio)
            } else {
                serde_json::json!({"id": rid, "rid": rid})
            };

            let programs: Vec<serde_json::Value> = raw_programs.iter()
                .map(|p| map_program(p, &radio))
                .filter(|p| p.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0 && !p.get("name").and_then(|v| v.as_str()).unwrap_or("").is_empty())
                .collect();

            let more = body.get("more").and_then(|v| v.as_bool()).unwrap_or(false);
            let total = body.get("count").and_then(|v| v.as_u64()).unwrap_or(programs.len() as u64);

            HttpResponse::Ok().json(serde_json::json!({
                "radio": radio,
                "programs": programs,
                "more": more,
                "total": total,
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e, "programs": []})),
    }
}

pub async fn handle_my(
    _req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let cookie = state.netease_cookie.read().await.clone();

    if cookie.is_empty() {
        let empty_collections = serde_json::json!([
            {"key": "collect", "label": "收藏的播客", "items": [], "total": 0},
            {"key": "created", "label": "创建的播客", "items": [], "total": 0},
            {"key": "liked", "label": "赞过的播客", "items": [], "total": 0},
        ]);
        return HttpResponse::Ok().json(serde_json::json!({
            "loggedIn": false,
            "collections": empty_collections,
        }));
    }

    // Get user info
    let uid = match crate::netease::api::login::login_status(&cookie).await {
        Ok(resp) => resp.body.get("profile")
            .and_then(|p| p.get("userId"))
            .and_then(|id| id.as_u64())
            .unwrap_or(0),
        Err(_) => 0,
    };

    // Fetch subscribed podcasts
    match netease_podcast::dj_sublist(30, 0, &cookie).await {
        Ok(resp) => {
            let body = &resp.body;
            let raw = body.get("djRadios")
                .or_else(|| body.get("djradios"))
                .or_else(|| body.get("data"))
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            let items: Vec<serde_json::Value> = raw.iter()
                .map(|r| super::discover::map_podcast(r))
                .filter(|p| p.get("id").and_then(|v| v.as_u64()).unwrap_or(0) != 0)
                .collect();

            let total = body.get("count").and_then(|v| v.as_u64()).unwrap_or(items.len() as u64);

            let collections = serde_json::json!([
                {"key": "collect", "label": "收藏的播客", "items": items, "total": total},
                {"key": "created", "label": "创建的播客", "items": [], "total": 0},
                {"key": "liked", "label": "赞过的播客", "items": [], "total": 0},
            ]);

            HttpResponse::Ok().json(serde_json::json!({
                "loggedIn": true,
                "userId": uid,
                "collections": collections,
            }))
        }
        Err(e) => {
            let empty_collections = serde_json::json!([
                {"key": "collect", "label": "收藏的播客", "items": [], "total": 0},
                {"key": "created", "label": "创建的播客", "items": [], "total": 0},
                {"key": "liked", "label": "赞过的播客", "items": [], "total": 0},
            ]);
            HttpResponse::Ok().json(serde_json::json!({
                "loggedIn": true,
                "userId": uid,
                "collections": empty_collections,
                "error": e,
            }))
        }
    }
}
