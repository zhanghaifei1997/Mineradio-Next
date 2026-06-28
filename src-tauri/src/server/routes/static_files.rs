use actix_web::{HttpRequest, HttpResponse};
use std::path::PathBuf;

/// Get the public/ directory path relative to the executable.
fn public_dir() -> PathBuf {
    // Try to find public/ relative to the executable
    if let Ok(exe) = std::env::current_exe() {
        // exe is at: src-tauri/target/debug/mineradio.exe (dev)
        // or at: Mineradio/mineradio.exe (release)
        let exe_dir = exe.parent().unwrap_or_else(|| std::path::Path::new("."));

        // Try multiple possible locations
        let candidates = [
            exe_dir.join("..").join("..").join("..").join("public"),  // dev: target/debug/../../.. /public
            exe_dir.join("..").join("..").join("public"),  // dev alt: target/../public
            exe_dir.join("_up_").join("public"),            // NSIS: Mineradio/_up_/public/ (Tauri resource normalization)
            exe_dir.join("resources"),                      // NSIS alt: Mineradio/resources/
            exe_dir.join("resources").join("public"),       // NSIS alt: Mineradio/resources/public/
            exe_dir.join("public"),                         // release alt: ./public
            exe_dir.join("..").join("public"),              // alt: ../public
        ];

        for candidate in &candidates {
            if candidate.exists() {
                return candidate.clone();
            }
        }
    }

    // Fallback: use current_dir
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("..")
        .join("public")
}

/// Serve static files from the public/ directory
pub async fn handle_static(req: HttpRequest) -> HttpResponse {
    let path = req.path();
    let file_path = if path == "/" || path.is_empty() {
        "index.html"
    } else {
        &path[1..] // strip leading /
    };

    // Security: prevent directory traversal
    if file_path.contains("..") {
        return HttpResponse::BadRequest().body("Invalid path");
    }

    let full_path = public_dir().join(file_path);

    match std::fs::read(&full_path) {
        Ok(bytes) => {
            let content_type = mime_from_path(file_path);
            HttpResponse::Ok()
                .insert_header(("Content-Type", content_type))
                .body(bytes)
        }
        Err(_) => HttpResponse::NotFound().body("Not found"),
    }
}

fn mime_from_path(path: &str) -> &'static str {
    if path.ends_with(".html") {
        "text/html; charset=utf-8"
    } else if path.ends_with(".js") {
        "application/javascript; charset=utf-8"
    } else if path.ends_with(".css") {
        "text/css; charset=utf-8"
    } else if path.ends_with(".json") {
        "application/json; charset=utf-8"
    } else if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        "image/jpeg"
    } else if path.ends_with(".svg") {
        "image/svg+xml"
    } else if path.ends_with(".ico") {
        "image/x-icon"
    } else if path.ends_with(".bin") {
        "application/octet-stream"
    } else if path.ends_with(".woff") || path.ends_with(".woff2") {
        "font/woff2"
    } else if path.ends_with(".mp3") {
        "audio/mpeg"
    } else if path.ends_with(".ttf") {
        "font/ttf"
    } else {
        "application/octet-stream"
    }
}
