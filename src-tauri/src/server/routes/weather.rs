use actix_web::{HttpRequest, HttpResponse};
use log::{info, warn};
use crate::AppState;
use std::sync::Arc;
use actix_web::web;

const OPEN_METEO_URL: &str = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL: &str = "https://geocoding-api.open-meteo.com/v1/search";
const IP_API_URL: &str = "http://ip-api.com/json/";

/// Map a WMO weather code to a mood category.
fn weather_mood(code: i64, temp: f64, humidity: f64) -> serde_json::Value {
    let (key, title, tagline, keywords) = if code >= 95 {
        ("storm", "暴风雨电台", "窗外风雨交加，适合一首安静的歌", vec!["陈奕迅 阴天快乐", "周杰伦 雨下一整晚"])
    } else if code >= 71 && code <= 77 {
        ("snow", "飘雪电台", "雪花落下的声音", vec!["陈奕迅 好久不见", "李健 贝加尔湖畔"])
    } else if code >= 61 && code <= 67 || code >= 80 && code <= 82 {
        ("rain", "雨天电台", "淅淅沥沥，听雨入眠", vec!["周杰伦 雨下一整晚", "孙燕姿 遇见"])
    } else if code >= 51 && code <= 57 {
        ("rain", "细雨电台", "毛毛雨，慢慢走", vec!["林宥嘉 说谎", "毛不易 消愁"])
    } else if code >= 45 && code <= 48 {
        ("cloudy", "雾中电台", "雾气朦胧，一切都很温柔", vec!["莫文蔚 阴天", "朴树 平凡之路"])
    } else if code >= 2 && code <= 3 {
        if temp > 28.0 && humidity > 70.0 {
            ("humid", "闷热午后", "空气里都是夏天的味道", vec!["落日飞车 My Jinji", "告五人 爱人错过"])
        } else {
            ("cloudy", "多云天气", "云层背后藏着阳光", vec!["蔡健雅 达尔文", "陈绮贞 旅行的意义"])
        }
    } else if code == 1 {
        ("sunny", "晴间多云", "今天是个好天气", vec!["孙燕姿 天黑黑", "五月天 温柔"])
    } else if code == 0 {
        if temp >= 30.0 {
            ("hot", "烈日电台", "阳光很烈，音乐很酷", vec!["夏日入侵企画 想去海边", "王若琳 Lost in Paradise"])
        } else {
            ("sunny", "晴天电台", "万里无云，心情明朗", vec!["周杰伦 晴天", "王菲 红豆"])
        }
    } else {
        ("cloudy", "天气电台", "听一首应景的歌", vec!["孙燕姿 天黑黑", "周杰伦 晴天"])
    };

    serde_json::json!({
        "key": key,
        "title": title,
        "tagline": tagline,
        "keywords": keywords,
    })
}

/// GET /api/weather/radio?city=xxx&lat=xxx&lon=xxx&timezone=xxx
pub async fn handle_weather_radio(
    req: HttpRequest,
    state: web::Data<Arc<AppState>>,
) -> HttpResponse {
    let query = super::parse_query(&req);
    let city = query.get("city").or_else(|| query.get("q")).cloned().unwrap_or_default();
    let lat: Option<f64> = query.get("lat").and_then(|v| v.parse().ok());
    let lon: Option<f64> = query.get("lon").and_then(|v| v.parse().ok());
    let timezone = query.get("timezone").cloned().unwrap_or_else(|| "auto".to_string());

    // Step 1: resolve coordinates
    let (latitude, longitude, location_name) = if let (Some(lat), Some(lon)) = (lat, lon) {
        (lat, lon, if city.is_empty() { "当前位置".to_string() } else { city })
    } else if !city.is_empty() {
        match geocode_city(&city).await {
            Ok((la, lo, name)) => (la, lo, name),
            Err(_) => (31.23, 121.47, city),
        }
    } else {
        (31.23, 121.47, "上海".to_string())
    };

    // Step 2: fetch weather
    let weather_url = format!(
        "{}?latitude={}&longitude={}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code&timezone={}",
        OPEN_METEO_URL, latitude, longitude, urlencoding::encode(&timezone)
    );

    let client = reqwest::Client::builder().build().unwrap_or_default();
    let weather_result = client.get(&weather_url)
        .header("User-Agent", "Mineradio-Next/1.0")
        .send().await;

    let (weather_code, temperature, apparent_temp, humidity, precipitation) = match weather_result {
        Ok(resp) => {
            if let Ok(body) = resp.json::<serde_json::Value>().await {
                let current = body.get("current").unwrap_or(&serde_json::Value::Null);
                (
                    current.get("weather_code").and_then(|v| v.as_i64()).unwrap_or(0),
                    current.get("temperature_2m").and_then(|v| v.as_f64()).unwrap_or(20.0),
                    current.get("apparent_temperature").and_then(|v| v.as_f64()).unwrap_or(20.0),
                    current.get("relative_humidity_2m").and_then(|v| v.as_u64()).unwrap_or(50) as f64,
                    current.get("precipitation").and_then(|v| v.as_f64()).unwrap_or(0.0),
                )
            } else {
                (0, 20.0, 20.0, 50.0, 0.0)
            }
        }
        Err(e) => {
            warn!("[WeatherRadio] fetch failed: {}", e);
            (0, 20.0, 20.0, 50.0, 0.0)
        }
    };

    let mood = weather_mood(weather_code, temperature, humidity);

    let weather_data = serde_json::json!({
        "provider": "open-meteo",
        "location": {
            "name": location_name,
            "country": "",
            "latitude": latitude,
            "longitude": longitude,
            "timezone": timezone,
        },
        "label": mood.get("title").and_then(|v| v.as_str()).unwrap_or("天气电台"),
        "weatherCode": weather_code,
        "temperature": temperature,
        "apparentTemperature": apparent_temp,
        "humidity": humidity,
        "precipitation": precipitation,
        "mood": mood,
    });

    // Step 3: search songs based on mood keywords
    let cookie = state.netease_cookie.read().await.clone();
    let keywords: Vec<String> = mood.get("keywords")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_else(|| vec!["孙燕姿 天黑黑".to_string(), "周杰伦 晴天".to_string()]);

    let mut all_songs: Vec<serde_json::Value> = Vec::new();
    for kw in keywords.iter().take(4) {
        if let Ok(songs) = crate::netease::api::search::cloudsearch(kw, 1, 6, 0, &cookie).await {
            if let Some(result) = songs.body.get("result") {
                if let Some(song_list) = result.get("songs").and_then(|v| v.as_array()) {
                    for s in song_list {
                        let mapped = super::discover::map_song(s);
                        all_songs.push(mapped);
                    }
                }
            }
        }
    }

    info!("[WeatherRadio] {} songs for mood '{}'", all_songs.len(),
        mood.get("key").and_then(|v| v.as_str()).unwrap_or(""));

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    HttpResponse::Ok().json(serde_json::json!({
        "ok": true,
        "weather": weather_data,
        "radio": {
            "title": mood.get("title").and_then(|v| v.as_str()).unwrap_or("天气电台"),
            "subtitle": mood.get("tagline").and_then(|v| v.as_str()).unwrap_or(""),
            "seedQueries": keywords,
            "songs": all_songs,
            "updatedAt": now_ms,
        }
    }))
}

/// Geocode a city name to (lat, lon, name).
async fn geocode_city(city: &str) -> Result<(f64, f64, String), String> {
    let client = reqwest::Client::builder().build().map_err(|e| e.to_string())?;
    let url = format!("{}?name={}&count=1&language=zh", GEOCODING_URL, urlencoding::encode(city));
    let resp = client.get(&url)
        .header("User-Agent", "Mineradio-Next/1.0")
        .send().await.map_err(|e| e.to_string())?;
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let results = body.get("results").and_then(|v| v.as_array()).ok_or("No geocoding results")?;
    let first = results.first().ok_or("Empty results")?;
    let lat = first.get("latitude").and_then(|v| v.as_f64()).ok_or("No latitude")?;
    let lon = first.get("longitude").and_then(|v| v.as_f64()).ok_or("No longitude")?;
    let name = first.get("name").and_then(|v| v.as_str()).unwrap_or(city).to_string();
    Ok((lat, lon, name))
}

/// GET /api/weather/ip-location
pub async fn handle_ip_location() -> HttpResponse {
    let client = reqwest::Client::builder().build().unwrap_or_default();
    let url = format!("{}?fields=status,message,country,regionName,city,lat,lon,timezone,query&lang=zh-CN", IP_API_URL);

    match client.get(&url)
        .header("User-Agent", "Mineradio-Next/1.0")
        .send().await
    {
        Ok(resp) => {
            if let Ok(body) = resp.json::<serde_json::Value>().await {
                if body.get("status").and_then(|v| v.as_str()) == Some("success") {
                    return HttpResponse::Ok().json(serde_json::json!({
                        "ok": true,
                        "location": {
                            "provider": "ip-api",
                            "city": body.get("city").and_then(|v| v.as_str()).unwrap_or("当前位置"),
                            "region": body.get("regionName").and_then(|v| v.as_str()).unwrap_or(""),
                            "country": body.get("country").and_then(|v| v.as_str()).unwrap_or(""),
                            "latitude": body.get("lat").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            "longitude": body.get("lon").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            "timezone": body.get("timezone").and_then(|v| v.as_str()).unwrap_or("auto"),
                            "ip": body.get("query").and_then(|v| v.as_str()).unwrap_or(""),
                        }
                    }));
                }
            }
            HttpResponse::Ok().json(serde_json::json!({
                "ok": false, "error": "IP_LOCATION_FAILED", "location": null
            }))
        }
        Err(e) => HttpResponse::Ok().json(serde_json::json!({
            "ok": false, "error": e.to_string(), "location": null
        }))
    }
}
