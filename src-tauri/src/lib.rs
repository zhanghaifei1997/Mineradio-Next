mod commands;
mod netease;
mod server;
mod dj_analyzer;
mod cookie_store;

use log::info;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Manager;
use tokio::sync::RwLock;

/// Shared application state accessible across Tauri commands and HTTP server.
pub struct AppState {
    /// Netease login cookie string
    pub netease_cookie: RwLock<String>,
    /// QQ Music login cookie string
    pub qq_cookie: RwLock<String>,
    /// HTTP server port (assigned at runtime)
    pub server_port: AtomicU16,
    /// Whether the HTTP server is ready to accept connections
    pub server_ready: AtomicBool,
    /// Tauri AppHandle for HTTP server to access Tauri APIs
    pub app_handle: Mutex<Option<tauri::AppHandle>>,
    /// App data directory for persisting cookies etc.
    pub data_dir: Mutex<Option<PathBuf>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            netease_cookie: RwLock::new(String::new()),
            qq_cookie: RwLock::new(String::new()),
            server_port: AtomicU16::new(3000),
            server_ready: AtomicBool::new(false),
            app_handle: Mutex::new(None),
            data_dir: Mutex::new(None),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    info!("Mineradio v{} starting (Tauri build)", env!("CARGO_PKG_VERSION"));

    let state = Arc::new(AppState::default());

    // Spawn the HTTP API server on a background tokio runtime
    let server_state = Arc::clone(&state);
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create HTTP server runtime");
        rt.block_on(async {
            let port = server::start_server(server_state).await;
            info!("HTTP API server stopped on port {}", port);
        });
        // When the HTTP server stops, exit the process to prevent orphaned
        // WebView windows that show a broken page (ERR_CONNECTION_REFUSED).
        // This commonly happens when `cargo tauri dev` is interrupted with Ctrl+C.
        info!("HTTP server thread ended, exiting process to clean up WebView");
        std::process::exit(0);
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Second instance launched — focus the existing main window
            if let Some(window) = app.get_webview_window("main") {
                window.show().ok();
                window.set_focus().ok();
                window.unminimize().ok();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            // Window management
            commands::window::window_minimize,
            commands::window::window_toggle_maximize,
            commands::window::window_toggle_fullscreen,
            commands::window::window_close,
            commands::window::window_get_state,
            commands::window::window_exit_fullscreen_windowed,
            // Login windows
            commands::login::open_netease_login,
            commands::login::clear_netease_login,
            commands::login::open_qq_login,
            commands::login::clear_qq_login,
            // Hotkeys
            commands::hotkeys::configure_global_hotkeys,
            // Desktop lyrics overlay
            commands::lyrics::desktop_lyrics_set_enabled,
            commands::lyrics::desktop_lyrics_update,
            // Wallpaper overlay
            commands::wallpaper::wallpaper_set_enabled,
            commands::wallpaper::wallpaper_update,
            // File operations
            commands::file::export_json_file,
            commands::file::import_json_file,
            // App lifecycle
            commands::app::open_update_installer,
            commands::app::restart_app,
        ])
        .setup(|app| {
            let app_handle = app.app_handle().clone();
            let state = app.state::<Arc<AppState>>().inner().clone();
            // Store AppHandle so HTTP server can use Tauri APIs (shell.open, etc.)
            if let Ok(mut guard) = state.app_handle.lock() {
                *guard = Some(app_handle.clone());
            }
            // Resolve data directory and load persisted cookies
            if let Ok(data_dir) = app_handle.path().app_data_dir() {
                let _ = std::fs::create_dir_all(&data_dir);
                cookie_store::load_cookies(&state, &data_dir);
                if let Ok(mut guard) = state.data_dir.lock() {
                    *guard = Some(data_dir);
                }
            }
            // Show main window only after HTTP server is ready (prevents blank screen)
            std::thread::spawn(move || {
                // Wait up to 10 seconds for the HTTP server
                for _ in 0..100 {
                    if state.server_ready.load(Ordering::SeqCst) {
                        break;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                info!("HTTP server ready, showing main window");
                // Small extra delay to ensure actix is fully accepting connections
                std::thread::sleep(std::time::Duration::from_millis(200));
                if let Some(window) = app_handle.get_webview_window("main") {
                    // Navigate from about:blank to the actual server URL
                    let port = state.server_port.load(Ordering::SeqCst);
                    let url = format!("http://localhost:{}/", port);
                    info!("Navigating main window to: {}", url);
                    if let Ok(parsed) = url::Url::parse(&url) {
                        window.navigate(parsed).ok();
                    }
                    window.show().ok();
                    window.set_focus().ok();
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
