use tauri::AppHandle;
#[allow(deprecated)]
use tauri_plugin_shell::{ShellExt, open::Program};

#[tauri::command]
pub async fn open_update_installer(
    app: AppHandle,
    file_path: String,
) -> Result<(), String> {
    #[allow(deprecated)]
    {
        app.shell()
            .open(&file_path, None::<Program>)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn restart_app(app: AppHandle) -> Result<(), String> {
    #[allow(unreachable_code)]
    {
        app.restart();
        Ok(())
    }
}
