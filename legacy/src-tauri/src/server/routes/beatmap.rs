use actix_web::{HttpRequest, HttpResponse, web::Json};
use serde_json::Value;
use std::collections::HashMap;
use tokio::sync::RwLock;

/// In-memory beatmap cache (key → JSON map data).
static BEAT_CACHE: RwLock<Option<HashMap<String, Value>>> = RwLock::const_new(None);

async fn get_or_init_cache() -> tokio::sync::RwLockReadGuard<'static, Option<HashMap<String, Value>>> {
    {
        let cache = BEAT_CACHE.read().await;
        if cache.is_some() {
            return cache;
        }
    }
    {
        let mut cache = BEAT_CACHE.write().await;
        if cache.is_none() {
            *cache = Some(HashMap::new());
        }
    }
    BEAT_CACHE.read().await
}

/// GET /api/beatmap/cache/status
pub async fn handle_cache_status() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "enabled": true,
        "mode": "memory-only",
        "dir": "",
        "drive": "",
        "reason": "",
    }))
}

/// GET /api/beatmap/cache?key=xxx
pub async fn handle_cache_get(req: HttpRequest) -> HttpResponse {
    let query = super::parse_query(&req);
    let key = query.get("key").cloned().unwrap_or_default();
    if key.is_empty() {
        return HttpResponse::Ok().json(serde_json::json!({ "ok": true, "hit": false, "key": "" }));
    }
    let cache_guard = get_or_init_cache().await;
    if let Some(cache) = cache_guard.as_ref() {
        if let Some(entry) = cache.get(&key) {
            return HttpResponse::Ok().json(serde_json::json!({
                "ok": true, "hit": true, "key": key,
                "map": entry.get("map"),
                "meta": entry.get("meta").unwrap_or(&Value::Null),
                "savedAt": entry.get("savedAt").and_then(|v| v.as_u64()).unwrap_or(0),
            }));
        }
    }
    HttpResponse::Ok().json(serde_json::json!({ "ok": true, "hit": false, "key": key }))
}

/// POST /api/beatmap/cache
pub async fn handle_cache_post(body: Json<Value>) -> HttpResponse {
    let key = body.get("key").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let map = body.get("map").cloned().unwrap_or(Value::Null);
    if key.is_empty() || map.is_null() {
        return HttpResponse::Ok().json(serde_json::json!({
            "ok": false, "error": "INVALID_BEATMAP_CACHE_PAYLOAD"
        }));
    }
    let meta = serde_json::json!({
        "provider": body.get("provider").and_then(|v| v.as_str()).unwrap_or(""),
        "title": body.get("title").and_then(|v| v.as_str()).unwrap_or(""),
        "artist": body.get("artist").and_then(|v| v.as_str()).unwrap_or(""),
        "mode": body.get("mode").and_then(|v| v.as_str()).unwrap_or("mr"),
    });
    let entry = serde_json::json!({
        "v": 1, "key": key, "savedAt": chrono_now_ms(), "meta": meta, "map": map,
    });
    {
        let mut cache_guard = BEAT_CACHE.write().await;
        if let Some(ref mut cache) = *cache_guard {
            if cache.len() < 500 {
                cache.insert(key.clone(), entry);
            }
        }
    }
    HttpResponse::Ok().json(serde_json::json!({ "ok": true, "key": key }))
}

fn chrono_now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
