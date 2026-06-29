use actix_web::{web, HttpRequest, HttpResponse};
use log::info;
use crate::netease::api::login as netease_login;
use crate::qq;
use crate::cookie_store;
use crate::AppState;
use std::sync::Arc;

pub async fn handle_qr_key(
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let cookie = state.netease_cookie.read().await.clone();
    match netease_login::login_qr_key(&cookie).await {
        Ok(resp) => {
            info!("QR key response: status={}, body={:?}", resp.status, resp.body);
            let key = resp.body
                .get("data")
                .and_then(|d| d.get("unikey"))
                .or_else(|| resp.body.get("unikey"))
                .and_then(|k| k.as_str())
                .unwrap_or("");
            HttpResponse::Ok().json(serde_json::json!({"key": key}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e})),
    }
}

/// GET /api/login/qr/create?key=xxx
/// Returns QR code image (base64 data URI) for scanning.
pub async fn handle_qr_create(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let key = query.get("key").map(|s| s.as_str()).unwrap_or("");
    if key.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing key"}));
    }
    let cookie = state.netease_cookie.read().await.clone();
    match netease_login::login_qr_create(key, &cookie).await {
        Ok(resp) => {
            let data = resp.body.get("data").cloned().unwrap_or(serde_json::Value::Null);
            let img = data.get("qrimg").and_then(|v| v.as_str()).unwrap_or("");
            let url = data.get("qrurl").and_then(|v| v.as_str()).unwrap_or("");
            HttpResponse::Ok().json(serde_json::json!({
                "img": img,
                "url": url,
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e})),
    }
}

pub async fn handle_qr_check(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let key = query.get("key").map(|s| s.as_str()).unwrap_or("");
    let cookie = state.netease_cookie.read().await.clone();

    match netease_login::login_qr_check(key, &cookie).await {
        Ok(resp) => {
            let code = resp.body.get("code").and_then(|c| c.as_u64()).unwrap_or(0) as u16;
            let message = resp.body.get("message").and_then(|m| m.as_str()).unwrap_or("");

            if code == 803 {
                // Login success — save cookie if present
                let mut saved_cookie = String::new();
                if let Some(cookie_val) = resp.body.get("cookie").and_then(|c| c.as_str()) {
                    saved_cookie = cookie_val.to_string();
                    let mut state_cookie = state.netease_cookie.write().await;
                    *state_cookie = cookie_val.to_string();
                    cookie_store::save_netease_cookie(&state, cookie_val);
                }

                // Build response with profile fields at top level (frontend expects this)
                let profile = resp.body.get("profile").cloned().unwrap_or(serde_json::Value::Null);
                let nickname = profile.get("nickname").and_then(|v| v.as_str())
                    .or_else(|| resp.body.get("nickname").and_then(|v| v.as_str()))
                    .unwrap_or("网易云用户");
                let avatar = profile.get("avatarUrl").and_then(|v| v.as_str())
                    .or_else(|| resp.body.get("avatarUrl").and_then(|v| v.as_str()))
                    .unwrap_or("");
                let user_id = profile.get("userId").and_then(|v| v.as_u64())
                    .unwrap_or(0);
                let vip_type = profile.get("vipType").and_then(|v| v.as_u64()).unwrap_or(0);

                // If profile is empty, try to get login status
                let mut login_info = serde_json::Value::Null;
                if !saved_cookie.is_empty() && profile.is_null() {
                    if let Ok(status) = netease_login::login_status(&saved_cookie).await {
                        login_info = status.body;
                    }
                }

                let login_profile = login_info.get("profile").cloned().unwrap_or(serde_json::Value::Null);
                let final_nickname = if profile.is_null() && !login_profile.is_null() {
                    login_profile.get("nickname").and_then(|v| v.as_str()).unwrap_or(nickname)
                } else { nickname };
                let final_avatar = if profile.is_null() && !login_profile.is_null() {
                    login_profile.get("avatarUrl").and_then(|v| v.as_str()).unwrap_or(avatar)
                } else { avatar };
                let final_uid = if profile.is_null() && !login_profile.is_null() {
                    login_profile.get("userId").and_then(|v| v.as_u64()).unwrap_or(user_id)
                } else { user_id };
                let final_vip = if profile.is_null() && !login_profile.is_null() {
                    login_profile.get("vipType").and_then(|v| v.as_u64()).unwrap_or(vip_type)
                } else { vip_type };

                HttpResponse::Ok().json(serde_json::json!({
                    "code": code,
                    "message": message,
                    "loggedIn": true,
                    "hasCookie": !saved_cookie.is_empty(),
                    "nickname": final_nickname,
                    "avatar": final_avatar,
                    "userId": final_uid,
                    "vipType": final_vip,
                    "vipLevel": "none",
                    "isVip": final_vip > 0,
                    "isSvip": false,
                    "vipLabel": if final_vip > 0 { "VIP" } else { "无VIP" },
                }))
            } else {
                // Not logged in yet (801=waiting, 802=scanned, 800=expired)
                HttpResponse::Ok().json(serde_json::json!({
                    "code": code,
                    "message": message,
                    "nickname": resp.body.get("nickname").and_then(|v| v.as_str()),
                    "avatar": resp.body.get("avatarUrl").and_then(|v| v.as_str()),
                }))
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e})),
    }
}

/// Enrich a Netease login_status response body with flattened profile fields
/// that the frontend expects at top level.
fn enrich_login_body(body: &mut serde_json::Value) {
    let code = body.get("code").and_then(|c| c.as_u64()).unwrap_or(0);

    // Treat profile: null (Some(Value::Null)) the same as missing profile (None).
    // The Netease API returns code:200 + profile:null when the cookie is recognized
    // but the session has been invalidated (e.g. after logout).
    let profile = body.get("profile")
        .cloned()
        .filter(|v| !v.is_null());
    let logged_in = code == 200 && profile.is_some();
    body["loggedIn"] = serde_json::json!(logged_in);

    if let Some(p) = profile {
        if let Some(nick) = p.get("nickname").and_then(|v| v.as_str()) {
            body["nickname"] = serde_json::json!(nick);
        }
        if let Some(url) = p.get("avatarUrl").and_then(|v| v.as_str()) {
            body["avatar"] = serde_json::json!(url);
        }
        if let Some(uid) = p.get("userId").and_then(|v| v.as_u64()) {
            body["userId"] = serde_json::json!(uid);
        }
        let vip_type = p.get("vipType").and_then(|v| v.as_u64()).unwrap_or(0);
        body["vipType"] = serde_json::json!(vip_type);

        // VIP fields the frontend expects
        let vip_level = p.get("vipLevel").and_then(|v| v.as_str())
            .unwrap_or(if vip_type > 0 { "vip" } else { "none" });
        body["vipLevel"] = serde_json::json!(vip_level);

        let is_vip = vip_type > 0;
        body["isVip"] = serde_json::json!(is_vip);

        // Check for SVIP (vipType >= 11 or explicit flag)
        let is_svip = p.get("isSvip").and_then(|v| v.as_bool()).unwrap_or(false)
            || vip_type >= 11;
        body["isSvip"] = serde_json::json!(is_svip);

        let vip_label = if is_svip {
            "SVIP"
        } else if is_vip {
            "VIP"
        } else {
            "无VIP"
        };
        body["vipLabel"] = serde_json::json!(vip_label);
    } else {
        body["vipType"] = serde_json::json!(0);
        body["vipLevel"] = serde_json::json!("none");
        body["isVip"] = serde_json::json!(false);
        body["isSvip"] = serde_json::json!(false);
        body["vipLabel"] = serde_json::json!("无VIP");
    }
}

pub async fn handle_login_status(
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let cookie = state.netease_cookie.read().await.clone();
    if cookie.is_empty() {
        return HttpResponse::Ok().json(serde_json::json!({
            "loggedIn": false,
            "vipType": 0,
            "vipLevel": "none",
            "isVip": false,
            "isSvip": false,
            "vipLabel": "无VIP",
        }));
    }
    match netease_login::login_status(&cookie).await {
        Ok(resp) => {
            let mut body = resp.body.clone();
            enrich_login_body(&mut body);
            HttpResponse::Ok().json(body)
        }
        Err(_) => HttpResponse::Ok().json(serde_json::json!({
            "loggedIn": false,
            "vipType": 0,
            "vipLevel": "none",
            "isVip": false,
            "isSvip": false,
            "vipLabel": "无VIP",
        })),
    }
}

pub async fn handle_login_cookie(
    body: web::Json<serde_json::Value>,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let raw = body.get("cookie")
        .or_else(|| body.get("data"))
        .or_else(|| body.get("text"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Save cookie to memory and persist to disk
    {
        let mut state_cookie = state.netease_cookie.write().await;
        *state_cookie = raw.to_string();
        cookie_store::save_netease_cookie(&state, raw);
    }

    // Verify login
    let cookie = state.netease_cookie.read().await.clone();
    match netease_login::login_status(&cookie).await {
        Ok(resp) => {
            let mut result = resp.body.clone();
            enrich_login_body(&mut result);
            result["saved"] = serde_json::json!(true);
            result["hasCookie"] = serde_json::json!(!cookie.is_empty());
            let is_logged_in = result.get("loggedIn").and_then(|v| v.as_bool()).unwrap_or(false);
            info!("[login/cookie] verification: loggedIn={}", is_logged_in);
            if !is_logged_in {
                // Cookie was saved but is not valid (e.g. expired or server-side invalidated)
                return HttpResponse::Ok().json(serde_json::json!({
                    "loggedIn": false,
                    "saved": true,
                    "hasCookie": !cookie.is_empty(),
                    "message": "网易云会话已失效，请重新登录",
                }));
            }
            HttpResponse::Ok().json(result)
        }
        Err(e) => {
            info!("[login/cookie] verification failed: {}", e);
            HttpResponse::Ok().json(serde_json::json!({
                "loggedIn": false,
                "error": "cookie verification failed",
                "saved": true,
                "hasCookie": !cookie.is_empty(),
            }))
        }
    }
}

pub async fn handle_logout(
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let cookie = state.netease_cookie.read().await.clone();
    let _ = netease_login::logout(&cookie).await;
    {
        let mut state_cookie = state.netease_cookie.write().await;
        *state_cookie = String::new();
        cookie_store::save_netease_cookie(&state, "");
    }
    HttpResponse::Ok().json(serde_json::json!({"ok": true}))
}

// ── QQ Music login routes ────────────────────────────────────────────────────

/// POST /api/qq/login/cookie
/// Accepts a QQ cookie string from the frontend (webview capture or manual import),
/// saves it to AppState and disk, then verifies via QQ profile API.
pub async fn handle_qq_login_cookie(
    body: web::Json<serde_json::Value>,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let raw = body.get("cookie")
        .or_else(|| body.get("data"))
        .or_else(|| body.get("text"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let normalized = qq::normalize_qq_cookie_input(raw);
    let obj = qq::parse_cookie_string(&normalized);
    let uin = qq::qq_cookie_uin(&obj);
    let music_key = qq::qq_cookie_music_key(&obj);

    if uin.is_empty() || music_key.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "provider": "qq",
            "loggedIn": false,
            "error": "INVALID_QQ_COOKIE",
            "message": "QQ cookie 缺少 uin 或有效登录票据"
        }));
    }

    // Save cookie to memory and persist to disk
    {
        let mut state_cookie = state.qq_cookie.write().await;
        *state_cookie = normalized.clone();
    }
    cookie_store::save_qq_cookie(&state, &normalized);
    info!("[qq/login/cookie] Saved QQ cookie (uin={}, {} chars)", uin, normalized.len());

    // Verify by fetching QQ profile
    let cookie = state.qq_cookie.read().await.clone();
    let mut info = qq::get_qq_login_info(&cookie).await;
    info["saved"] = serde_json::json!(true);
    HttpResponse::Ok().json(info)
}

/// GET /api/qq/login/status
/// Returns the current QQ login status based on the stored cookie.
pub async fn handle_qq_login_status(
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let cookie = state.qq_cookie.read().await.clone();
    if cookie.is_empty() {
        return HttpResponse::Ok().json(serde_json::json!({
            "provider": "qq",
            "loggedIn": false,
            "nickname": "",
            "avatar": "",
            "hasCookie": false
        }));
    }
    let info = qq::get_qq_login_info(&cookie).await;
    HttpResponse::Ok().json(info)
}

/// GET /api/qq/logout
/// Clears the QQ login cookie from memory and disk.
pub async fn handle_qq_logout(
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    {
        let mut state_cookie = state.qq_cookie.write().await;
        *state_cookie = String::new();
    }
    cookie_store::save_qq_cookie(&state, "");
    info!("[qq/logout] QQ cookie cleared");
    HttpResponse::Ok().json(serde_json::json!({
        "provider": "qq", "ok": true, "loggedIn": false
    }))
}

/// GET /api/qq/user/playlists
/// Fetches the user's QQ Music playlists (created + collected).
pub async fn handle_qq_user_playlists(
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let cookie = state.qq_cookie.read().await.clone();
    log::info!("[qq/user/playlists] cookie length = {}", cookie.len());
    if cookie.is_empty() {
        return HttpResponse::Ok().json(serde_json::json!({
            "provider": "qq", "loggedIn": false, "playlists": []
        }));
    }
    let result = qq::fetch_qq_user_playlists(&cookie).await;
    HttpResponse::Ok().json(result)
}
