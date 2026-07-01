mod commands;
mod netease;
mod qq;
mod server;
mod dj_analyzer;
mod cookie_store;

use log::info;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, LogicalSize, Manager};
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
    /// Whether the close button should minimize to tray instead of quitting
    pub close_to_tray: AtomicBool,
    /// Whether the user explicitly chose to quit (via tray menu "退出")
    pub app_quitting: AtomicBool,
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
            close_to_tray: AtomicBool::new(true),
            app_quitting: AtomicBool::new(false),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    info!("Mineradio-Next v{} starting (Tauri build)", env!("CARGO_PKG_VERSION"));

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
        .plugin(tauri_plugin_window_state::Builder::new()
            .with_state_flags(tauri_plugin_window_state::StateFlags::POSITION
                | tauri_plugin_window_state::StateFlags::SIZE)
            .build())
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
            // Tray / startup
            commands::tray::get_tray_settings,
            commands::tray::set_close_to_tray,
            commands::tray::set_startup_enabled,
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
                    *guard = Some(data_dir.clone());
                }
                // Load persisted close-to-tray setting before window is shown
                let ctt = commands::tray::load_close_to_tray(&data_dir);
                state.close_to_tray.store(ctt, Ordering::SeqCst);
                info!("Close-to-tray: {}", ctt);
            }
            // Show main window only after HTTP server is ready (prevents blank screen)
            let state_for_thread = state.clone();
            std::thread::spawn(move || {
                // Wait up to 10 seconds for the HTTP server
                for _ in 0..100 {
                    if state_for_thread.server_ready.load(Ordering::SeqCst) {
                        break;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                info!("HTTP server ready, showing main window");
                // Small extra delay to ensure actix is fully accepting connections
                std::thread::sleep(std::time::Duration::from_millis(200));
                if let Some(window) = app_handle.get_webview_window("main") {
                    // Navigate from about:blank to the actual server URL
                    let port = state_for_thread.server_port.load(Ordering::SeqCst);
                    let url = format!("http://localhost:{}/", port);
                    info!("Navigating main window to: {}", url);
                    if let Ok(parsed) = url::Url::parse(&url) {
                        window.navigate(parsed).ok();
                    }
                    // Always start windowed with properly calculated bounds (like Electron's getWindowedBounds)
                    if window.is_fullscreen().unwrap_or(false) {
                        info!("Clearing persisted fullscreen state");
                        window.set_fullscreen(false).ok();
                    }
                    if window.is_maximized().unwrap_or(false) {
                        window.unmaximize().ok();
                    }
                    // Calculate reasonable windowed bounds: 3/4 of screen, 16:9 aspect
                    if let Ok(monitors) = app_handle.available_monitors() {
                        // Use the primary (first) monitor
                        if let Some(monitor) = monitors.first() {
                            let mon_size = monitor.size();
                            let scale = window.scale_factor().unwrap_or(1.0);
                            let mon_w = mon_size.width as f64 / scale;
                            let mon_h = mon_size.height as f64 / scale;
                            let margin = 32.0_f64;
                            let min_w = 960.0_f64;
                            let min_h = 540.0_f64;
                            let max_w = (mon_w - margin).max(640.0);
                            let max_h = (mon_h - margin).max(360.0);
                            let mut w = (mon_w * 0.75).round();
                            let mut h = (w / (16.0 / 9.0)).round();
                            let scaled_h = (mon_h * 0.75).round();
                            if h > scaled_h {
                                h = scaled_h;
                                w = (h * (16.0 / 9.0)).round();
                            }
                            if w < min_w && max_w >= min_w && max_h >= min_h {
                                w = min_w;
                                h = min_h;
                            }
                            if w > max_w {
                                w = max_w;
                                h = (w / (16.0 / 9.0)).round();
                            }
                            if h > max_h {
                                h = max_h;
                                w = (h * (16.0 / 9.0)).round();
                            }
                            info!("Setting initial window size to {}x{} (monitor: {}x{} @ {:.2}x)", w, h, mon_w, mon_h, scale);
                            window.set_size(LogicalSize::new(w, h)).ok();
                        }
                    }
                    window.center().ok();
                    window.show().ok();
                    window.set_focus().ok();
                }
            });
            // ── System tray icon ────────────────────────────────────────────
            {
                let _ = setup_tray(app.app_handle(), &state);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                // Intercept close: minimize to tray if close_to_tray is enabled
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    let state = window.state::<Arc<AppState>>().inner().clone();
                    let quitting = state.app_quitting.load(Ordering::SeqCst);
                    let close_to_tray = state.close_to_tray.load(Ordering::SeqCst);
                    if !quitting && close_to_tray {
                        api.prevent_close();
                        let _ = window.hide();
                        info!("Window hidden (close-to-tray)");
                    }
                }
                tauri::WindowEvent::Resized(_) => {
                    // Debounce: emit state after resize settles.
                    // This catches fullscreen transitions (OS ESC, green button), maximize/unmaximize, etc.
                    let win = window.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(80));
                        let state = commands::window::get_state(&win);
                        let _ = win.emit("desktop-window-state", state);
                    });
                }
                tauri::WindowEvent::Focused(_) => {
                    let state = commands::window::get_state(window);
                    let _ = window.emit("desktop-window-state", state);
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ── System tray helpers ─────────────────────────────────────────────

static TRAY_APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();
static TRAY_STATE: OnceLock<Arc<AppState>> = OnceLock::new();

/// Create the system tray icon and initial menu. Called once from `setup`.
fn setup_tray(app: &tauri::AppHandle, state: &Arc<AppState>) -> Result<(), Box<dyn std::error::Error>> {
    let _ = TRAY_APP_HANDLE.set(app.clone());
    let _ = TRAY_STATE.set(state.clone());
    let menu = build_tray_menu(app, state)?;
    let state_for_menu = state.clone();
    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().cloned().unwrap())
        .tooltip("Mineradio-Next")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
                "close_to_tray" => {
                    let current = state_for_menu.close_to_tray.load(Ordering::SeqCst);
                    state_for_menu.close_to_tray.store(!current, Ordering::SeqCst);
                    if let Ok(data_dir) = app.path().app_data_dir() {
                        commands::tray::write_tray_setting(
                            &data_dir,
                            "close_to_tray",
                            &serde_json::Value::Bool(!current),
                        );
                    }
                    refresh_tray_menu();
                }
                "startup" => {
                    let current = commands::tray::is_startup_enabled();
                    commands::tray::set_startup_enabled_platform(!current);
                    refresh_tray_menu();
                }
                "quit" => {
                    state_for_menu.app_quitting.store(true, Ordering::SeqCst);
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.close();
                    }
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;
    info!("System tray icon created");
    Ok(())
}

/// Rebuild the tray menu with current checkbox states. Called when settings change.
pub fn refresh_tray_menu() {
    let (Some(app), Some(state)) = (TRAY_APP_HANDLE.get(), TRAY_STATE.get()) else {
        return;
    };
    if let Ok(menu) = build_tray_menu(app, state) {
        if let Some(tray) = app.tray_by_id("main") {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

/// Build the tray context menu from current state.
fn build_tray_menu(
    app: &tauri::AppHandle,
    state: &Arc<AppState>,
) -> Result<tauri::menu::Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let close_to_tray = state.close_to_tray.load(Ordering::SeqCst);

    let show_item = MenuItemBuilder::with_id("show", "显示 Mineradio-Next").build(app)?;
    let close_to_tray_item =
        CheckMenuItemBuilder::with_id("close_to_tray", "关闭按钮最小化到托盘")
            .checked(close_to_tray)
            .build(app)?;
    let startup_item =
        CheckMenuItemBuilder::with_id("startup", "开机自动启动")
            .checked(commands::tray::is_startup_enabled())
            .build(app)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "退出 Mineradio-Next").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .item(&close_to_tray_item)
        .item(&startup_item)
        .item(&sep)
        .item(&quit_item)
        .build()?;

    Ok(menu)
}
