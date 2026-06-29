//! QQ Music API helpers — cookie parsing and profile retrieval.
//!
//! Ported from server.js QQ cookie utilities (qqCookieObject, qqCookieUin, etc.)

use log::{info, warn};
use std::collections::HashMap;

const QQ_PROFILE_URL: &str = "https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg";
const QQ_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/// Cookie names used to identify QQ login session keys.
const QQ_KEY_COOKIE_NAMES: &[&str] = &[
    "qm_keyst", "qqmusic_key", "music_key",
    "p_skey", "skey",
    "psrf_qqaccess_token", "psrf_qqrefresh_token",
    "wxrefresh_token", "wxskey",
];
const QQ_PLAYBACK_KEY_NAMES: &[&str] = &[
    "qm_keyst", "qqmusic_key", "music_key", "wxskey",
];

// ─── Cookie helpers ─────────────────────────────────────────────────────────

/// Parse a cookie header string into key→value pairs.
pub fn parse_cookie_string(cookie: &str) -> HashMap<String, String> {
    cookie
        .split(';')
        .filter_map(|part| {
            let part = part.trim();
            if part.is_empty() { return None; }
            let mut split = part.splitn(2, '=');
            let key = split.next()?.trim().to_string();
            let val = split.next().unwrap_or("").trim().to_string();
            if key.is_empty() { None } else { Some((key, val)) }
        })
        .collect()
}

/// Serialize a cookie map back to a header string.
pub fn serialize_cookie_map(map: &HashMap<String, String>) -> String {
    map.iter()
        .filter(|(_, v)| !v.is_empty())
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("; ")
}

/// Strip non-digits and leading zeros from a raw UIN value.
fn normalize_qq_uin(raw: &str) -> String {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    let stripped = digits.trim_start_matches('0');
    if stripped.is_empty() { digits } else { stripped.to_string() }
}

/// Extract UIN from a parsed cookie map.
pub fn qq_cookie_uin(obj: &HashMap<String, String>) -> String {
    let login_type = obj.get("login_type").and_then(|v| v.parse::<u8>().ok()).unwrap_or(0);
    let raw = if login_type == 2 {
        obj.get("wxuin")
            .or_else(|| obj.get("uin"))
            .or_else(|| obj.get("p_uin"))
    } else {
        obj.get("uin")
            .or_else(|| obj.get("qqmusic_uin"))
            .or_else(|| obj.get("wxuin"))
            .or_else(|| obj.get("p_uin"))
    };
    normalize_qq_uin(raw.map(|s| s.as_str()).unwrap_or(""))
}

/// Extract music session key from a parsed cookie map.
pub fn qq_cookie_music_key(obj: &HashMap<String, String>) -> String {
    for name in QQ_KEY_COOKIE_NAMES {
        if let Some(val) = obj.get(*name) {
            if !val.is_empty() { return val.clone(); }
        }
    }
    String::new()
}

/// Extract playback key from a parsed cookie map.
pub fn qq_cookie_playback_key(obj: &HashMap<String, String>) -> String {
    for name in QQ_PLAYBACK_KEY_NAMES {
        if let Some(val) = obj.get(*name) {
            if !val.is_empty() { return val.clone(); }
        }
    }
    String::new()
}

/// Decode a URL-encoded cookie value (best-effort).
fn decode_cookie_value(value: &str) -> String {
    urlencoding::decode(&value.replace('+', "%20"))
        .unwrap_or_else(|_| value.into())
        .into_owned()
        .trim()
        .to_string()
}

/// Extract nickname from QQ cookie map.
pub fn qq_cookie_nickname(obj: &HashMap<String, String>, uin: &str) -> String {
    let padded = if uin.is_empty() { String::new() } else { format!("0{}", uin) };
    let mut keys: Vec<String> = Vec::with_capacity(8);
    if !uin.is_empty() { keys.push(format!("ptnick_{}", uin)); }
    if !padded.is_empty() { keys.push(format!("ptnick_{}", padded)); }
    keys.push("ptnick".into());
    keys.push("nick".into());
    keys.push("nickname".into());
    keys.push("qq_nickname".into());

    for key in &keys {
        let k: &str = key;
        if let Some(val) = obj.get(k) {
            let nick = decode_cookie_value(val);
            if !nick.is_empty() { return nick; }
        }
    }
    // Fallback: scan for any ptnick_* key
    for (k, v) in obj.iter() {
        if k.to_lowercase().starts_with("ptnick_") && !v.is_empty() {
            return decode_cookie_value(v);
        }
    }
    String::new()
}

/// Extract avatar URL from QQ cookie map.
pub fn qq_cookie_avatar(obj: &HashMap<String, String>, uin: &str) -> String {
    for key in &["qqmusic_avatar", "avatar", "avatarUrl", "headpic"] {
        if let Some(val) = obj.get(*key) {
            if !val.is_empty() { return decode_cookie_value(val); }
        }
    }
    if !uin.is_empty() {
        return format!("https://q1.qlogo.cn/g?b=qq&nk={}&s=100", urlencoding::encode(uin));
    }
    String::new()
}

/// Normalize a raw cookie input string (from frontend or manual import).
/// Ensures `uin` field is present and properly normalized.
pub fn normalize_qq_cookie_input(raw: &str) -> String {
    let mut obj = parse_cookie_string(raw);
    let login_type = obj.get("login_type").and_then(|v| v.parse::<u8>().ok()).unwrap_or(0);
    if login_type == 2 {
        if let Some(wxuin) = obj.get("wxuin").cloned() {
            if !obj.contains_key("uin") {
                obj.insert("uin".to_string(), wxuin);
            }
        }
    }
    if !obj.contains_key("uin") {
        if let Some(alt) = obj.get("qqmusic_uin").or_else(|| obj.get("p_uin")).cloned() {
            obj.insert("uin".to_string(), alt);
        }
    }
    if let Some(uin) = obj.get("uin").cloned() {
        obj.insert("uin".to_string(), normalize_qq_uin(&uin));
    }
    serialize_cookie_map(&obj)
}

// ─── Profile API ─────────────────────────────────────────────────────────────

/// Build the login info JSON response from a QQ cookie.
/// If the cookie is valid, fetches the QQ profile and enriches the response.
pub async fn get_qq_login_info(cookie: &str) -> serde_json::Value {
    let obj = parse_cookie_string(cookie);
    let uin = qq_cookie_uin(&obj);
    let music_key = qq_cookie_music_key(&obj);
    let has_cookie = !cookie.trim().is_empty();

    if uin.is_empty() || music_key.is_empty() {
        return serde_json::json!({
            "provider": "qq",
            "loggedIn": false,
            "hasCookie": has_cookie
        });
    }

    // Build fallback info from cookie alone
    let fallback = build_qq_profile_json(&obj, &uin, cookie, None);

    // Try to fetch QQ profile for enrichment
    match fetch_qq_profile(&uin, cookie).await {
        Ok(body) => {
            let code = body.get("code").and_then(|c| c.as_u64()).unwrap_or(0);
            if code == 1000 || body.get("result").and_then(|v| v.as_u64()) == Some(301) {
                // Session expired / redirect — return fallback with flag
                let mut info = fallback;
                info["profileUnavailable"] = serde_json::json!(true);
                return info;
            }
            let mut info = build_qq_profile_json(&obj, &uin, cookie, Some(&body));
            info["profileSource"] = serde_json::json!("qq-profile");
            info
        }
        Err(e) => {
            warn!("[QQ] profile fetch failed: {}", e);
            let mut info = fallback;
            info["profileUnavailable"] = serde_json::json!(true);
            info
        }
    }
}

/// Build a normalized profile JSON from cookie + optional API body.
fn build_qq_profile_json(
    obj: &HashMap<String, String>,
    uin: &str,
    cookie: &str,
    body: Option<&serde_json::Value>,
) -> serde_json::Value {
    let music_key = qq_cookie_music_key(obj);
    let playback_key = qq_cookie_playback_key(obj);
    let cookie_nick = qq_cookie_nickname(obj, uin);
    let cookie_avatar = qq_cookie_avatar(obj, uin);

    // Extract profile fields from API response if available
    let (profile_nick, profile_avatar, profile_vip) = if let Some(b) = body {
        let data = b.get("data").or_else(|| b.get("profile")).or_else(|| b.get("result")).unwrap_or(&serde_json::Value::Null);
        let creator = data.get("creator").or_else(|| data.get("user")).or_else(|| data.get("profile")).unwrap_or(data);
        let nick = creator.get("nick").or_else(|| creator.get("nickname")).or_else(|| creator.get("name"))
            .and_then(|v| v.as_str()).unwrap_or("");
        let avatar = creator.get("headpic").or_else(|| creator.get("avatar")).or_else(|| creator.get("avatarUrl"))
            .and_then(|v| v.as_str()).unwrap_or("");
        let vip_info = data.get("vipInfo").or_else(|| data.get("vipinfo")).or_else(|| creator.get("vipInfo"));
        let vip = vip_info.and_then(|v| v.get("vipType").or_else(|| v.get("vip_type")))
            .and_then(|v| v.as_u64()).unwrap_or(0);
        (nick.to_string(), avatar.to_string(), vip)
    } else {
        (String::new(), String::new(), 0u64)
    };

    let has_profile_nick = !profile_nick.is_empty();
    let has_profile_avatar = !profile_avatar.is_empty();
    let nick = if has_profile_nick { profile_nick } else { cookie_nick };
    let avatar = if has_profile_avatar { profile_avatar } else { cookie_avatar };
    let vip_type = if profile_vip > 0 { profile_vip } else {
        obj.get("vipType").or_else(|| obj.get("vip_type"))
            .and_then(|v| v.parse::<u64>().ok()).unwrap_or(0)
    };

    let has_nick = !nick.is_empty();
    let has_avatar = !avatar.is_empty();
    let final_nickname = if has_nick { nick } else if !uin.is_empty() { format!("QQ {}", uin) } else { "QQ 音乐".to_string() };
    let profile_source = if has_profile_nick || has_profile_avatar {
        "qq-profile"
    } else if has_nick || has_avatar {
        "cookie"
    } else {
        "fallback"
    };

    serde_json::json!({
        "provider": "qq",
        "loggedIn": !uin.is_empty() && !music_key.is_empty(),
        "preview": false,
        "userId": uin,
        "nickname": final_nickname,
        "avatar": avatar,
        "vipType": vip_type,
        "hasCookie": !cookie.trim().is_empty(),
        "playbackKeyReady": !playback_key.is_empty(),
        "profileSource": profile_source,
    })
}

/// Fetch QQ Music user profile from c.y.qq.com.
async fn fetch_qq_profile(uin: &str, cookie: &str) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    let params = [
        ("cid", "205360838"),
        ("userid", uin),
        ("reqfrom", "1"),
        ("g_tk", "5381"),
        ("loginUin", uin),
        ("hostUin", "0"),
        ("format", "json"),
        ("inCharset", "utf8"),
        ("outCharset", "utf-8"),
        ("notice", "0"),
        ("platform", "yqq.json"),
        ("needNewCode", "0"),
    ];

    let url = format!("{}?{}", QQ_PROFILE_URL,
        params.iter().map(|(k, v)| format!("{}={}", k, v)).collect::<Vec<_>>().join("&"));

    let resp = client.get(&url)
        .header("User-Agent", QQ_UA)
        .header("Referer", "https://y.qq.com/")
        .header("Cookie", cookie)
        .send()
        .await
        .map_err(|e| format!("QQ profile request failed: {}", e))?;

    let text = resp.text().await.map_err(|e| e.to_string())?;
    info!("[QQ] profile response ({} bytes)", text.len());

    serde_json::from_str(&text).map_err(|e| format!("QQ profile JSON parse failed: {}", e))
}

// ─── QQ API helpers ────────────────────────────────────────────────────────

/// Make a GET request to a QQ Music API endpoint with proper headers.
async fn qq_get_json(url: &str, cookie: &str, referer: &str) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    let text = client.get(url)
        .header("User-Agent", QQ_UA)
        .header("Referer", referer)
        .header("Cookie", cookie)
        .send()
        .await
        .map_err(|e| format!("QQ request failed: {}", e))?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    // Strip JSONP callback wrapper:  callback({...});  ->  {...}
    let cleaned = text.trim();
    let json_str = strip_jsonp(cleaned);
    serde_json::from_str(json_str).map_err(|e| format!("QQ JSON parse failed: {} (first 80 chars: {})", e, &json_str[..json_str.len().min(80)]))
}

/// Strip JSONP wrapper from QQ Music API responses.
/// Handles:  callback({...});  or  anyFuncName({...})  patterns.
fn strip_jsonp(text: &str) -> &str {
    // Match pattern:  identifier(...)  with optional trailing semicolon
    let s = text.trim_end_matches(';').trim();
    if let Some(paren_start) = s.find('(') {
        // Verify the prefix is a valid identifier (all chars before '(' are alphanumeric/underscore)
        let prefix = &s[..paren_start];
        if !prefix.is_empty() && prefix.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '$') {
            // Verify it ends with ')'
            if s.ends_with(')') {
                return &s[paren_start + 1..s.len() - 1];
            }
        }
    }
    s
}

/// Extract a string from a JSON value, accepting both String and Number types.
fn json_val_as_str(v: &serde_json::Value) -> Option<String> {
    if let Some(s) = v.as_str() {
        if !s.is_empty() { return Some(s.to_string()); }
    }
    if let Some(n) = v.as_u64() {
        return Some(n.to_string());
    }
    if let Some(n) = v.as_i64() {
        if n != 0 { return Some(n.to_string()); }
    }
    None
}

/// Extract a string ID from a JSON value (handles both String and Number types).
fn json_value_as_id(v: &serde_json::Value) -> Option<String> {
    if let Some(s) = v.as_str() {
        if !s.is_empty() { return Some(s.to_string()); }
    }
    if let Some(n) = v.as_u64() {
        if n != 0 { return Some(n.to_string()); }
    }
    if let Some(n) = v.as_i64() {
        if n != 0 { return Some(n.to_string()); }
    }
    None
}

/// Map a raw QQ playlist JSON object to the frontend format.
fn map_qq_playlist(pl: &serde_json::Value, subscribed: bool) -> serde_json::Value {
    let id = ["dissid", "tid", "dirid", "id", "diss_id"].iter()
        .filter_map(|k| pl.get(*k))
        .find_map(|v| json_value_as_id(v))
        .unwrap_or_default();

    let name = pl.get("diss_name").or_else(|| pl.get("name")).or_else(|| pl.get("title"))
        .and_then(|v| v.as_str()).unwrap_or("");
    let cover = pl.get("diss_cover").or_else(|| pl.get("logo")).or_else(|| pl.get("picurl")).or_else(|| pl.get("cover"))
        .and_then(|v| v.as_str()).unwrap_or("");
    let track_count = pl.get("song_cnt").or_else(|| pl.get("songnum")).or_else(|| pl.get("total_song_num"))
        .or_else(|| pl.get("song_count"))
        .and_then(|v| v.as_u64()).unwrap_or(0);
    let play_count = pl.get("listen_num").or_else(|| pl.get("visitnum")).or_else(|| pl.get("play_count"))
        .and_then(|v| v.as_u64()).unwrap_or(0);
    let creator = pl.get("hostname").or_else(|| pl.get("nick")).or_else(|| pl.get("creator"))
        .and_then(|v| v.as_str()).unwrap_or("QQ 音乐");

    serde_json::json!({
        "provider": "qq",
        "source": "qq",
        "id": id,
        "name": name,
        "cover": cover,
        "trackCount": track_count,
        "playCount": play_count,
        "creator": creator,
        "subscribed": subscribed,
        "specialType": 0,
    })
}

/// Check if a playlist name matches QZone background music patterns.
fn is_qzone_background_playlist(pl: &serde_json::Value) -> bool {
    let text = format!("{} {}",
        pl.get("name").and_then(|v| v.as_str()).unwrap_or(""),
        pl.get("creator").and_then(|v| v.as_str()).unwrap_or(""),
    ).to_lowercase();
    text.contains("qzone") || text.contains("空间") || text.contains("背景音乐")
}

/// Fetch user's QQ Music playlists (created + collected).
pub async fn fetch_qq_user_playlists(cookie: &str) -> serde_json::Value {
    let info = get_qq_login_info(cookie).await;
    let logged_in = info.get("loggedIn").and_then(|v| v.as_bool()).unwrap_or(false);
    let uin = info.get("userId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    info!("[QQ/playlists] loggedIn={}, uin={}", logged_in, &uin);

    if !logged_in || uin.is_empty() {
        info!("[QQ/playlists] Not logged in or empty uin, returning empty");
        return serde_json::json!({
            "provider": "qq", "loggedIn": false, "playlists": []
        });
    }

    let referer = "https://y.qq.com/portal/profile.html";

    // Fetch created playlists
    let created_url = format!(
        "https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss?hostUin=0&hostuin={}&sin=0&size=200&g_tk=5381&loginUin={}&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0",
        uin, uin
    );
    // Fetch collected playlists
    let collect_url = format!(
        "https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg?ct=20&cid=205360956&userid={}&reqtype=3&sin=0&ein=80",
        uin
    );

    let (created_result, collect_result) = tokio::join!(
        qq_get_json(&created_url, cookie, referer),
        qq_get_json(&collect_url, cookie, referer),
    );

    let mut all_playlists: Vec<serde_json::Value> = Vec::new();
    let mut seen_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Process created playlists
    match created_result {
        Ok(created) => {
            let code = created.get("code").and_then(|c| c.as_i64()).unwrap_or(-1);
            let subcode = created.get("data").and_then(|d| d.get("code")).and_then(|c| c.as_i64()).unwrap_or(-1);
            info!("[QQ/playlists] created response code={}, data.code={}", code, subcode);
            if let Some(disslist) = created.get("data").and_then(|d| d.get("disslist")).and_then(|d| d.as_array()) {
                info!("[QQ/playlists] found {} created playlists", disslist.len());
                for pl in disslist {
                    let mapped = map_qq_playlist(pl, false);
                    let id = mapped.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    if !id.is_empty() && !mapped.get("name").and_then(|v| v.as_str()).unwrap_or("").is_empty()
                        && !seen_ids.contains(&id) && !is_qzone_background_playlist(&mapped)
                    {
                        seen_ids.insert(id);
                        all_playlists.push(mapped);
                    }
                }
            } else {
                info!("[QQ/playlists] no data.disslist found, raw keys: {:?}",
                    created.as_object().map(|o| o.keys().collect::<Vec<_>>()));
            }
        }
        Err(e) => {
            info!("[QQ/playlists] created playlists request failed: {}", e);
        }
    }

    // Process collected playlists
    match collect_result {
        Ok(collected) => {
            let code = collected.get("code").and_then(|c| c.as_i64()).unwrap_or(-1);
            info!("[QQ/playlists] collected response code={}", code);
            if let Some(cdlist) = collected.get("data").and_then(|d| d.get("cdlist")).and_then(|d| d.as_array()) {
                info!("[QQ/playlists] found {} collected playlists", cdlist.len());
                for pl in cdlist {
                    let mapped = map_qq_playlist(pl, true);
                    let id = mapped.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    if !id.is_empty() && !mapped.get("name").and_then(|v| v.as_str()).unwrap_or("").is_empty()
                        && !seen_ids.contains(&id) && !is_qzone_background_playlist(&mapped)
                    {
                        seen_ids.insert(id);
                        all_playlists.push(mapped);
                    }
                }
            } else {
                info!("[QQ/playlists] no data.cdlist found, raw keys: {:?}",
                    collected.as_object().map(|o| o.keys().collect::<Vec<_>>()));
            }
        }
        Err(e) => {
            info!("[QQ/playlists] collected playlists request failed: {}", e);
        }
    }

    // Sort: favorite playlists first
    all_playlists.sort_by(|a, b| {
        let a_fav = is_favorite_playlist(a);
        let b_fav = is_favorite_playlist(b);
        b_fav.cmp(&a_fav)
    });

    serde_json::json!({
        "provider": "qq",
        "loggedIn": true,
        "userId": uin,
        "playlists": all_playlists,
    })
}

/// Check if a playlist name matches favorite patterns.
fn is_favorite_playlist(pl: &serde_json::Value) -> bool {
    let name = pl.get("name").and_then(|v| v.as_str()).unwrap_or("");
    name.contains("我喜欢") || name.contains("我的喜欢") || name.contains("喜欢的音乐")
}

// ─── QQ Music API ─────────────────────────────────────────────────────────

const QQ_MUSICU_URL: &str = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const QQ_SMARTBOX_URL: &str = "https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg";

/// QQ quality candidate templates.
struct QualityCandidate { prefix: &'static str, ext: &'static str, level: &'static str, label: &'static str }
const QQ_QUALITY_TEMPLATES: &[QualityCandidate] = &[
    QualityCandidate { prefix: "RS01", ext: ".flac", level: "hires", label: "Hi-Res FLAC" },
    QualityCandidate { prefix: "F000", ext: ".flac", level: "lossless", label: "无损 FLAC" },
    QualityCandidate { prefix: "M800", ext: ".mp3", level: "exhigh", label: "320k MP3" },
    QualityCandidate { prefix: "M500", ext: ".mp3", level: "standard", label: "128k MP3" },
    QualityCandidate { prefix: "C400", ext: ".m4a", level: "aac", label: "AAC/M4A" },
];

fn normalize_quality(raw: &str) -> &'static str {
    let r = raw.to_lowercase();
    if ["jymaster","master","studio","svip"].contains(&r.as_str()) { "jymaster" }
    else if ["hires","hi-res","highres","zhenyin","spatial"].contains(&r.as_str()) { "hires" }
    else if ["lossless","flac","sq"].contains(&r.as_str()) { "lossless" }
    else if ["exhigh","high","320","320k","hq"].contains(&r.as_str()) { "exhigh" }
    else if ["standard","normal","128","128k","std"].contains(&r.as_str()) { "standard" }
    else { "hires" }
}

fn quality_candidates(target: &str) -> &'static [QualityCandidate] {
    let norm = normalize_quality(target);
    let start = QQ_QUALITY_TEMPLATES.iter().position(|c| c.level == norm).unwrap_or(0);
    &QQ_QUALITY_TEMPLATES[start..]
}

/// POST to QQ MUSICU API.
async fn qq_music_request(payload: &serde_json::Value, cookie: &str) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder().build().map_err(|e| e.to_string())?;
    let body_str = serde_json::to_string(payload).map_err(|e| e.to_string())?;
    let mut req = client.post(QQ_MUSICU_URL)
        .header("User-Agent", QQ_UA)
        .header("Referer", "https://y.qq.com/")
        .header("Content-Type", "application/json;charset=UTF-8")
        .body(body_str);
    if !cookie.is_empty() {
        req = req.header("Cookie", cookie);
    }
    let text = req.send().await.map_err(|e| format!("MUSICU request failed: {}", e))?
        .text().await.map_err(|e| e.to_string())?;
    let json_str = strip_jsonp(text.trim());
    serde_json::from_str(json_str).map_err(|e| format!("MUSICU JSON parse failed: {}", e))
}

/// Album cover URL from album mid.
fn qq_album_cover(album_mid: &str, size: u32) -> String {
    if album_mid.is_empty() { return String::new(); }
    format!("https://y.qq.com/music/photo_new/T002R{}x{}M000{}.jpg?max_age=2592000", size, size, album_mid)
}

/// Singer avatar URL from singer mid.
fn qq_singer_avatar(singer_mid: &str, size: u32) -> String {
    if singer_mid.is_empty() { return String::new(); }
    format!("https://y.qq.com/music/photo_new/T001R{}x{}M000{}.jpg?max_age=2592000", size, size, singer_mid)
}

/// Map QQ artist array.
fn map_qq_artists(raw: &[serde_json::Value]) -> Vec<serde_json::Value> {
    raw.iter().filter_map(|a| {
        let name = a.get("name").or_else(|| a.get("title")).and_then(|v| v.as_str()).unwrap_or("");
        if name.is_empty() { return None; }
        Some(serde_json::json!({
            "id": a.get("id").and_then(|v| v.as_u64()),
            "mid": a.get("mid").and_then(|v| json_val_as_str(v)),
            "name": name,
        }))
    }).collect()
}

/// Map a QQ track object to frontend format.
fn map_qq_track(track: &serde_json::Value, fallback_name: &str, fallback_mid: &str) -> serde_json::Value {
    let album = track.get("album").unwrap_or(&serde_json::Value::Null);
    let artists_raw = track.get("singer").and_then(|v| v.as_array()).map(|a| a.as_slice()).unwrap_or(&[]);
    let artists = map_qq_artists(artists_raw);
    let mid = track.get("mid").and_then(json_val_as_str).unwrap_or_else(|| fallback_mid.to_string());
    let album_mid = album.get("mid").or_else(|| album.get("pmid")).and_then(|v| v.as_str()).unwrap_or("").to_string();
    let media_mid = track.get("file").and_then(|f| f.get("media_mid")).and_then(|v| v.as_str()).unwrap_or("").to_string();
    let name = track.get("name").or_else(|| track.get("title")).and_then(|v| v.as_str()).unwrap_or(fallback_name);
    let artist_str = artists.iter().filter_map(|a| a.get("name").and_then(|v| v.as_str())).collect::<Vec<_>>().join(" / ");
    let duration = track.get("interval").and_then(|v| v.as_u64()).unwrap_or(0) * 1000;
    let fee = track.get("pay").and_then(|p| p.get("pay_play")).and_then(|v| v.as_u64()).map(|v| if v > 0 { 1 } else { 0 }).unwrap_or(0);

    serde_json::json!({
        "provider": "qq", "source": "qq", "type": "qq",
        "id": &mid, "qqId": track.get("id").and_then(|v| v.as_u64()),
        "mid": &mid, "songmid": &mid, "mediaMid": &media_mid,
        "name": name,
        "artist": if artist_str.is_empty() { fallback_name } else { &artist_str },
        "artists": artists,
        "artistId": artists.first().and_then(|a| a.get("id")),
        "artistMid": artists.first().and_then(|a| json_val_as_str(a.get("mid").unwrap_or(&serde_json::Value::Null))),
        "album": album.get("name").or_else(|| album.get("title")).and_then(|v| v.as_str()).unwrap_or(""),
        "albumMid": &album_mid,
        "cover": qq_album_cover(&album_mid, 300),
        "duration": duration,
        "fee": fee,
        "playable": false,
    })
}

/// Smartbox quick search.
async fn smartbox_search(keywords: &str, limit: usize, cookie: &str) -> Result<Vec<serde_json::Value>, String> {
    let url = format!("{}?format=json&key={}&g_tk=5381&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0",
        QQ_SMARTBOX_URL, urlencoding::encode(keywords));
    let body = qq_get_json(&url, cookie, "https://y.qq.com/").await?;
    let items = body.get("data").and_then(|d| d.get("song")).and_then(|s| s.get("itemlist"))
        .and_then(|v| v.as_array());
    let items = items.map(|a| &a[..]).unwrap_or(&[]);
    let limit = limit.min(10).max(1);
    Ok(items[..items.len().min(limit)].iter().map(|item| {
        let mid = item.get("mid").or_else(|| item.get("songmid")).or_else(|| item.get("id"))
            .and_then(|v| json_val_as_str(v)).unwrap_or_default();
        serde_json::json!({
            "provider": "qq", "source": "qq", "type": "qq",
            "id": &mid, "qqId": item.get("id").and_then(|v| v.as_u64()), "mid": &mid, "songmid": &mid,
            "name": item.get("name").or_else(|| item.get("title")).and_then(|v| v.as_str()).unwrap_or(""),
            "artist": item.get("singer").and_then(|v| v.as_str()).unwrap_or(""),
            "artists": [], "album": "", "cover": "", "duration": 0, "fee": 0, "playable": false,
        })
    }).collect())
}

/// Get song detail by mid.
async fn qq_song_detail(mid: &str, cookie: &str) -> Result<serde_json::Value, String> {
    let payload = serde_json::json!({
        "comm": { "ct": 24, "cv": 0 },
        "songinfo": {
            "module": "music.pf_song_detail_svr",
            "method": "get_song_detail_yqq",
            "param": { "song_mid": mid }
        }
    });
    let json = qq_music_request(&payload, cookie).await?;
    let data = json.get("songinfo").and_then(|s| s.get("data")).cloned().unwrap_or_default();
    let track = data.get("track_info").unwrap_or(&serde_json::Value::Null);
    Ok(map_qq_track(track, mid, mid))
}

/// Decode HTML entities in lyric text.
fn decode_html_entities(text: &str) -> String {
    text.replace("&#39;", "'").replace("&quot;", "\"").replace("&apos;", "'")
        .replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&").replace("&nbsp;", " ")
}

/// Decode QQ lyric text (may be base64 encoded).
fn decode_qq_lyric(text: &str) -> String {
    let raw = decode_html_entities(text.trim());
    if raw.is_empty() { return String::new(); }
    let compact: String = raw.chars().filter(|c| !c.is_whitespace()).collect();
    let is_base64 = compact.len() >= 8 && compact.len() % 4 == 0
        && compact.chars().all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=');
    if is_base64 && !raw.trim_start().starts_with('[') {
        if let Ok(decoded) = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &compact) {
            if let Ok(s) = String::from_utf8(decoded) {
                let s = s.trim_start_matches('\u{FEFF}');
                if s.contains('[') || s.chars().any(|c| ('\u{4e00}'..='\u{9fa5}').contains(&c)) {
                    return decode_html_entities(&s.replace("\r\n", "\n")).trim().to_string();
                }
            }
        }
    }
    decode_html_entities(&raw.replace("\r\n", "\n")).trim().to_string()
}

// ─── Public API functions ──────────────────────────────────────────────────

/// Search QQ Music.
pub async fn search(keywords: &str, limit: usize, cookie: &str) -> Result<Vec<serde_json::Value>, String> {
    let base = smartbox_search(keywords, limit, cookie).await?;
    let mut results = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for item in base {
        let mid = item.get("mid").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let detailed = if !mid.is_empty() {
            qq_song_detail(&mid, cookie).await.unwrap_or(item)
        } else { item };
        let key = detailed.get("mid").or_else(|| detailed.get("id")).and_then(|v| v.as_str())
            .unwrap_or("").to_string();
        let name = detailed.get("name").and_then(|v| v.as_str()).unwrap_or("");
        if key.is_empty() || name.is_empty() || seen.contains(&key) { continue; }
        seen.insert(key);
        results.push(detailed);
    }
    Ok(results)
}

/// Classify QQ playback restriction (mirrors classifyQQPlaybackRestriction in server.js).
fn classify_qq_playback_restriction(code: i64, raw_msg: &str, has_session: bool, has_playback_key: bool) -> serde_json::Value {
    let lower = raw_msg.to_lowercase();
    let (category, message, action) = if !has_session {
        ("login_required", "QQ 音乐需要登录或授权后才能获取播放地址", "login")
    } else if !has_playback_key && code == 104003 {
        ("login_required", "QQ 音乐当前只拿到了网页登录状态，还缺少播放授权，请重新打开官方 QQ 音乐登录窗口完成授权", "login")
    } else if code == 104003 {
        ("copyright_unavailable", "QQ 音乐没有给当前版本返回播放地址，通常是版权、会员或官方版本限制，可以换一个搜索结果或切到网易云源", "switch_source")
    } else if lower.contains("vip") || lower.contains("会员") || lower.contains("付费") || lower.contains("购买") || lower.contains("数字专辑") || lower.contains("pay") {
        ("paid_required", "QQ 音乐歌曲需要会员、购买或数字专辑权限", "upgrade")
    } else if code != 0 {
        ("copyright_unavailable", if raw_msg.is_empty() { "QQ 音乐版权暂不可播或仅官方客户端可播" } else { raw_msg }, "switch_source")
    } else {
        ("url_unavailable", "QQ 音乐没有返回播放地址，可能受版权、会员或官方客户端限制", "switch_source")
    };
    serde_json::json!({
        "provider": "qq", "category": category, "action": action, "message": message,
        "code": code, "rawMessage": raw_msg,
    })
}

/// Get QQ song playback URL.
pub async fn get_song_url(mid: &str, media_mid: &str, quality: &str, cookie: &str) -> serde_json::Value {
    let songmid = mid.trim();
    if songmid.is_empty() {
        return serde_json::json!({ "provider": "qq", "url": "", "error": "MISSING_MID", "message": "Missing QQ song mid" });
    }
    let guid = format!("{}", 10000000u64 + (rand::random::<u64>() % 90000000));
    let obj = parse_cookie_string(cookie);
    let uin = qq_cookie_uin(&obj);
    let uin_str = if uin.is_empty() { "0".to_string() } else { uin.clone() };
    let music_key = qq_cookie_music_key(&obj);
    let playback_key = qq_cookie_playback_key(&obj);
    let file_media_mid = media_mid.trim();
    let mut media_ids: Vec<&str> = vec![];
    if !file_media_mid.is_empty() { media_ids.push(file_media_mid); }
    if !songmid.is_empty() && !media_ids.contains(&songmid) { media_ids.push(songmid); }
    let candidates = quality_candidates(quality);
    let file_candidates: Vec<(String, &QualityCandidate)> = media_ids.iter().flat_map(|mid| {
        candidates.iter().map(move |c| (format!("{}{}{}", c.prefix, mid, c.ext), c))
    }).collect();
    let filenames: Vec<String> = file_candidates.iter().map(|(f, _)| f.clone()).collect();
    let songmid_list: Vec<&str> = if filenames.is_empty() { vec![songmid] } else { filenames.iter().map(|_| songmid).collect() };
    let songtype_list: Vec<u8> = songmid_list.iter().map(|_| 0).collect();

    let mut param = serde_json::json!({
        "guid": guid, "songmid": songmid_list, "songtype": songtype_list,
        "uin": uin_str, "loginflag": 1, "platform": "20"
    });
    if !filenames.is_empty() { param["filename"] = serde_json::json!(filenames); }

    let mut comm = serde_json::json!({ "uin": uin_str, "format": "json", "ct": if music_key.is_empty() { 24 } else { 19 }, "cv": 0 });
    if !music_key.is_empty() { comm["authst"] = serde_json::json!(music_key); }

    let payload = serde_json::json!({
        "comm": comm,
        "req_0": { "module": "vkey.GetVkeyServer", "method": "CgiGetVkey", "param": param }
    });

    match qq_music_request(&payload, cookie).await {
        Ok(json) => {
            let data = json.get("req_0").and_then(|r| r.get("data"));
            let infos = data.and_then(|d| d.get("midurlinfo")).and_then(|v| v.as_array());
            let infos_slice = infos.map(|a| a.as_slice()).unwrap_or(&[]);
            info!("[QQ/song_url] midurlinfo count={}, tried {} filenames", infos_slice.len(), filenames.len());
            let info = infos_slice.iter().find(|i| i.get("purl").and_then(|v| v.as_str()).map_or(false, |s| !s.is_empty()))
                .or_else(|| infos_slice.first());
            if let Some(info) = info {
                // Log detailed info about the response
                let purl = info.get("purl").and_then(|v| v.as_str()).unwrap_or("");
                let result_code = info.get("result").and_then(|v| v.as_i64()).unwrap_or(-1);
                let errtype = info.get("errtype").and_then(|v| v.as_str()).unwrap_or("");
                let msg = info.get("msg").or_else(|| info.get("tips")).or_else(|| info.get("errmsg"))
                    .and_then(|v| v.as_str()).unwrap_or("");
                let fname = info.get("filename").and_then(|v| v.as_str()).unwrap_or("");
                info!("[QQ/song_url] purl_empty={}, result={}, errtype={}, msg={}, filename={}",
                    purl.is_empty(), result_code, errtype, msg, fname);
                if !purl.is_empty() {
                    let sip = data.and_then(|d| d.get("sip")).and_then(|s| s.as_array())
                        .and_then(|a| a.first()).and_then(|v| v.as_str())
                        .unwrap_or("https://ws.stream.qqmusic.qq.com/");
                    let filename = info.get("filename").and_then(|v| v.as_str()).unwrap_or("");
                    let meta = file_candidates.iter().find(|(f, _)| f == filename);
                    return serde_json::json!({
                        "provider": "qq", "url": format!("{}{}", sip, purl),
                        "trial": false, "playable": true,
                        "level": meta.map(|(_, c)| c.level).unwrap_or(""),
                        "quality": meta.map(|(_, c)| c.label).unwrap_or(""),
                        "filename": filename,
                    });
                }
                // Return detailed error info (matches server.js)
                let has_session = !uin.is_empty() && !music_key.is_empty();
                let has_playback_key = !uin.is_empty() && !playback_key.is_empty();
                let restriction = classify_qq_playback_restriction(result_code, msg, has_session, has_playback_key);
                let reason = restriction.get("category").and_then(|v| v.as_str()).unwrap_or("").to_string();
                return serde_json::json!({
                    "provider": "qq", "url": "", "playable": false,
                    "error": "QQ_URL_UNAVAILABLE",
                    "loggedIn": has_session,
                    "playbackKeyReady": has_playback_key,
                    "qqCode": result_code,
                    "rawMessage": msg,
                    "errtype": errtype,
                    "restriction": restriction,
                    "reason": reason,
                    "message": restriction.get("message").and_then(|v| v.as_str()).unwrap_or(""),
                    "tried": file_candidates.iter().map(|(f, c)| format!("{} · {}", c.label, f)).collect::<Vec<_>>(),
                    "requestedQuality": quality,
                });
            }
            let has_session = !uin.is_empty() && !music_key.is_empty();
            let has_playback_key = !uin.is_empty() && !playback_key.is_empty();
            let restriction = classify_qq_playback_restriction(0, "", has_session, has_playback_key);
            let reason = restriction.get("category").and_then(|v| v.as_str()).unwrap_or("").to_string();
            serde_json::json!({
                "provider": "qq", "url": "", "playable": false,
                "error": "QQ_URL_UNAVAILABLE",
                "loggedIn": has_session,
                "playbackKeyReady": has_playback_key,
                "restriction": restriction,
                "reason": reason,
                "tried": file_candidates.iter().map(|(f, c)| format!("{} · {}", c.label, f)).collect::<Vec<_>>(),
            })
        }
        Err(e) => serde_json::json!({ "provider": "qq", "url": "", "playable": false, "error": e })
    }
}

/// Get QQ lyric.
pub async fn get_lyric(mid: &str, id: &str, cookie: &str) -> serde_json::Value {
    let song_mid = mid.trim();
    let song_id: u64 = id.chars().filter(|c| c.is_ascii_digit()).collect::<String>().parse().unwrap_or(0);
    if song_mid.is_empty() && song_id == 0 {
        return serde_json::json!({ "provider": "qq", "error": "Missing QQ song mid or id", "lyric": "" });
    }

    let mut lyric_text = String::new();
    let mut trans_text = String::new();
    let mut qrc_text = String::new();
    let mut roma_text = String::new();
    let mut source = "qq-musicu".to_string();

    // Try MUSICU lyric API
    let mut param = serde_json::Map::new();
    if !song_mid.is_empty() { param.insert("songMID".into(), serde_json::json!(song_mid)); }
    if song_id > 0 { param.insert("songID".into(), serde_json::json!(song_id)); }
    let payload = serde_json::json!({
        "comm": { "ct": 24, "cv": 0 },
        "lyric": { "module": "music.musichallSong.PlayLyricInfo", "method": "GetPlayLyricInfo", "param": param }
    });
    if let Ok(json) = qq_music_request(&payload, cookie).await {
        if let Some(data) = json.get("lyric").and_then(|l| l.get("data")) {
            lyric_text = data.get("lyric").and_then(|v| v.as_str()).map(decode_qq_lyric).unwrap_or_default();
            trans_text = data.get("trans").and_then(|v| v.as_str()).map(decode_qq_lyric).unwrap_or_default();
            qrc_text = data.get("qrc").and_then(|v| v.as_str()).map(decode_qq_lyric).unwrap_or_default();
            roma_text = data.get("roma").and_then(|v| v.as_str()).map(decode_qq_lyric).unwrap_or_default();
        }
    }

    // Fallback: legacy lyric API
    if lyric_text.is_empty() && !song_mid.is_empty() {
        let obj = parse_cookie_string(cookie);
        let uin = qq_cookie_uin(&obj);
        let url = format!(
            "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid={}&songtype=0&format=json&nobase64=1&g_tk=5381&loginUin={}&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0",
            song_mid, if uin.is_empty() { "0" } else { &uin }
        );
        if let Ok(body) = qq_get_json(&url, cookie, "https://y.qq.com/portal/player.html").await {
            if let Some(lyric) = body.get("lyric").and_then(|v| v.as_str()) {
                let decoded = decode_qq_lyric(lyric);
                if !decoded.is_empty() {
                    lyric_text = decoded;
                    trans_text = body.get("trans").or_else(|| body.get("tlyric"))
                        .and_then(|v| v.as_str()).map(decode_qq_lyric).unwrap_or_default();
                    source = "qq-legacy".to_string();
                }
            }
        }
    }

    serde_json::json!({
        "provider": "qq", "id": song_id, "mid": song_mid,
        "lyric": lyric_text, "tlyric": trans_text,
        "yrc": "", "qrc": qrc_text, "roma": roma_text,
        "source": if lyric_text.is_empty() { "qq-empty" } else { &source },
    })
}

/// Get QQ artist detail.
pub async fn get_artist_detail(mid: &str, limit: u32, cookie: &str) -> serde_json::Value {
    let singer_mid = mid.trim();
    if singer_mid.is_empty() {
        return serde_json::json!({ "provider": "qq", "error": "MISSING_SINGER_MID", "artist": null, "songs": [] });
    }
    let payload = serde_json::json!({
        "comm": { "ct": 24, "cv": 0 },
        "singer": {
            "module": "music.web_singer_info_svr",
            "method": "get_singer_detail_info",
            "param": { "sort": 5, "singermid": singer_mid, "sin": 0, "num": limit }
        }
    });
    match qq_music_request(&payload, cookie).await {
        Ok(json) => {
            let block = json.get("singer");
            if block.and_then(|b| b.get("code")).and_then(|v| v.as_u64()).unwrap_or(0) != 0 {
                return serde_json::json!({ "provider": "qq", "error": "QQ_ARTIST_DETAIL_FAILED", "artist": null, "songs": [] });
            }
            let data = block.and_then(|b| b.get("data")).unwrap_or(&serde_json::Value::Null);
            let info = data.get("singer_info").or_else(|| data.get("singerInfo")).unwrap_or(&serde_json::Value::Null);
            let raw_songs = data.get("songlist").and_then(|v| v.as_array()).map(|a| a.as_slice()).unwrap_or(&[]);
            let songs: Vec<serde_json::Value> = raw_songs.iter().filter_map(|raw| {
                let track = raw.get("track_info").or_else(|| raw.get("songInfo")).or_else(|| raw.get("songinfo")).unwrap_or(raw);
                let mapped = map_qq_track(track, "", "");
                let name = mapped.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let m = mapped.get("mid").and_then(|v| v.as_str()).unwrap_or("");
                if name.is_empty() || m.is_empty() { return None; }
                Some(mapped)
            }).collect();
            let artist_name = info.get("name").or_else(|| info.get("title")).and_then(|v| v.as_str()).unwrap_or("");
            let artist_mid_val = info.get("mid").and_then(|v| json_val_as_str(v)).unwrap_or_else(|| singer_mid.to_string());
            let avatar_url = info.get("pic").or_else(|| info.get("avatar")).and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| qq_singer_avatar(&artist_mid_val, 300));
            let total_song = data.get("total_song").or_else(|| data.get("song_count")).and_then(|v| v.as_u64()).unwrap_or(songs.len() as u64);
            serde_json::json!({
                "provider": "qq",
                "artist": {
                    "provider": "qq",
                    "id": info.get("id").and_then(|v| v.as_u64()),
                    "mid": artist_mid_val,
                    "name": artist_name,
                    "avatar": avatar_url,
                    "fans": info.get("fans").and_then(|v| v.as_u64()).unwrap_or(0),
                    "musicSize": total_song,
                    "albumSize": data.get("total_album").and_then(|v| v.as_u64()).unwrap_or(0),
                    "mvSize": data.get("total_mv").and_then(|v| v.as_u64()).unwrap_or(0),
                },
                "total": total_song,
                "songs": songs,
            })
        }
        Err(e) => serde_json::json!({ "provider": "qq", "error": e, "artist": null, "songs": [] })
    }
}

/// Map a QQ playlist track — handles nested track_info/songInfo wrappers.
fn map_qq_playlist_track(raw: &serde_json::Value) -> serde_json::Value {
    // Playlist items may wrap the actual track data in track_info / songInfo / song
    let has_direct_fields = raw.get("songid").is_some()
        || raw.get("songmid").is_some()
        || raw.get("mid").and_then(|v| json_val_as_str(v)).is_some()
        || raw.get("name").and_then(|v| v.as_str()).is_some();
    let track = if has_direct_fields {
        raw
    } else {
        raw.get("track_info")
            .or_else(|| raw.get("songInfo"))
            .or_else(|| raw.get("songinfo"))
            .or_else(|| raw.get("song"))
            .unwrap_or(raw)
    };
    let album = track.get("album").unwrap_or(&serde_json::Value::Null);
    let artists_raw = track.get("singer").or_else(|| track.get("singers"))
        .and_then(|v| v.as_array()).map(|a| a.as_slice()).unwrap_or(&[]);
    let artists = map_qq_artists(artists_raw);
    let mid = track.get("mid").or_else(|| track.get("songmid"))
        .or_else(|| raw.get("mid")).or_else(|| raw.get("songmid"))
        .and_then(|v| json_val_as_str(v)).unwrap_or_default();
    let album_mid = album.get("mid").or_else(|| album.get("pmid"))
        .or_else(|| track.get("albummid")).or_else(|| raw.get("albummid"))
        .and_then(|v| v.as_str()).unwrap_or("").to_string();
    let media_mid = track.get("file").and_then(|f| f.get("media_mid")).and_then(|v| v.as_str())
        .or_else(|| track.get("strMediaMid").and_then(|v| v.as_str()))
        .or_else(|| track.get("media_mid").and_then(|v| v.as_str()))
        .or_else(|| raw.get("strMediaMid").and_then(|v| v.as_str()))
        .unwrap_or("").to_string();
    let name = track.get("name").or_else(|| track.get("songname")).or_else(|| track.get("title"))
        .or_else(|| raw.get("songname"))
        .and_then(|v| v.as_str()).unwrap_or("").to_string();
    let artist_str = artists.iter().filter_map(|a| a.get("name").and_then(|v| v.as_str())).collect::<Vec<_>>().join(" / ");
    let artist_str = if artist_str.is_empty() {
        track.get("singername").or_else(|| raw.get("singername")).and_then(|v| v.as_str()).unwrap_or("").to_string()
    } else { artist_str };
    let qq_id = track.get("id").or_else(|| track.get("songid")).or_else(|| raw.get("id")).or_else(|| raw.get("songid"));
    let duration = track.get("interval").or_else(|| raw.get("interval"))
        .and_then(|v| v.as_u64()).unwrap_or(0) * 1000;
    let fee = track.get("pay").and_then(|p| p.get("pay_play")).and_then(|v| v.as_u64())
        .map(|v| if v > 0 { 1 } else { 0 }).unwrap_or(0);
    let id_str = if mid.is_empty() {
        qq_id.and_then(|v| json_val_as_str(v)).unwrap_or_default()
    } else { mid.clone() };
    serde_json::json!({
        "provider": "qq", "source": "qq", "type": "qq",
        "id": id_str, "qqId": qq_id.and_then(|v| v.as_u64()),
        "mid": mid, "songmid": mid, "mediaMid": media_mid,
        "name": name,
        "artist": artist_str,
        "artists": artists,
        "artistId": artists.first().and_then(|a| a.get("id")),
        "artistMid": artists.first().and_then(|a| json_val_as_str(a.get("mid").unwrap_or(&serde_json::Value::Null))),
        "album": album.get("name").or_else(|| album.get("title")).and_then(|v| v.as_str()).unwrap_or(""),
        "albumMid": album_mid,
        "cover": qq_album_cover(&album_mid, 300),
        "duration": duration,
        "fee": fee,
        "playable": false,
    })
}

/// Get QQ playlist tracks.
pub async fn get_playlist_tracks(id: &str, cookie: &str) -> serde_json::Value {
    let pid = id.trim();
    if pid.is_empty() {
        return serde_json::json!({ "provider": "qq", "error": "Missing playlist id", "tracks": [] });
    }
    let obj = parse_cookie_string(cookie);
    let uin = qq_cookie_uin(&obj);
    let url = format!(
        "https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&utf8=1&disstid={}&loginUin={}&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0",
        pid, if uin.is_empty() { "0" } else { &uin }
    );
    match qq_get_json(&url, cookie, "https://y.qq.com/n/yqq/playlist").await {
        Ok(result) => {
            let detail = result.get("cdlist").and_then(|v| v.as_array())
                .and_then(|a| a.first()).unwrap_or(&serde_json::Value::Null);
            let raw_tracks = detail.get("songlist").and_then(|v| v.as_array()).map(|a| a.as_slice()).unwrap_or(&[]);
            let tracks: Vec<serde_json::Value> = raw_tracks.iter()
                .map(|t| map_qq_playlist_track(t))
                .filter(|t| {
                    let name = t.get("name").and_then(|v| v.as_str()).unwrap_or("");
                    let mid = t.get("mid").and_then(|v| v.as_str()).unwrap_or("");
                    !name.is_empty() && !mid.is_empty()
                })
                .collect();
            info!("[QQ/playlist] id={}, raw_tracks={}, mapped_tracks={}", pid, raw_tracks.len(), tracks.len());
            if let Some(first) = raw_tracks.first() {
                let keys: Vec<&str> = first.as_object().map(|o| o.keys().map(|k| k.as_str()).collect()).unwrap_or_default();
                info!("[QQ/playlist] first raw track keys: {:?}", keys);
            }
            let playlist_name = detail.get("dissname").or_else(|| detail.get("diss_name")).or_else(|| detail.get("name"))
                .and_then(|v| v.as_str()).unwrap_or("");
            let cover = detail.get("logo").or_else(|| detail.get("diss_cover")).and_then(|v| v.as_str()).unwrap_or("");
            serde_json::json!({
                "provider": "qq", "loggedIn": !cookie.is_empty(),
                "playlist": {
                    "provider": "qq", "id": pid, "name": playlist_name,
                    "cover": cover, "trackCount": tracks.len()
                },
                "tracks": tracks,
            })
        }
        Err(e) => serde_json::json!({ "provider": "qq", "error": e, "tracks": [] })
    }
}

/// Map a QQ comment object.
fn map_qq_comment(raw: &serde_json::Value) -> serde_json::Value {
    let user = raw.get("user").or_else(|| raw.get("uin")).unwrap_or(&serde_json::Value::Null);
    let nickname = raw.get("nick").or_else(|| raw.get("nickname")).or_else(|| raw.get("encrypt_uin"))
        .or_else(|| user.get("nick")).or_else(|| user.get("nickname"))
        .and_then(|v| v.as_str()).unwrap_or("QQ 音乐用户");
    let avatar = raw.get("avatarurl").or_else(|| raw.get("avatar"))
        .or_else(|| user.get("avatarurl")).or_else(|| user.get("avatar"))
        .and_then(|v| v.as_str()).unwrap_or("");
    let time = raw.get("time").or_else(|| raw.get("commenttime")).or_else(|| raw.get("createTime"))
        .and_then(|v| v.as_u64()).unwrap_or(0);
    let time_ms = if time > 0 && time < 10000000000 { time * 1000 } else { time };
    serde_json::json!({
        "id": raw.get("commentid").or_else(|| raw.get("commentId")).or_else(|| raw.get("id")).and_then(|v| v.as_str()).unwrap_or(""),
        "content": raw.get("rootcommentcontent").or_else(|| raw.get("content")).or_else(|| raw.get("comment")).and_then(|v| v.as_str()).unwrap_or(""),
        "likedCount": raw.get("praisenum").or_else(|| raw.get("praise_num")).and_then(|v| v.as_u64()).unwrap_or(0),
        "time": time_ms,
        "user": {
            "id": raw.get("encrypt_uin").or_else(|| raw.get("uin")).or_else(|| user.get("uin")).and_then(|v| v.as_str()).unwrap_or(""),
            "nickname": nickname, "avatar": avatar,
        },
    })
}

/// Get QQ song comments.
pub async fn get_song_comments(id: &str, mid: &str, limit: u32, cookie: &str) -> serde_json::Value {
    let mut topid: String = id.chars().filter(|c| c.is_ascii_digit()).collect();
    if topid.is_empty() && !mid.is_empty() {
        if let Ok(detail) = qq_song_detail(mid, cookie).await {
            topid = detail.get("qqId").and_then(|v| v.as_u64()).map(|v| v.to_string()).unwrap_or_default();
        }
    }
    if topid.is_empty() {
        return serde_json::json!({ "provider": "qq", "error": "Missing QQ song id", "comments": [] });
    }
    let obj = parse_cookie_string(cookie);
    let uin = qq_cookie_uin(&obj);
    let uin_str = if uin.is_empty() { "0" } else { uin.as_str() };
    let url = format!(
        "https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg?g_tk=5381&loginUin={}&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0&cid=205360772&reqtype=2&biztype=1&topid={}&cmd=8&needmusiccrit=0&pagenum=0&pagesize={}",
        uin_str, topid, limit
    );
    let referer = format!("https://y.qq.com/n/ryqq/songDetail/{}", urlencoding::encode(mid));
    match qq_get_json(&url, cookie, &referer).await {
        Ok(body) => {
            let hot_list = body.get("hot_comment").and_then(|h| h.get("commentlist")).and_then(|v| v.as_array());
            let normal_list = body.get("comment").and_then(|c| c.get("commentlist")).and_then(|v| v.as_array());
            let raw = if hot_list.map_or(false, |l| !l.is_empty()) { hot_list } else { normal_list };
            let comments: Vec<serde_json::Value> = raw.map(|list| {
                list.iter().map(|r| map_qq_comment(r)).filter(|c| {
                    c.get("content").and_then(|v| v.as_str()).map_or(false, |s| !s.is_empty())
                }).collect()
            }).unwrap_or_default();
            let total = body.get("comment").and_then(|c| {
                c.get("commenttotal").or_else(|| c.get("comment_total"))
            }).and_then(|v| v.as_u64()).unwrap_or(comments.len() as u64);
            let has_hot = hot_list.map_or(false, |l| !l.is_empty());
            serde_json::json!({ "provider": "qq", "id": topid, "total": total, "comments": comments, "hot": has_hot })
        }
        Err(e) => serde_json::json!({ "provider": "qq", "error": e, "comments": [] })
    }
}
