use actix_web::{web, HttpRequest, HttpResponse};
use crate::netease::api::like as netease_like;
use crate::netease::api::login as netease_login;
use crate::AppState;
use std::sync::Arc;

/// GET /api/song/like?id=123&like=true
/// Frontend sends GET with query params, not POST with JSON body.
pub async fn handle_like(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let id: u64 = match query.get("id").and_then(|s| s.parse().ok()) {
        Some(id) => id,
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing song id"})),
    };
    let like_val = query.get("like")
        .map(|s| s.as_str() != "false")
        .unwrap_or(true);
    let cookie = state.netease_cookie.read().await.clone();

    if cookie.is_empty() {
        return HttpResponse::Ok().json(serde_json::json!({
            "loggedIn": false, "id": id, "error": "Not logged in"
        }));
    }

    match netease_like::like_song(id, like_val, &cookie).await {
        Ok(resp) => {
            let code = resp.body.get("code").and_then(|c| c.as_u64()).unwrap_or(200);
            HttpResponse::Ok().json(serde_json::json!({
                "loggedIn": true,
                "id": id,
                "liked": like_val,
                "code": code,
                "body": resp.body,
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e, "id": id, "liked": !like_val
        })),
    }
}

/// GET /api/song/like/check?ids=1,2,3
/// Frontend expects response: { loggedIn, ids, liked: { "123": true, "456": false } }
pub async fn handle_like_check(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let cookie = state.netease_cookie.read().await.clone();

    // Parse requested IDs
    let ids_str = query.get("ids").or(query.get("id")).map(|s| s.as_str()).unwrap_or("");
    let ids: Vec<String> = ids_str.split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if ids.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Missing song id", "liked": {}, "ids": []
        }));
    }

    if cookie.is_empty() {
        let liked: serde_json::Map<String, serde_json::Value> = ids.iter()
            .map(|id| (id.clone(), serde_json::json!(false)))
            .collect();
        return HttpResponse::Ok().json(serde_json::json!({
            "loggedIn": false, "ids": ids, "liked": liked
        }));
    }

    // Get user ID from login status
    let uid = match netease_login::login_status(&cookie).await {
        Ok(resp) => resp.body.get("profile")
            .and_then(|p| p.get("userId"))
            .and_then(|id| id.as_u64())
            .unwrap_or(0),
        Err(_) => 0,
    };

    if uid == 0 {
        let liked: serde_json::Map<String, serde_json::Value> = ids.iter()
            .map(|id| (id.clone(), serde_json::json!(false)))
            .collect();
        return HttpResponse::Ok().json(serde_json::json!({
            "loggedIn": false, "ids": ids, "liked": liked
        }));
    }

    // First try song_like_check for exact IDs
    let ids_json = serde_json::to_string(&ids.iter().filter_map(|s| s.parse::<u64>().ok()).collect::<Vec<u64>>()).unwrap_or_default();
    let mut liked_ids: Vec<String> = Vec::new();

    if let Ok(check_resp) = netease_like::song_like_check(&ids_json, &cookie).await {
        let data = check_resp.body.get("data").or(check_resp.body.get("ids"));
        if let Some(arr) = data.and_then(|v| v.as_array()) {
            liked_ids = arr.iter().filter_map(|v| v.as_u64().map(|n| n.to_string())).collect();
        } else if let Some(obj) = data.and_then(|v| v.as_object()) {
            for id in &ids {
                if obj.get(id).and_then(|v| v.as_bool()).unwrap_or(false)
                    || obj.get(&id.parse::<u64>().unwrap_or(0).to_string()).and_then(|v| v.as_bool()).unwrap_or(false)
                {
                    liked_ids.push(id.clone());
                }
            }
        }
    }

    // Fallback: use likelist
    if liked_ids.is_empty() {
        if let Ok(resp) = netease_like::likelist(uid, &cookie).await {
            liked_ids = resp.body.get("ids")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_u64().map(|n| n.to_string())).collect())
                .unwrap_or_default();
        }
    }

    // Build liked map: { "123": true, "456": false }
    let liked_set: std::collections::HashSet<String> = liked_ids.into_iter().collect();
    let liked: serde_json::Map<String, serde_json::Value> = ids.iter()
        .map(|id| (id.clone(), serde_json::json!(liked_set.contains(id))))
        .collect();

    HttpResponse::Ok().json(serde_json::json!({
        "loggedIn": true,
        "ids": ids,
        "liked": liked,
    }))
}
