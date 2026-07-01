use log::{info, warn};

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
const GITHUB_OWNER: &str = "zhanghaifei1997";
const GITHUB_REPO: &str = "Mineradio-Next";

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

#[tauri::command]
pub async fn update_latest() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder().build().map_err(|e| e.to_string())?;
    let url = format!("https://api.github.com/repos/{}/{}/releases/latest", GITHUB_OWNER, GITHUB_REPO);

    let resp = client.get(&url)
        .header("User-Agent", format!("Mineradio/{}", APP_VERSION))
        .header("Accept", "application/vnd.github+json")
        .send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Ok(serde_json::json!({
            "configured": false, "updateAvailable": false,
            "currentVersion": APP_VERSION, "latestVersion": APP_VERSION,
            "error": format!("GitHub API returned {}", resp.status()),
        }));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let tag = data.get("tag_name").and_then(|v| v.as_str()).unwrap_or("");
    let latest_version = tag.trim_start_matches('v');

    let mut download_url = String::new();
    let mut asset_size: u64 = 0;
    if let Some(assets) = data.get("assets").and_then(|v| v.as_array()) {
        for asset in assets {
            let name = asset.get("name").and_then(|v| v.as_str()).unwrap_or("");
            if name.ends_with(".exe") || name.ends_with(".msi") || name.ends_with(".nsis.zip")
                || name.ends_with(".dmg") || name.ends_with(".AppImage")
            {
                download_url = asset.get("browser_download_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
                asset_size = asset.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
                break;
            }
        }
    }

    let body_text = data.get("body").and_then(|v| v.as_str()).unwrap_or("");
    let notes: Vec<&str> = body_text.lines().filter(|l| !l.trim().is_empty()).take(20).collect();
    let has_update = compare_versions(latest_version, APP_VERSION) > 0;

    info!("[Update] current={} latest={} hasUpdate={}", APP_VERSION, latest_version, has_update);

    Ok(serde_json::json!({
        "configured": true, "updateAvailable": has_update,
        "currentVersion": APP_VERSION, "latestVersion": latest_version,
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
    }))
}
