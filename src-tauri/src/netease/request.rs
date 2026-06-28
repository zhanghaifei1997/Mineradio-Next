//! NeteaseCloudMusicApi HTTP request layer — Rust port of util/request.js
//!
//! Handles encryption routing, cookie injection, user-agent selection,
//! and response decryption for all Netease API calls.

use serde::{Deserialize, Serialize};
use log::{info, warn};

use super::crypto;

const DOMAIN: &str = "https://music.163.com";
const API_DOMAIN: &str = "https://interface.music.163.com";
const UA_WEAPI: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0";
const UA_LINUXAPI: &str = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36";
const UA_API_IPHONE: &str = "NeteaseMusic 9.0.90/5038 (iPhone; iOS 16.2; zh_CN)";

/// Crypto mode for the request
#[derive(Debug, Clone, PartialEq)]
#[allow(dead_code)]
pub enum CryptoMode {
    Weapi,
    Linuxapi,
    Eapi,
    Api,
    None,
}

/// Options for a Netease API request
#[derive(Debug, Clone)]
pub struct RequestOptions {
    pub crypto: CryptoMode,
    pub cookie: String,
    pub domain: Option<String>,
    pub ua: Option<String>,
    pub real_ip: Option<String>,
    pub encrypt_response: bool,
}

impl Default for RequestOptions {
    fn default() -> Self {
        Self {
            crypto: CryptoMode::Eapi,
            cookie: String::new(),
            domain: None,
            ua: None,
            real_ip: None,
            encrypt_response: true,
        }
    }
}

/// Standard API response from Netease
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse {
    pub status: u16,
    pub body: serde_json::Value,
    #[serde(default)]
    pub cookie: Vec<String>,
}

/// Create a Netease API request with the specified encryption mode.
pub async fn create_request(
    uri: &str,
    data: &serde_json::Value,
    options: &RequestOptions,
) -> Result<ApiResponse, String> {
    let client = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .map_err(|e| e.to_string())?;

    let mut headers = reqwest::header::HeaderMap::new();
    let domain = options.domain.as_deref().unwrap_or(DOMAIN);

    // IP headers
    if let Some(ip) = &options.real_ip {
        headers.insert("X-Real-IP", ip.parse().unwrap());
        headers.insert("X-Forwarded-For", ip.parse().unwrap());
    }

    let mut params = data.clone();
    let csrf_token = extract_cookie_value(&options.cookie, "__csrf");

    let (url, form_data, ua) = match options.crypto {
        CryptoMode::Weapi => {
            headers.insert("Referer", domain.parse().unwrap());
            params["csrf_token"] = serde_json::Value::String(csrf_token.clone());
            let encrypted = crypto::weapi(&params)?;
            let url = format!("{}/weapi/{}", domain, &uri[5..]);
            let ua = options.ua.as_deref().unwrap_or(UA_WEAPI);
            (url, encrypted, ua)
        }
        CryptoMode::Linuxapi => {
            let linux_data = serde_json::json!({
                "method": "POST",
                "url": format!("{}{}", domain, uri),
                "params": params,
            });
            let encrypted = crypto::linuxapi(&linux_data)?;
            let url = format!("{}/api/linux/forward", domain);
            let ua = options.ua.as_deref().unwrap_or(UA_LINUXAPI);
            (url, encrypted, ua)
        }
        CryptoMode::Eapi => {
            // Inject header fields into the data payload
            let header = build_eapi_header(&options.cookie, &csrf_token);
            params["header"] = serde_json::to_value(&header).unwrap_or_default();
            let encrypted = crypto::eapi(uri, &params)?;
            let url = format!("{}/eapi/{}", API_DOMAIN, &uri[5..]);
            let ua = options.ua.as_deref().unwrap_or(UA_API_IPHONE);
            (url, encrypted, ua)
        }
        CryptoMode::Api => {
            let url = format!("{}{}", API_DOMAIN, uri);
            let ua = options.ua.as_deref().unwrap_or(UA_API_IPHONE);
            (url, params.clone(), ua)
        }
        CryptoMode::None => {
            let url = format!("{}{}", domain, uri);
            let ua = options.ua.as_deref().unwrap_or(UA_WEAPI);
            (url, params.clone(), ua)
        }
    };

    headers.insert("User-Agent", ua.parse().unwrap());

    // Build cookie header
    if !options.cookie.is_empty() {
        let cookie_header = build_cookie_header(&options.cookie, &csrf_token);
        if let Ok(val) = cookie_header.parse() {
            headers.insert("Cookie", val);
        }
    }

    // Form-encode the encrypted params
    let form_body = serde_urlencoded::to_string(&form_data).unwrap_or_default();

    let req = client
        .post(&url)
        .headers(headers)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(form_body);

    // If we expect encrypted response, request raw bytes
    if options.encrypt_response
        && (options.crypto == CryptoMode::Eapi || options.crypto == CryptoMode::Weapi)
    {
        // Handled after response
    }

    let resp = req.send().await.map_err(|e| {
        warn!("Netease request failed: {} -> {}", url, e);
        e.to_string()
    })?;
    let status = resp.status().as_u16();
    info!("Netease response: {} status={}", url, status);
    let set_cookies: Vec<String> = resp
        .headers()
        .get_all("set-cookie")
        .iter()
        .filter_map(|v| v.to_str().ok().map(String::from))
        .collect();

    let body_text = resp.text().await.map_err(|e| e.to_string())?;
    let body: serde_json::Value = serde_json::from_str(&body_text).unwrap_or_else(|_| {
        serde_json::Value::String(body_text)
    });

    let code = body
        .get("code")
        .and_then(|c| c.as_u64())
        .map(|c| c as u16)
        .unwrap_or(status);

    Ok(ApiResponse {
        status: code,
        body,
        cookie: set_cookies,
    })
}

/// Build eapi header object
fn build_eapi_header(cookie: &str, csrf_token: &str) -> serde_json::Value {
    let os = "pc";
    let appver = "3.1.17.204416";
    let osver = "Microsoft-Windows-10-Professional-build-19045-64bit";
    let channel = "netease";
    let request_id = format!(
        "{}_{:04}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        rand::random::<u16>() % 1000
    );

    let mut header = serde_json::json!({
        "osver": osver,
        "deviceId": "",
        "os": os,
        "appver": appver,
        "versioncode": "140",
        "mobilename": "",
        "buildver": format!("{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() / 10),
        "resolution": "1920x1080",
        "__csrf": csrf_token,
        "channel": channel,
        "requestId": request_id,
    });

    let music_u = extract_cookie_value(cookie, "MUSIC_U");
    let music_a = extract_cookie_value(cookie, "MUSIC_A");
    if !music_u.is_empty() {
        header["MUSIC_U"] = serde_json::Value::String(music_u);
    }
    if !music_a.is_empty() {
        header["MUSIC_A"] = serde_json::Value::String(music_a);
    }

    header
}

/// Build a cookie header string from raw cookie + injected fields
fn build_cookie_header(raw_cookie: &str, csrf_token: &str) -> String {
    let mut parts: Vec<String> = raw_cookie
        .split(';')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if !csrf_token.is_empty() {
        parts.push(format!("__csrf={}", csrf_token));
    }
    parts.push("__remember_me=true".into());
    parts.push("ntes_kaola_ad=1".into());

    parts.join("; ")
}

/// Extract a single cookie value from a cookie string
fn extract_cookie_value(cookie: &str, name: &str) -> String {
    let prefix = format!("{}=", name);
    cookie
        .split(';')
        .find_map(|part| {
            let part = part.trim();
            if part.starts_with(&prefix) {
                Some(part[prefix.len()..].to_string())
            } else {
                None
            }
        })
        .unwrap_or_default()
}
