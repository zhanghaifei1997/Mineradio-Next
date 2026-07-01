pub mod routes;

use crate::AppState;
use actix_cors::Cors;
use actix_web::{web, App, HttpServer, HttpResponse};
use log::{info, warn};
use std::sync::atomic::Ordering;
use std::sync::Arc;

/// Check if a TCP port is available by attempting to bind.
fn is_port_available(port: u16) -> bool {
    std::net::TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok()
}

/// Start the HTTP API server and return the listening port.
pub async fn start_server(state: Arc<AppState>) -> u16 {
    let state_data = web::Data::new(state.clone());

    // Choose port: prefer 3000, fall back to OS-assigned (port 0)
    let bind_addr = if is_port_available(3000) {
        "127.0.0.1:3000".to_string()
    } else {
        warn!("Port 3000 is occupied, using OS-assigned port");
        "127.0.0.1:0".to_string()
    };

    let server = HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(state_data.clone())
            .route("/api/app/version", web::get().to(routes::app::get_version))
            .route("/api/search", web::get().to(routes::search::handle_search))
            .route("/api/song/url", web::get().to(routes::song::handle_song_url))
            .route("/api/login/qr/key", web::get().to(routes::login::handle_qr_key))
            .route("/api/login/qr/create", web::get().to(routes::login::handle_qr_create))
            .route("/api/login/qr/check", web::get().to(routes::login::handle_qr_check))
            .route("/api/login/status", web::get().to(routes::login::handle_login_status))
            .route("/api/login/cookie", web::post().to(routes::login::handle_login_cookie))
            .route("/api/logout", web::get().to(routes::login::handle_logout))
            .route("/api/lyric", web::get().to(routes::lyric::handle_lyric))
            .route("/api/user/playlists", web::get().to(routes::playlist::handle_user_playlists))
            .route("/api/playlist/tracks", web::get().to(routes::playlist::handle_playlist_tracks))
            .route("/api/playlist/create", web::get().to(routes::playlist::handle_playlist_create))
            .route("/api/playlist/add-song", web::post().to(routes::playlist::handle_add_song))
            .route("/api/song/like", web::get().to(routes::like::handle_like))
            .route("/api/song/like/check", web::get().to(routes::like::handle_like_check))
            .route("/api/artist/detail", web::get().to(routes::artist::handle_artist_detail))
            .route("/api/song/comments", web::get().to(routes::comment::handle_comments))
            .route("/api/podcast/search", web::get().to(routes::podcast::handle_search))
            .route("/api/podcast/hot", web::get().to(routes::podcast::handle_hot))
            .route("/api/podcast/detail", web::get().to(routes::podcast::handle_detail))
            .route("/api/podcast/programs", web::get().to(routes::podcast::handle_programs))
            .route("/api/podcast/my", web::get().to(routes::podcast::handle_my))
            .route("/api/discover/home", web::get().to(routes::discover::handle_home))
            .route("/api/audio", web::get().to(routes::proxy::handle_audio_proxy))
            .route("/api/cover", web::get().to(routes::proxy::handle_cover_proxy))
            .route("/api/qq/logout", web::get().to(routes::login::handle_qq_logout))
            .route("/api/qq/user/playlists", web::get().to(routes::login::handle_qq_user_playlists))
            .route("/api/qq/login/cookie", web::post().to(routes::login::handle_qq_login_cookie))
            .route("/api/qq/login/status", web::get().to(routes::login::handle_qq_login_status))
            .route("/api/qq/search", web::get().to(routes::qq::handle_qq_search))
            .route("/api/qq/song/url", web::get().to(routes::qq::handle_qq_song_url))
            .route("/api/qq/lyric", web::get().to(routes::qq::handle_qq_lyric))
            .route("/api/qq/artist/detail", web::get().to(routes::qq::handle_qq_artist_detail))
            .route("/api/qq/playlist/tracks", web::get().to(routes::qq::handle_qq_playlist_tracks))
            .route("/api/qq/song/comments", web::get().to(routes::qq::handle_qq_song_comments))
            .route("/api/beatmap/cache/status", web::get().to(routes::beatmap::handle_cache_status))
            .route("/api/beatmap/cache", web::get().to(routes::beatmap::handle_cache_get))
            .route("/api/beatmap/cache", web::post().to(routes::beatmap::handle_cache_post))
            .route("/api/podcast/my/items", web::get().to(routes::podcast::handle_my_items))
            .route("/api/podcast/dj-beatmap", web::get().to(routes::podcast::handle_dj_beatmap))
            .route("/api/update/latest", web::get().to(routes::update::handle_update_latest))
            .route("/api/update/download", web::post().to(routes::update::handle_update_download))
            .route("/api/update/download/status", web::get().to(routes::update::handle_update_download_status))
            .route("/api/update/patch", web::post().to(routes::update::handle_update_patch))
            .route("/api/update/patch/status", web::get().to(routes::update::handle_update_patch_status))
            .route("/api/weather/radio", web::get().to(routes::weather::handle_weather_radio))
            .route("/api/weather/ip-location", web::get().to(routes::weather::handle_ip_location))
            .route("/favicon.ico", web::get().to(routes::stub_no_content))
            .route("/api/invoke/{command}", web::post().to(routes::handle_invoke))
            .default_service(web::get().to(routes::static_files::handle_static))
    })
    .bind(&bind_addr)
    .unwrap_or_else(|e| panic!("Failed to bind HTTP server to {}: {}", bind_addr, e));

    // Get the actual bound port from the TCP listener
    let addrs = server.addrs();
    let bound_port = addrs.first().map(|a| a.port()).unwrap_or(3000);

    // Update state with actual port
    state.server_port.store(bound_port, Ordering::SeqCst);

    // Start the server (spawns workers, begins accepting connections)
    let server = server.run();
    info!("HTTP API server started on http://127.0.0.1:{}", bound_port);

    // Mark server as ready AFTER run() so the window navigates to the correct port
    state.server_ready.store(true, Ordering::SeqCst);

    server.await.expect("HTTP server error");
    bound_port
}

/// Helper: build a JSON HTTP response with the given status code.
#[allow(dead_code)]
pub fn json_response(data: serde_json::Value, status: u16) -> HttpResponse {
    let mut builder = match status {
        200 => HttpResponse::Ok(),
        400 => HttpResponse::BadRequest(),
        401 => HttpResponse::Unauthorized(),
        404 => HttpResponse::NotFound(),
        500 => HttpResponse::InternalServerError(),
        _ => HttpResponse::Ok(),
    };
    builder.json(data)
}
