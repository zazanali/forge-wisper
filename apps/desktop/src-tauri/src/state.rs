use forge_audio::AudioRecorder;
use forge_cleanup::{CleanupOptions, FormattingMode, RuleBasedCleaner};
use forge_output::{OutputEngine, PasteOutcome};
use forge_provider_groq::GroqTranscriptionProvider;
use forge_provider_local_whisper::{LocalWhisperProvider, ModelManager};
use forge_security::SecretStore;
use forge_storage::{HistoryRecord, RetentionPolicy, StorageEngine};
use forge_transcription::{AudioData, ProviderError, TranscriptionOptions, TranscriptionProvider};
use forge_verification::VerificationEngine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProcessingState {
    Idle,
    Listening,
    Stopping,
    Transcribing,
    Cleaning,
    Structuring,
    Verifying,
    Inserting,
    Success,
    Cancelled,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub provider: String,            // "groq", "local-whisper"
    pub model: String,               // e.g. "whisper-large-v3-turbo" or "base"
    pub microphone: Option<String>,
    pub formatting_mode: FormattingMode,
    pub hotkey: String,              // "Control+Space"
    pub is_toggle_mode: bool,        // true = single tap toggle, false = push-to-talk
    pub retention_policy: RetentionPolicy,
    pub dictionary: HashMap<String, String>,
    #[serde(default)]
    pub snippets: HashMap<String, String>,
    #[serde(default = "default_theme")]
    pub theme: String,               // "dark", "light", "system"
    #[serde(default)]
    pub launch_at_startup: bool,
}

fn default_theme() -> String {
    "light".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        let defaults = CleanupOptions::default();
        Self {
            provider: "groq".to_string(),
            model: "whisper-large-v3-turbo".to_string(),
            microphone: None,
            formatting_mode: FormattingMode::Smart,
            hotkey: "Control+Space".to_string(),
            is_toggle_mode: true,
            retention_policy: RetentionPolicy::Days30,
            dictionary: defaults.dictionary,
            snippets: defaults.snippets,
            theme: "light".to_string(),
            launch_at_startup: false,
        }
    }
}

impl AppSettings {
    pub fn config_path() -> Option<std::path::PathBuf> {
        directories::ProjectDirs::from("com", "forge", "ForgeWisper").map(|proj| {
            let config_dir = proj.config_dir();
            let _ = std::fs::create_dir_all(config_dir);
            config_dir.join("settings.json")
        })
    }

    pub fn load() -> Self {
        if let Some(path) = Self::config_path() {
            if path.exists() {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(mut settings) = serde_json::from_str::<AppSettings>(&content) {
                        if SecretStore::get_secret("groq_api_key").is_ok() && settings.provider == "mock" {
                            settings.provider = "groq".to_string();
                            settings.model = "whisper-large-v3-turbo".to_string();
                        }
                        return settings;
                    }
                }
            }
        }
        let mut default = Self::default();
        if SecretStore::get_secret("groq_api_key").is_ok() {
            default.provider = "groq".to_string();
            default.model = "whisper-large-v3-turbo".to_string();
        }
        default
    }

    pub fn save(&self) {
        if let Some(path) = Self::config_path() {
            if let Ok(json) = serde_json::to_string_pretty(self) {
                let _ = std::fs::write(path, json);
            }
        }
    }
}

pub struct PipelineState {
    pub current_state: Mutex<ProcessingState>,
    pub current_error: Mutex<Option<String>>,
    pub settings: Mutex<AppSettings>,
    pub active_recorder: Mutex<Option<AudioRecorder>>,
    pub is_active_recording: AtomicBool,
    pub storage: StorageEngine,
    pub model_manager: Arc<ModelManager>,
    pub groq_provider: Arc<GroqTranscriptionProvider>,
    pub local_provider: Arc<LocalWhisperProvider>,
    pub last_recording_toggle: Arc<Mutex<Instant>>,
}

impl PipelineState {
    pub fn new() -> Self {
        let storage = StorageEngine::new_default().unwrap_or_else(|_| StorageEngine::new_in_memory().unwrap());
        let model_manager = Arc::new(ModelManager::new());

        let groq_provider = Arc::new(GroqTranscriptionProvider::new(|| {
            SecretStore::get_secret("groq_api_key")
                .map_err(|e| ProviderError::AuthenticationError(e.to_string()))
        }));

        let loaded_settings = AppSettings::load();

        Self {
            current_state: Mutex::new(ProcessingState::Idle),
            current_error: Mutex::new(None),
            settings: Mutex::new(loaded_settings),
            active_recorder: Mutex::new(None),
            is_active_recording: AtomicBool::new(false),
            storage,
            model_manager,
            groq_provider,
            local_provider: Arc::new(LocalWhisperProvider::new()),
            last_recording_toggle: Arc::new(Mutex::new(Instant::now())),
        }
    }

    pub fn set_state(&self, app: &AppHandle, new_state: ProcessingState, err_msg: Option<String>) {
        {
            let mut state_guard = self.current_state.lock().unwrap();
            *state_guard = new_state;
        }
        {
            let mut err_guard = self.current_error.lock().unwrap();
            *err_guard = err_msg.clone();
        }

        // Show/hide floating recorder window
        if let Some(recorder_win) = app.get_webview_window("recorder") {
            match new_state {
                ProcessingState::Listening
                | ProcessingState::Stopping
                | ProcessingState::Transcribing
                | ProcessingState::Cleaning
                | ProcessingState::Structuring
                | ProcessingState::Verifying
                | ProcessingState::Inserting => {
                    // Position at bottom center of current/primary monitor
                    if let Ok(Some(monitor)) = recorder_win.current_monitor() {
                        let screen_size = monitor.size();
                        let scale = monitor.scale_factor();
                        let win_w = (110.0 * scale) as i32;
                        let win_h = (36.0 * scale) as i32;
                        let x = monitor.position().x + (screen_size.width as i32 - win_w) / 2;
                        let y = monitor.position().y + (screen_size.height as i32 - win_h) - (60.0 * scale) as i32;
                        let _ = recorder_win.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
                    }
                    let _ = recorder_win.show();
                }
                ProcessingState::Success | ProcessingState::Error | ProcessingState::Cancelled => {
                    // Stay visible briefly then hide
                    let app_clone = app.clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;
                        if let Some(w) = app_clone.get_webview_window("recorder") {
                            let _ = w.hide();
                        }
                    });
                }
                ProcessingState::Idle => {
                    let _ = recorder_win.hide();
                }
            }
        }

        // Emit state change event to UI
        let _ = app.emit("forge://state-changed", serde_json::json!({
            "state": new_state,
            "error": err_msg
        }));
    }

    pub fn start_listening(&self, app: &AppHandle) -> Result<(), String> {
        let mut lock = self.active_recorder.lock().unwrap();
        if lock.is_some() && self.is_active_recording.load(Ordering::SeqCst) {
            return Ok(());
        }

        let mic_name = {
            let settings = self.settings.lock().unwrap();
            settings.microphone.clone()
        };

        match AudioRecorder::start(mic_name.as_deref()) {
            Ok(recorder) => {
                *lock = Some(recorder);
                self.is_active_recording.store(true, Ordering::SeqCst);
                self.set_state(app, ProcessingState::Listening, None);
                Ok(())
            }
            Err(e) => {
                *lock = None;
                self.is_active_recording.store(false, Ordering::SeqCst);
                let err_str = format!("Microphone error: {}", e);
                self.set_state(app, ProcessingState::Error, Some(err_str.clone()));
                Err(err_str)
            }
        }
    }

    pub async fn stop_and_process(&self, app: AppHandle) -> Result<String, String> {
        if !self.is_active_recording.load(Ordering::SeqCst) {
            return Ok(String::new());
        }

        self.is_active_recording.store(false, Ordering::SeqCst);
        self.set_state(&app, ProcessingState::Stopping, None);

        let recorder = {
            let mut lock = self.active_recorder.lock().unwrap();
            lock.take()
        };

        let Some(rec) = recorder else {
            self.set_state(&app, ProcessingState::Idle, None);
            return Ok(String::new());
        };

        let start_time = Instant::now();

        // 1. Encode audio
        let wav_bytes = match rec.stop_and_encode_wav() {
            Ok(bytes) => bytes,
            Err(e) => {
                let err = format!("Audio encoding failed: {}", e);
                self.set_state(&app, ProcessingState::Error, Some(err.clone()));
                return Err(err);
            }
        };

        let (provider_name, model_name, fmt_mode, dict, snippets, retention) = {
            let s = self.settings.lock().unwrap();
            (s.provider.clone(), s.model.clone(), s.formatting_mode, s.dictionary.clone(), s.snippets.clone(), s.retention_policy)
        };

        let audio_data = AudioData::new(wav_bytes, 16000, 1, start_time.elapsed().as_millis() as u64);

        // 2. Transcribe
        self.set_state(&app, ProcessingState::Transcribing, None);
        let transcript_result = match provider_name.as_str() {
            "local-whisper" => {
                self.local_provider
                    .transcribe(audio_data, TranscriptionOptions {
                        model: Some(model_name.clone()),
                        ..Default::default()
                    })
                    .await
            }
            _ => {
                // Default to Groq Cloud Whisper
                self.groq_provider
                    .transcribe(audio_data, TranscriptionOptions {
                        model: Some(model_name.clone()),
                        ..Default::default()
                    })
                    .await
            }
        };

        let raw_transcript = match transcript_result {
            Ok(t) => t,
            Err(e) => {
                let err = format!("Transcription failed: {}", e);
                self.set_state(&app, ProcessingState::Error, Some(err.clone()));
                return Err(err);
            }
        };

        // 3. Clean
        self.set_state(&app, ProcessingState::Cleaning, None);
        let cleanup_opts = CleanupOptions {
            mode: fmt_mode,
            dictionary: dict,
            snippets,
        };

        let cleaned = match RuleBasedCleaner::clean(&raw_transcript, &cleanup_opts) {
            Ok(c) => c,
            Err(e) => {
                let err = format!("Cleanup failed: {}", e);
                self.set_state(&app, ProcessingState::Error, Some(err.clone()));
                return Err(err);
            }
        };

        if cleaned.cleaned_text.trim().is_empty() {
            println!("[Forge Pipeline] Cleaned text is empty (no audible speech transcribed).");
            if start_time.elapsed().as_millis() < 400 {
                self.set_state(&app, ProcessingState::Idle, None);
            } else {
                self.set_state(
                    &app,
                    ProcessingState::Error,
                    Some("No speech detected. Speak clearly into your mic.".to_string()),
                );
            }
            return Ok(String::new());
        }

        // 4. Verify
        self.set_state(&app, ProcessingState::Verifying, None);
        let verification = VerificationEngine::verify(&cleaned.raw_text, &cleaned.cleaned_text);

        let can_paste = VerificationEngine::can_safe_paste(verification.status);
        let duration_ms = start_time.elapsed().as_millis() as u64;

        // 5. Store History
        let history_record = HistoryRecord {
            id: Uuid::new_v4().to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            app_name: None,
            provider_id: provider_name.clone(),
            model_name: model_name.clone(),
            raw_text: cleaned.raw_text.clone(),
            final_text: cleaned.cleaned_text.clone(),
            duration_ms,
            verification_status: format!("{:?}", verification.status),
        };
        let _ = self.storage.insert_record(&history_record, retention);

        // 6. Safe Paste / Output
        if can_paste {
            self.set_state(&app, ProcessingState::Inserting, None);
            #[cfg(target_os = "macos")]
            let outcome_result = {
                let (tx, rx) = tokio::sync::oneshot::channel();
                let text_to_paste = cleaned.cleaned_text.clone();
                let _ = app.run_on_main_thread(move || {
                    let outcome = OutputEngine::paste_text(&text_to_paste);
                    let _ = tx.send(outcome);
                });
                rx.await.unwrap_or(Err(forge_output::OutputError::SimulationError("Failed to execute paste on main thread".to_string())))
            };
            #[cfg(not(target_os = "macos"))]
            let outcome_result = OutputEngine::paste_text(&cleaned.cleaned_text);

            match outcome_result {
                Ok(outcome) => {
                    self.set_state(&app, ProcessingState::Success, None);
                    if outcome == PasteOutcome::CopiedToClipboardFallback {
                        let _ = app.emit("forge://toast", "Text copied to clipboard");
                    }
                }
                Err(e) => {
                    let err = format!("Paste output error: {}", e);
                    self.set_state(&app, ProcessingState::Error, Some(err.clone()));
                }
            }
        } else {
            // Verification failed: copy safely to clipboard instead of pasting
            let _ = OutputEngine::copy_to_clipboard(&cleaned.cleaned_text);
            self.set_state(&app, ProcessingState::Success, None);
            let _ = app.emit("forge://toast", "Text copied to clipboard (Verification Review)");
        }

        Ok(cleaned.cleaned_text)
    }

    pub fn cancel(&self, app: &AppHandle) {
        if self.is_active_recording.load(Ordering::SeqCst) {
            self.is_active_recording.store(false, Ordering::SeqCst);
            let mut lock = self.active_recorder.lock().unwrap();
            let _ = lock.take();
        }
        self.set_state(app, ProcessingState::Cancelled, None);
    }
}
