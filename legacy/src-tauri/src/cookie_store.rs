use log::info;
use std::path::{Path, PathBuf};
use crate::AppState;

const NETEASE_COOKIE_FILE: &str = ".cookie";
const QQ_COOKIE_FILE: &str = ".qq-cookie";

fn cookie_path(data_dir: &Path, name: &str) -> PathBuf {
    data_dir.join(name)
}

/// Load persisted cookies from the data directory into AppState (blocking).
/// Called during Tauri setup() before any async tasks run, so try_write is safe.
pub fn load_cookies(state: &AppState, data_dir: &Path) {
    let netease_path = cookie_path(data_dir, NETEASE_COOKIE_FILE);
    let qq_path = cookie_path(data_dir, QQ_COOKIE_FILE);

    if let Ok(contents) = std::fs::read_to_string(&netease_path) {
        let trimmed = contents.trim().to_string();
        if !trimmed.is_empty() {
            info!("[cookie_store] Loaded Netease cookie ({} chars)", trimmed.len());
            if let Ok(mut w) = state.netease_cookie.try_write() {
                *w = trimmed;
            }
        }
    }

    if let Ok(contents) = std::fs::read_to_string(&qq_path) {
        let trimmed = contents.trim().to_string();
        if !trimmed.is_empty() {
            info!("[cookie_store] Loaded QQ cookie ({} chars)", trimmed.len());
            if let Ok(mut w) = state.qq_cookie.try_write() {
                *w = trimmed;
            }
        }
    }
}

/// Persist a cookie string to disk.
pub fn save_cookie_to_disk(state: &AppState, filename: &str, cookie: &str) {
    let data_dir = match state.data_dir.lock() {
        Ok(guard) => guard.clone(),
        Err(_) => return,
    };
    if let Some(dir) = data_dir {
        let path = cookie_path(&dir, filename);
        if let Err(e) = std::fs::write(&path, cookie) {
            info!("[cookie_store] Failed to write {}: {}", filename, e);
        } else {
            info!("[cookie_store] Saved {} ({} chars)", filename, cookie.len());
        }
    }
}

/// Convenience: persist Netease cookie.
pub fn save_netease_cookie(state: &AppState, cookie: &str) {
    save_cookie_to_disk(state, NETEASE_COOKIE_FILE, cookie);
}

/// Convenience: persist QQ cookie.
pub fn save_qq_cookie(state: &AppState, cookie: &str) {
    save_cookie_to_disk(state, QQ_COOKIE_FILE, cookie);
}
