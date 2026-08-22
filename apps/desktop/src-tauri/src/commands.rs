use crate::state::{AppSettings, PipelineState, ProcessingState};
use forge_audio::{list_input_devices, AudioDeviceInfo};
use forge_cleanup::{CleanupOptions, FormattingMode, RuleBasedCleaner};
use forge_provider_local_whisper::{HardwareDetector, HardwareRecommendation, LocalModelInfo};
use forge_security::SecretStore;
use forge_storage::HistoryRecord;
use forge_transcription::Transcript;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn get_processing_state(state: State<'_, PipelineState>) -> ProcessingState {
    *state.current_state.lock().unwrap()
}

#[tauri::command]
pub fn start_recording(app: AppHandle, state: State<'_, PipelineState>) -> Result<(), String> {
    state.start_listening(&app)
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
    settings: AppSettings,
    state: State<'_, PipelineState>,
) -> Result<(), String> {
    let mut s = state.settings.lock().unwrap();
    *s = settings;
    Ok(())
}

#[tauri::command]
pub fn get_audio_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    list_input_devices().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_groq_api_key_status() -> bool {
    SecretStore::get_secret("groq_api_key").is_ok()
}

#[tauri::command]
pub fn set_groq_api_key(api_key: String) -> Result<(), String> {
    SecretStore::set_secret("groq_api_key", &api_key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_groq_api_key() -> Result<(), String> {
    SecretStore::delete_secret("groq_api_key").map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_groq_connection(
    api_key: String,
    state: State<'_, PipelineState>,
) -> Result<bool, String> {
    state
        .groq_provider
        .test_connection(&api_key)
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

    let dummy_transcript = Transcript {
        text: record.raw_text.clone(),
        language: "en".to_string(),
        provider: record.provider_id.clone(),
        model: record.model_name.clone(),
        duration_ms: record.duration_ms,
        confidence: Some(0.95),
    };

    let options = CleanupOptions {
        mode,
        dictionary: state.settings.lock().unwrap().dictionary.clone(),
    };

    let cleaned = RuleBasedCleaner::clean(&dummy_transcript, &options).map_err(|e| e.to_string())?;
    Ok(cleaned.cleaned_text)
}

#[tauri::command]
pub fn list_models(state: State<'_, PipelineState>) -> Vec<LocalModelInfo> {
    state.model_manager.list_available_models()
}

#[tauri::command]
pub async fn download_model(
    model_id: String,
    state: State<'_, PipelineState>,
) -> Result<String, String> {
    state
        .model_manager
        .download_model(&model_id)
        .await
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
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
