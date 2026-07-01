use actix_web::HttpResponse;
use log::{info, warn};

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
const GITHUB_OWNER: &str = "zhanghaifei1997";
const GITHUB_REPO: &str = "Mineradio-Next";

/// Compare two semver strings. Returns positive if a > b, 0 if equal, negative if a < b.
fn compare_versions(a: &str, b: &str) -> i32 {
    let parse = |v: &str| -> Vec<u32> {
        v.trim_start_matches('v').split('.')
            .filter_map(|p| p.chars().take_while(|c| c.is_ascii_digit()).collect::<String>().parse().ok())
            .collect()
    };
    let va = parse(a);
    let vb = parse(b);
    for i in 0..3 {
        let pa = va.get(i).copied().unwrap_or(0);
        let pb = vb.get(i).copied().unwrap_or(0);
        if pa != pb { return pa as i32 - pb as i32; }
    }
    0
}

/// Fetch latest release info from GitHub API.
async fn fetch_latest_update_info() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder().build().map_err(|e| e.to_string())?;
    let url = format!("https://api.github.com/repos/{}/{}/releases/latest", GITHUB_OWNER, GITHUB_REPO);

    let resp = client.get(&url)
        .header("User-Agent", format!("Mineradio/{}", APP_VERSION))
        .header("Accept", "application/vnd.github+json")
        .send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API returned {}", resp.status()));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let tag = data.get("tag_name").and_then(|v| v.as_str()).unwrap_or("");
    let latest_version = tag.trim_start_matches('v');

    // Find Windows installer asset
    let mut download_url = String::new();
    let mut asset_size: u64 = 0;
    if let Some(assets) = data.get("assets").and_then(|v| v.as_array()) {
        for asset in assets {
            let name = asset.get("name").and_then(|v| v.as_str()).unwrap_or("");
            if name.ends_with(".exe") || name.ends_with(".msi") || name.ends_with(".nsis.zip") {
                download_url = asset.get("browser_download_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
                asset_size = asset.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
                break;
            }
        }
    }

    // Extract release notes
    let body_text = data.get("body").and_then(|v| v.as_str()).unwrap_or("");
    let notes: Vec<&str> = body_text.lines()
        .filter(|l| !l.trim().is_empty())
        .take(20)
        .collect();

    let has_update = compare_versions(latest_version, APP_VERSION) > 0;

    info!("[Update] current={} latest={} hasUpdate={}", APP_VERSION, latest_version, has_update);

    Ok(serde_json::json!({
        "configured": true,
        "preview": false,
        "updateAvailable": has_update,
        "currentVersion": APP_VERSION,
        "latestVersion": latest_version,
        "release": {
            "tagName": tag,
            "name": data.get("name").and_then(|v| v.as_str()).unwrap_or(""),
            "version": latest_version,
            "publishedAt": data.get("published_at").and_then(|v| v.as_str()).unwrap_or(""),
            "htmlUrl": data.get("html_url").and_then(|v| v.as_str()).unwrap_or(""),
            "downloadUrl": download_url,
            "assetSize": asset_size,
            "summary": notes.first().copied().unwrap_or("发现新版本，建议更新。"),
            "notes": notes,
        },
        "update": {
            "provider": "github",
            "configured": true,
            "owner": GITHUB_OWNER,
            "repo": GITHUB_REPO,
            "preview": false,
        },
    }))
}

fn local_update_fallback(reason: &str) -> serde_json::Value {
    serde_json::json!({
        "configured": false,
        "preview": false,
        "updateAvailable": false,
        "currentVersion": APP_VERSION,
        "latestVersion": APP_VERSION,
        "release": {
            "tagName": format!("v{}", APP_VERSION),
            "name": format!("Mineradio-Next v{}", APP_VERSION),
            "version": APP_VERSION,
            "htmlUrl": "",
            "downloadUrl": "",
            "summary": "当前版本，更新检测已就绪。",
            "notes": [],
        },
        "reason": reason,
        "update": {
            "provider": "github",
            "configured": false,
            "owner": GITHUB_OWNER,
            "repo": GITHUB_REPO,
            "preview": false,
        },
    })
}

/// GET /api/update/latest
pub async fn handle_update_latest() -> HttpResponse {
    match fetch_latest_update_info().await {
        Ok(info) => HttpResponse::Ok().json(info),
        Err(e) => {
            warn!("[Update] check failed: {}", e);
            let mut fallback = local_update_fallback(&e);
            fallback["error"] = serde_json::json!(e);
            HttpResponse::Ok().json(fallback)
        }
    }
}

/// POST /api/update/download — Not available in Tauri build.
pub async fn handle_update_download() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "ok": false,
        "error": "UPDATE_DOWNLOAD_NOT_AVAILABLE",
        "message": "Tauri 版本请使用 GitHub Releases 手动下载安装包",
    }))
}

/// GET /api/update/download/status
pub async fn handle_update_download_status() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "ok": false,
        "error": "UPDATE_DOWNLOAD_NOT_AVAILABLE",
    }))
}

/// POST /api/update/patch
pub async fn handle_update_patch() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "ok": false,
        "error": "UPDATE_PATCH_NOT_AVAILABLE",
        "message": "Tauri 版本暂不支持快速补丁更新",
    }))
}

/// GET /api/update/patch/status
pub async fn handle_update_patch_status() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "ok": false,
        "error": "UPDATE_PATCH_NOT_AVAILABLE",
    }))
}
