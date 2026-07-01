use serde::Deserialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent};

#[derive(Deserialize)]
pub struct HotkeyBinding {
    pub accelerator: String,
    pub action: String,
}

#[tauri::command]
pub async fn configure_global_hotkeys(
    app: AppHandle,
    bindings: Vec<HotkeyBinding>,
) -> Result<(), String> {
    let global_shortcut = app.global_shortcut();

    // Unregister all existing shortcuts
    global_shortcut.unregister_all().map_err(|e| e.to_string())?;

    for binding in bindings {
        let action = binding.action.clone();
        let app_clone = app.clone();
        global_shortcut
            .on_shortcut(binding.accelerator.as_str(), move |_app: &AppHandle, _shortcut: &Shortcut, event: ShortcutEvent| {
                if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    let _ = app_clone.emit("mineradio-global-hotkey", serde_json::json!({
                        "action": action,
                    }));
                }
            })
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
