//! DJ Analyzer sidecar — transitional module.
//!
//! The DJ analyzer (dj-analyzer.js, 864 lines) performs BPM detection,
//! energy analysis, and beat alignment on audio streams. For the initial
//! Tauri release, we invoke it via Node.js as a sidecar process.
//!
//! Future: rewrite in Rust using symphonia for audio decoding and
//! custom DSP for BPM/beat detection.

use std::process::Command;
use serde_json::Value;

/// Path to the dj-analyzer.js script (relative to project root).
#[allow(dead_code)]
const DJ_ANALYZER_SCRIPT: &str = "../dj-analyzer.js";

/// Run DJ analysis on an audio URL and return the JSON result.
#[allow(dead_code)]
pub async fn analyze_stream(audio_url: &str) -> Result<Value, String> {
    let script_path = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .join(DJ_ANALYZER_SCRIPT);

    if !script_path.exists() {
        return Err(format!("DJ analyzer script not found at {:?}", script_path));
    }

    let url = audio_url.to_string();

    // Spawn node.js to run the analyzer
    let output = tokio::task::spawn_blocking(move || {
        Command::new("node")
            .arg(script_path.to_str().unwrap_or(""))
            .arg("--url")
            .arg(&url)
            .output()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| format!("Failed to run DJ analyzer: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("DJ analyzer failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse DJ analyzer output: {}", e))
}

/// Check if Node.js is available for DJ analysis.
#[allow(dead_code)]
pub fn is_available() -> bool {
    Command::new("node")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}
