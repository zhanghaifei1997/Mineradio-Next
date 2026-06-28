use actix_web::{HttpRequest, HttpResponse};
use futures_util::StreamExt;
use reqwest::Client;

/// Audio proxy: forwards audio requests with Range support and streaming response
pub async fn handle_audio_proxy(req: HttpRequest) -> HttpResponse {
    let query = super::parse_query(&req);
    let audio_url = match query.get("url") {
        Some(url) => url.clone(),
        None => return HttpResponse::BadRequest().body("Missing url"),
    };

    let range = req
        .headers()
        .get("range")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    // Build Referer header based on the upstream host (matches Node.js audioProxyHeadersFor)
    let referer = detect_audio_referer(&audio_url);

    let client = Client::new();
    let mut upstream_req = client.get(&audio_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .header("Referer", referer);
    if !range.is_empty() {
        upstream_req = upstream_req.header("Range", range.as_str());
    }

    match upstream_req.send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let content_type = detect_audio_content_type(&audio_url, 
                resp.headers().get("content-type")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("audio/mpeg"));
            let content_length = resp.headers().get("content-length")
                .and_then(|v| v.to_str().ok())
                .map(String::from);
            let content_range = resp.headers().get("content-range")
                .and_then(|v| v.to_str().ok())
                .map(String::from);

            log::info!("[AudioProxy] upstream={} status={}", &audio_url[..audio_url.len().min(80)], status);

            // Stream the response body instead of buffering it entirely in memory.
            // This is critical for audio files (5–50 MB) — buffering causes timeouts.
            let stream = resp.bytes_stream().map(|chunk| {
                chunk.map(|b| actix_web::web::Bytes::from(b.to_vec()))
                    .map_err(|e| actix_web::error::ErrorInternalServerError(e))
            });

            let mut builder = HttpResponse::build(actix_web::http::StatusCode::from_u16(status).unwrap_or(actix_web::http::StatusCode::OK));
            builder
                .insert_header(("Content-Type", content_type))
                .insert_header(("Access-Control-Allow-Origin", "*"))
                .insert_header(("Accept-Ranges", "bytes"));
            if let Some(cl) = content_length {
                builder.insert_header(("Content-Length", cl));
            }
            if let Some(cr) = content_range {
                builder.insert_header(("Content-Range", cr));
            }
            builder.streaming(stream)
        }
        Err(e) => {
            log::error!("[AudioProxy] {}", e);
            HttpResponse::InternalServerError().body("Audio proxy error")
        }
    }
}

/// Detect the appropriate Referer header based on the audio URL host.
fn detect_audio_referer(audio_url: &str) -> &'static str {
    if let Ok(parsed) = url::Url::parse(audio_url) {
        if let Some(host) = parsed.host_str() {
            if host.contains("qq.com") || host.contains("qpic.cn") {
                return "https://y.qq.com/";
            }
        }
    }
    "https://music.163.com/"
}

/// Detect the audio content type from URL extension, falling back to upstream header.
fn detect_audio_content_type(audio_url: &str, upstream_type: &str) -> &'static str {
    if let Ok(parsed) = url::Url::parse(audio_url) {
        let path = parsed.path().to_lowercase();
        if path.ends_with(".flac") { return "audio/flac"; }
        if path.ends_with(".mp3") { return "audio/mpeg"; }
        if path.ends_with(".m4a") || path.ends_with(".mp4") { return "audio/mp4"; }
        if path.ends_with(".ogg") { return "audio/ogg"; }
        if path.ends_with(".wav") { return "audio/wav"; }
    }
    // Leak a static str from the upstream type for the HttpResponse header
    // In practice upstream_type is always a valid static-ish string
    if upstream_type == "audio/mpeg" { return "audio/mpeg"; }
    if upstream_type == "audio/flac" { return "audio/flac"; }
    if upstream_type == "audio/mp4" { return "audio/mp4"; }
    if upstream_type == "audio/ogg" { return "audio/ogg"; }
    "audio/mpeg"
}

/// Cover proxy: forwards image requests with CORS headers
pub async fn handle_cover_proxy(req: HttpRequest) -> HttpResponse {
    let query = super::parse_query(&req);
    let cover_url = match query.get("url") {
        Some(url) if url.starts_with("http") => url,
        _ => return HttpResponse::BadRequest().insert_header(("Access-Control-Allow-Origin", "*")).body("Invalid cover url"),
    };

    let client = Client::new();
    match client.get(cover_url)
        .header("User-Agent", "Mozilla/5.0")
        .header("Referer", "https://music.163.com/")
        .send()
        .await
    {
        Ok(resp) => {
            let content_type = resp.headers().get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("image/jpeg")
                .to_string();
            let bytes = resp.bytes().await.unwrap_or_default();

            HttpResponse::Ok()
                .insert_header(("Content-Type", content_type))
                .insert_header(("Access-Control-Allow-Origin", "*"))
                .insert_header(("Cross-Origin-Resource-Policy", "cross-origin"))
                .insert_header(("Cache-Control", "public, max-age=86400"))
                .body(bytes)
        }
        Err(e) => {
            log::error!("[CoverProxy] {}", e);
            HttpResponse::InternalServerError().body("Cover proxy error")
        }
    }
}
