use actix_web::{web, HttpRequest, HttpResponse};
use crate::netease::api::comment as netease_comment;
use crate::AppState;
use std::sync::Arc;

pub async fn handle_comments(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let id: u64 = match query.get("id").and_then(|s| s.parse().ok()) {
        Some(id) => id,
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing song id", "comments": []})),
    };
    let limit: u32 = query.get("limit").and_then(|s| s.parse().ok()).unwrap_or(20);
    let offset: u32 = query.get("offset").and_then(|s| s.parse().ok()).unwrap_or(0);
    let cookie = state.netease_cookie.read().await.clone();

    match netease_comment::comment_music(id, limit, offset, &cookie).await {
        Ok(resp) => {
            let body = &resp.body;
            let has_hot = body.get("hotComments").and_then(|v| v.as_array()).is_some() && offset == 0;
            let raw = if has_hot {
                body.get("hotComments").and_then(|v| v.as_array()).cloned().unwrap_or_default()
            } else {
                body.get("comments").and_then(|v| v.as_array()).cloned().unwrap_or_default()
            };

            let comments: Vec<serde_json::Value> = raw.iter()
                .map(|c| {
                    let user = c.get("user").cloned().unwrap_or(serde_json::Value::Null);
                    let user_info = if user.is_object() {
                        serde_json::json!({
                            "id": user.get("userId").and_then(|v| v.as_u64()).unwrap_or(0),
                            "nickname": user.get("nickname").and_then(|v| v.as_str()).unwrap_or(""),
                            "avatar": user.get("avatarUrl").and_then(|v| v.as_str()).unwrap_or(""),
                        })
                    } else {
                        serde_json::Value::Null
                    };
                    serde_json::json!({
                        "id": c.get("commentId").and_then(|v| v.as_u64()).unwrap_or(0),
                        "content": c.get("content").and_then(|v| v.as_str()).unwrap_or(""),
                        "likedCount": c.get("likedCount").and_then(|v| v.as_u64()).unwrap_or(0),
                        "time": c.get("time").and_then(|v| v.as_u64()).unwrap_or(0),
                        "user": user_info,
                    })
                })
                .filter(|c| c.get("content").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false))
                .collect();

            let total = body.get("total").and_then(|v| v.as_u64()).unwrap_or(comments.len() as u64);
            HttpResponse::Ok().json(serde_json::json!({
                "id": id,
                "total": total,
                "comments": comments,
                "hot": has_hot,
                "body": body,
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e, "comments": []})),
    }
}
