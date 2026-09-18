use crate::state::{AppSettings, PipelineState, ProcessingState};
use forge_audio::{list_input_devices, AudioDeviceInfo};
use forge_cleanup::{CleanupOptions, FormattingMode, RuleBasedCleaner};
use forge_provider_local_whisper::{HardwareDetector, HardwareRecommendation, LocalModelInfo};
use forge_security::SecretStore;
use forge_storage::HistoryRecord;
use forge_transcription::Transcript;
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub fn get_processing_state(state: State<'_, PipelineState>) -> ProcessingState {
    *state.current_state.lock().unwrap()
}

#[tauri::command]
pub fn start_recording(app: AppHandle, state: State<'_, PipelineState>) -> Result<(), String> {
    state.start_listening(&app)
}

#[tauri::command]
pub fn get_mic_level(state: State<'_, PipelineState>) -> f32 {
    let lock = state.active_recorder.lock().unwrap();
    if let Some(ref rec) = *lock {
        rec.get_current_rms()
    } else {
        0.0
    }
}

#[tauri::command]
pub async fn stop_recording(app: AppHandle, state: State<'_, PipelineState>) -> Result<String, String> {
    state.stop_and_process(app).await
}

#[tauri::command]
pub fn cancel_recording(app: AppHandle, state: State<'_, PipelineState>) {
    state.cancel(&app);
}

#[tauri::command]
pub fn get_settings(state: State<'_, PipelineState>) -> AppSettings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    settings: AppSettings,
    state: State<'_, PipelineState>,
) -> Result<(), String> {
    let (hotkey_changed, autostart_changed) = {
        let mut s = state.settings.lock().unwrap();
        let hotkey_changed = s.hotkey != settings.hotkey;
        let autostart_changed = s.launch_at_startup != settings.launch_at_startup;
        *s = settings.clone();
        (hotkey_changed, autostart_changed)
    };

    // 1. Offload file saving to disk asynchronously so IPC returns instantly (< 1ms)
    let settings_clone = settings.clone();
    tauri::async_runtime::spawn(async move {
        settings_clone.save();
    });

    // 2. Only invoke reg.exe process if autostart was actually changed
    if autostart_changed {
        let launch = settings.launch_at_startup;
        tauri::async_runtime::spawn(async move {
            let _ = crate::set_autostart(launch);
        });
    }

    // 3. Only re-register Windows global hotkeys if the hotkey string actually changed
    if hotkey_changed {
        let app_handle = app.clone();
        let hotkey = settings.hotkey.clone();
        tauri::async_runtime::spawn(async move {
            let _ = crate::register_global_hotkey(&app_handle, &hotkey);
        });
    }

    Ok(())
}

#[tauri::command]
pub async fn get_audio_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    tokio::task::spawn_blocking(|| list_input_devices().map_err(|e| e.to_string()))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn get_groq_api_key_status() -> bool {
    SecretStore::get_secret("groq_api_key").is_ok()
}

#[tauri::command]
pub async fn set_groq_api_key(api_key: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        SecretStore::set_secret("groq_api_key", &api_key).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_groq_api_key() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        SecretStore::delete_secret("groq_api_key").map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn test_groq_connection(
    api_key: String,
    state: State<'_, PipelineState>,
) -> Result<bool, String> {
    let key = if api_key.trim().is_empty() {
        SecretStore::get_secret("groq_api_key")
            .map_err(|_| "No API key found in Keyring. Please enter an API key.".to_string())?
    } else {
        api_key
    };
    state
        .groq_provider
        .test_connection(&key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_history(
    limit: usize,
    search: Option<String>,
    state: State<'_, PipelineState>,
) -> Result<Vec<HistoryRecord>, String> {
    state
        .storage
        .list_records(limit, search.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_history_item(
    id: String,
    state: State<'_, PipelineState>,
) -> Result<bool, String> {
    state.storage.delete_record(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_history(state: State<'_, PipelineState>) -> Result<(), String> {
    state.storage.clear_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reprocess_history_item(
    id: String,
    mode: FormattingMode,
    state: State<'_, PipelineState>,
) -> Result<String, String> {
    let records = state
        .storage
        .list_records(100, None)
        .map_err(|e| e.to_string())?;

    let record = records
        .into_iter()
        .find(|r| r.id == id)
        .ok_or_else(|| "History record not found".to_string())?;

    let (dictionary, snippets, current_lang) = {
        let s = state.settings.lock().unwrap();
        (s.dictionary.clone(), s.snippets.clone(), s.language.clone())
    };

    let source_transcript = Transcript {
        text: record.raw_text.clone(),
        language: if current_lang == "auto" { "en".to_string() } else { current_lang },
        provider: record.provider_id.clone(),
        model: record.model_name.clone(),
        duration_ms: record.duration_ms,
        confidence: Some(0.95),
    };

    let options = CleanupOptions {
        mode,
        dictionary,
        snippets,
    };

    let cleaned = RuleBasedCleaner::clean(&source_transcript, &options).map_err(|e| e.to_string())?;
    Ok(cleaned.cleaned_text)
}

#[tauri::command]
pub fn list_models(state: State<'_, PipelineState>) -> Vec<LocalModelInfo> {
    state.model_manager.list_available_models()
}

#[tauri::command]
pub async fn download_model(
    app: AppHandle,
    model_id: String,
    state: State<'_, PipelineState>,
) -> Result<String, String> {
    let app_handle = app.clone();
    let mid = model_id.clone();

    state
        .model_manager
        .download_model_with_progress(&model_id, move |downloaded, total| {
            let percentage = if total > 0 {
                ((downloaded as f64 / total as f64) * 100.0).round() as u32
            } else {
                0
            };
            let _ = app_handle.emit(
                "forge://model-download-progress",
                serde_json::json!({
                    "model_id": mid,
                    "downloaded_bytes": downloaded,
                    "total_bytes": total,
                    "percentage": percentage
                }),
            );
        })
        .await
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_active_model_downloads(
    state: State<'_, PipelineState>,
) -> std::collections::HashMap<String, forge_provider_local_whisper::ModelDownloadProgress> {
    state.model_manager.get_active_downloads()
}

#[tauri::command]
pub fn delete_model(
    model_id: String,
    state: State<'_, PipelineState>,
) -> Result<bool, String> {
    state
        .model_manager
        .delete_model(&model_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_hardware_recommendation() -> HardwareRecommendation {
    HardwareDetector::detect_and_recommend()
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_autostart_status() -> bool {
    crate::check_is_autostart_enabled()
}

#[tauri::command]
pub fn set_autostart_status(enable: bool) -> Result<(), String> {
    crate::set_autostart(enable)
}

#[tauri::command]
pub async fn check_for_updates(
    force: Option<bool>,
) -> Result<crate::updater::UpdateInfo, String> {
    crate::updater::check_github_update("zazanali/forge-wisper", force.unwrap_or(false)).await
}

#[tauri::command]
pub async fn download_and_apply_update(
    app: AppHandle,
    download_url: String,
    asset_name: Option<String>,
) -> Result<String, String> {
    let app_handle = app.clone();
    let name = asset_name.unwrap_or_else(|| "ForgeWisper-Update.exe".to_string());

    let path = crate::updater::download_update_installer(&download_url, &name, move |downloaded, total| {
        let percentage = if total > 0 {
            ((downloaded as f64 / total as f64) * 100.0).round() as u32
        } else {
            0
        };
        let _ = app_handle.emit(
            "forge://update-download-progress",
            serde_json::json!({
                "downloaded_bytes": downloaded,
                "total_bytes": total,
                "percentage": percentage
            }),
        );
    })
    .await?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn relaunch_and_install_update(installer_path: String) -> Result<(), String> {
    crate::updater::launch_installer_and_exit(&installer_path)
}
