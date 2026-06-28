use actix_web::{web, HttpResponse};
use crate::AppState;
use std::sync::Arc;

pub async fn get_version(_state: web::Data<Arc<AppState>>) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "name": "mineradio",
        "productName": "Mineradio",
        "version": env!("CARGO_PKG_VERSION"),
        "update": {
            "provider": "github",
            "configured": true,
            "owner": "XxHuberrr",
            "repo": "Mineradio",
            "preview": true,
            "manifestOverride": false,
        },
    }))
}
