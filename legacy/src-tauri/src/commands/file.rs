use serde::Deserialize;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[derive(Deserialize)]
pub struct ExportPayload {
    #[serde(default)]
    pub filename: String,
    #[serde(default)]
    pub content: String,
}

fn extract_path(fp: tauri_plugin_dialog::FilePath) -> Option<PathBuf> {
    match fp {
        tauri_plugin_dialog::FilePath::Path(p) => Some(p),
        _ => None,
    }
}

#[tauri::command]
pub async fn export_json_file(
    app: AppHandle,
    payload: ExportPayload,
) -> Result<bool, String> {
    let file_path = app
        .dialog()
        .file()
        .set_file_name(&payload.filename)
        .add_filter("JSON", &["json"])
        .blocking_save_file();

    if let Some(fp) = file_path.and_then(extract_path) {
        std::fs::write(fp, payload.content).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn import_json_file(app: AppHandle) -> Result<Option<String>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .blocking_pick_file();

    if let Some(fp) = file_path.and_then(|p| extract_path(p)) {
        let content = std::fs::read_to_string(fp).map_err(|e| e.to_string())?;
        Ok(Some(content))
    } else {
        Ok(None)
    }
}
