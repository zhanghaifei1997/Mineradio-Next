use crate::netease::request::{self, CryptoMode, RequestOptions};

pub async fn login_qr_key(cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({ "type": 1 });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/login/qrcode/unikey", &data, &opts).await
}

pub async fn login_qr_create(key: &str, cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "key": key,
        "qrimg": true,
        "type": 1,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/login/qrcode/create", &data, &opts).await
}

pub async fn login_qr_check(key: &str, cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({
        "key": key,
        "type": 1,
    });
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/login/qrcode/client/login", &data, &opts).await
}

pub async fn login_status(cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({});
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/w/nuser/account/get", &data, &opts).await
}

#[allow(dead_code)]
pub async fn user_account(cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({});
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/w/nuser/account/get", &data, &opts).await
}

pub async fn logout(cookie: &str) -> Result<request::ApiResponse, String> {
    let data = serde_json::json!({});
    let opts = RequestOptions {
        crypto: CryptoMode::Weapi,
        cookie: cookie.to_string(),
        ..Default::default()
    };
    request::create_request("/api/logout", &data, &opts).await
}
