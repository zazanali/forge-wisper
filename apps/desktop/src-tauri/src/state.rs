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
    #[serde(default = "default_language")]
    pub language: String,            // "auto", "en", "es", "fr", "de", "ar", "ur", "hi", etc.
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
    #[serde(default = "default_output_mode")]
    pub output_mode: String,         // "realtime_stream", "progressive", "instant_paste"
    #[serde(default = "default_typing_delay")]
    pub typing_delay_ms: u64,
}

fn default_language() -> String {
    "en".to_string()
}

fn default_theme() -> String {
    "light".to_string()
}

fn default_output_mode() -> String {
    "realtime_stream".to_string()
}

fn default_typing_delay() -> u64 {
    4
}

impl Default for AppSettings {
    fn default() -> Self {
        let defaults = CleanupOptions::default();
        Self {
            provider: "groq".to_string(),
            model: "whisper-large-v3-turbo".to_string(),
            microphone: None,
            language: "en".to_string(),
            formatting_mode: FormattingMode::Smart,
            hotkey: "Control+Space".to_string(),
            is_toggle_mode: true,
            retention_policy: RetentionPolicy::Days30,
            dictionary: defaults.dictionary,
            snippets: defaults.snippets,
            theme: "light".to_string(),
            launch_at_startup: false,
            output_mode: "realtime_stream".to_string(),
            typing_delay_ms: 4,
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
                        // Default to English ("en") if unset or set to "auto" to prevent accidental Urdu/Hindi misclassification
                        if settings.language.trim().is_empty() || settings.language == "auto" {
                            settings.language = "en".to_string();
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
    pub typed_text_buffer: Arc<Mutex<String>>,
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
            typed_text_buffer: Arc::new(Mutex::new(String::new())),
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
                        let win_w = (108.0 * scale) as i32;
                        let win_h = (36.0 * scale) as i32;
                        let x = monitor.position().x + (screen_size.width as i32 - win_w) / 2;
                        let y = monitor.position().y + (screen_size.height as i32 - win_h) - (60.0 * scale) as i32;
                        let _ = recorder_win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                            width: win_w as u32,
                            height: win_h as u32,
                        }));
                        let _ = recorder_win.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
                    }
                    let _ = recorder_win.show();
                }
                ProcessingState::Success | ProcessingState::Error | ProcessingState::Cancelled => {
                    // Stay visible briefly then hide only if not recording anew
                    let app_clone = app.clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;
                        let st = app_clone.state::<PipelineState>();
                        let current = *st.current_state.lock().unwrap();
                        if matches!(
                            current,
                            ProcessingState::Success
                                | ProcessingState::Error
                                | ProcessingState::Cancelled
                                | ProcessingState::Idle
                        ) {
                            if let Some(w) = app_clone.get_webview_window("recorder") {
                                let _ = w.hide();
                            }
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

        // Reset the live typed text tracker for this new dictation session
        {
            let mut typed = self.typed_text_buffer.lock().unwrap();
            typed.clear();
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

                // Spawn live real-time intermediate streaming worker
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let mut last_processed_dur = 0.0f32;

                    while app_handle.state::<PipelineState>().is_active_recording.load(Ordering::SeqCst) {
                        tokio::time::sleep(tokio::time::Duration::from_millis(850)).await;

                        let state = app_handle.state::<PipelineState>();
                        if !state.is_active_recording.load(Ordering::SeqCst) {
                            break;
                        }

                        let (current_dur, rms) = {
                            let lock = state.active_recorder.lock().unwrap();
                            if let Some(ref rec) = *lock {
                                (rec.get_buffer_duration_secs(), rec.get_current_rms())
                            } else {
                                (0.0, 0.0)
                            }
                        };

                        // Require at least 0.7s of speech and min 0.6s growth between partial cycles
                        if current_dur < 0.7 || (current_dur - last_processed_dur) < 0.6 || rms < 0.002 {
                            continue;
                        }

                        let wav_snapshot = {
                            let lock = state.active_recorder.lock().unwrap();
                            if let Some(ref rec) = *lock {
                                rec.get_wav_snapshot().unwrap_or_default()
                            } else {
                                Vec::new()
                            }
                        };

                        if wav_snapshot.is_empty() {
                            continue;
                        }

                        let (provider_name, model_name, language_opt, fmt_mode, dict, snippets, is_stream_mode) = {
                            let s = state.settings.lock().unwrap();
                            (
                                s.provider.clone(),
                                s.model.clone(),
                                if s.language == "auto" { None } else { Some(s.language.clone()) },
                                s.formatting_mode,
                                s.dictionary.clone(),
                                s.snippets.clone(),
                                s.output_mode == "realtime_stream",
                            )
                        };

                        let audio_data = AudioData::new(wav_snapshot, 16000, 1, (current_dur * 1000.0) as u64);

                        let intermediate_res = match provider_name.as_str() {
                            "local-whisper" => {
                                state.local_provider
                                    .transcribe(audio_data, TranscriptionOptions {
                                        model: Some(model_name),
                                        language: language_opt,
                                        ..Default::default()
                                    })
                                    .await
                            }
                            _ => {
                                state.groq_provider
                                    .transcribe(audio_data, TranscriptionOptions {
                                        model: Some(model_name),
                                        language: language_opt,
                                        ..Default::default()
                                    })
                                    .await
                            }
                        };

                        if let Ok(raw_transcript) = intermediate_res {
                            if !state.is_active_recording.load(Ordering::SeqCst) {
                                break;
                            }

                            let cleanup_opts = CleanupOptions {
                                mode: fmt_mode,
                                dictionary: dict,
                                snippets,
                            };

                            let cleaned = RuleBasedCleaner::clean(&raw_transcript, &cleanup_opts)
                                .unwrap_or(forge_cleanup::CleanedTranscript {
                                    raw_text: raw_transcript.text.clone(),
                                    cleaned_text: raw_transcript.text.clone(),
                                    mode: fmt_mode,
                                    confidence: 0.95,
                                });

                            let partial_text = cleaned.cleaned_text.trim().to_string();
                            if !partial_text.is_empty() {
                                last_processed_dur = current_dur;

                                // Compute delta between what was previously typed and what is recognized now
                                let delta = {
                                    let mut typed_guard = state.typed_text_buffer.lock().unwrap();
                                    let already_typed = typed_guard.clone();
                                    let d = compute_text_delta(&already_typed, &partial_text);
                                    if !d.is_empty() {
                                        typed_guard.push_str(&d);
                                    }
                                    d
                                };

                                // Type the newly recognized words directly into whichever text box the user clicked!
                                if is_stream_mode && !delta.is_empty() {
                                    let _ = OutputEngine::type_text_delta(&delta, 2);
                                }

                                // Emit live event to UI so HUD pill and dashboard update in real-time
                                let _ = app_handle.emit("forge://live-transcript", serde_json::json!({
                                    "text": partial_text,
                                    "delta": delta,
                                    "is_partial": true
                                }));
                            }
                        }
                    }
                });

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

        // Allow in-flight audio callback samples to drain so the final spoken syllables are not clipped
        tokio::time::sleep(tokio::time::Duration::from_millis(80)).await;

        let recorder = {
            let mut lock = self.active_recorder.lock().unwrap();
            lock.take()
        };

        let Some(rec) = recorder else {
            self.set_state(&app, ProcessingState::Idle, None);
            return Ok(String::new());
        };

        let start_time = Instant::now();

        // 1. Encode complete audio
        let wav_bytes = match rec.stop_and_encode_wav() {
            Ok(bytes) => bytes,
            Err(e) => {
                let err = format!("Audio encoding failed: {}", e);
                self.set_state(&app, ProcessingState::Error, Some(err.clone()));
                return Err(err);
            }
        };

        let (provider_name, model_name, language_opt, fmt_mode, dict, snippets, retention, output_mode, char_delay_ms) = {
            let s = self.settings.lock().unwrap();
            (
                s.provider.clone(),
                s.model.clone(),
                if s.language == "auto" { None } else { Some(s.language.clone()) },
                s.formatting_mode,
                s.dictionary.clone(),
                s.snippets.clone(),
                s.retention_policy,
                s.output_mode.clone(),
                s.typing_delay_ms,
            )
        };

        let audio_data = AudioData::new(wav_bytes, 16000, 1, start_time.elapsed().as_millis() as u64);

        // 2. Transcribe complete speech
        self.set_state(&app, ProcessingState::Transcribing, None);
        let transcript_result = match provider_name.as_str() {
            "local-whisper" => {
                self.local_provider
                    .transcribe(audio_data, TranscriptionOptions {
                        model: Some(model_name.clone()),
                        language: language_opt,
                        ..Default::default()
                    })
                    .await
            }
            _ => {
                // Default to Groq Cloud Whisper
                self.groq_provider
                    .transcribe(audio_data, TranscriptionOptions {
                        model: Some(model_name.clone()),
                        language: language_opt,
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

        // Emit final transcript event
        let _ = app.emit("forge://live-transcript", serde_json::json!({
            "text": cleaned.cleaned_text,
            "is_partial": false
        }));

        // 6. Output into user's text box
        if can_paste {
            self.set_state(&app, ProcessingState::Inserting, None);

            let already_typed = {
                let guard = self.typed_text_buffer.lock().unwrap();
                guard.clone()
            };

            let outcome_result = if output_mode == "realtime_stream" && !already_typed.is_empty() {
                // In real-time stream mode: type whatever final trailing words/punctuation remain
                let final_delta = compute_final_delta(&already_typed, &cleaned.cleaned_text);
                if !final_delta.is_empty() {
                    let _ = OutputEngine::type_text_delta(&final_delta, 2);
                }
                // Also ensure full final string is safely copied to clipboard
                let _ = OutputEngine::copy_to_clipboard(&cleaned.cleaned_text);
                Ok(PasteOutcome::Pasted)
            } else if output_mode == "progressive" {
                OutputEngine::type_text_progressive(&cleaned.cleaned_text, char_delay_ms)
            } else {
                #[cfg(target_os = "macos")]
                {
                    let (tx, rx) = tokio::sync::oneshot::channel();
                    let text_to_paste = cleaned.cleaned_text.clone();
                    let _ = app.run_on_main_thread(move || {
                        let outcome = OutputEngine::paste_text(&text_to_paste);
                        let _ = tx.send(outcome);
                    });
                    rx.await.unwrap_or(Err(forge_output::OutputError::SimulationError("Failed to execute paste on main thread".to_string())))
                }
                #[cfg(not(target_os = "macos"))]
                {
                    OutputEngine::paste_text(&cleaned.cleaned_text)
                }
            };

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
            // Verification failed: copy safely to clipboard instead of typing
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

/// Computes the newly recognized word delta between what has already been typed and the new transcript
pub fn compute_text_delta(already_typed: &str, current_transcript: &str) -> String {
    let clean_current = current_transcript.trim();
    if clean_current.is_empty() {
        return String::new();
    }

    let clean_typed = already_typed.trim();
    if clean_typed.is_empty() {
        return format!("{} ", clean_current);
    }

    // 1. Direct character prefix match (covers Asian languages, punctuation, exact prefixes)
    if clean_current.starts_with(clean_typed) && clean_current.len() > clean_typed.len() {
        let delta = &clean_current[clean_typed.len()..];
        let mut delta_str = delta.to_string();
        if !already_typed.ends_with(' ') && !delta_str.starts_with(' ') && !delta_str.starts_with('\n') {
            delta_str = format!(" {}", delta_str);
        }
        if !delta_str.ends_with(' ') && !delta_str.ends_with('\n') {
            delta_str.push(' ');
        }
        return delta_str;
    }

    let typed_words: Vec<&str> = clean_typed.split_whitespace().collect();
    let current_words: Vec<&str> = clean_current.split_whitespace().collect();

    if current_words.len() <= typed_words.len() {
        return String::new();
    }

    // Check if the current words start with the typed words (case-insensitive prefix match)
    let mut matching_count = 0;
    for (t, c) in typed_words.iter().zip(current_words.iter()) {
        if t.to_lowercase() == c.to_lowercase() {
            matching_count += 1;
        } else {
            break;
        }
    }

    // If prefix matches, the remaining words are the new delta
    if matching_count == typed_words.len() {
        let delta_words = &current_words[matching_count..];
        let mut delta_str = delta_words.join(" ");
        if !already_typed.ends_with(' ') && !already_typed.ends_with('\n') {
            delta_str = format!(" {}", delta_str);
        }
        delta_str.push(' ');
        delta_str
    } else {
        // Fallback: if speech recognizer adjusted earlier words, output the new tail
        if current_words.len() > typed_words.len() {
            let delta_words = &current_words[typed_words.len()..];
            let mut delta_str = delta_words.join(" ");
            if !already_typed.ends_with(' ') && !already_typed.ends_with('\n') {
                delta_str = format!(" {}", delta_str);
            }
            delta_str.push(' ');
            delta_str
        } else {
            String::new()
        }
    }
}

/// Computes trailing delta on final speech completion
pub fn compute_final_delta(already_typed: &str, final_transcript: &str) -> String {
    let clean_final = final_transcript.trim();
    if clean_final.is_empty() {
        return String::new();
    }

    let clean_typed = already_typed.trim();
    if clean_typed.is_empty() {
        return clean_final.to_string();
    }

    // 1. Direct character prefix match
    if clean_final.starts_with(clean_typed) {
        let delta = &clean_final[clean_typed.len()..];
        return delta.to_string();
    }

    // 2. Case-insensitive character prefix check
    let lower_final = clean_final.to_lowercase();
    let lower_typed = clean_typed.to_lowercase();
    if lower_final.starts_with(&lower_typed) {
        let byte_offset = clean_typed.len().min(clean_final.len());
        if clean_final.is_char_boundary(byte_offset) {
            return clean_final[byte_offset..].to_string();
        }
    }

    let typed_words: Vec<&str> = clean_typed.split_whitespace().collect();
    let final_words: Vec<&str> = clean_final.split_whitespace().collect();

    if final_words.len() > typed_words.len() {
        let delta_words = &final_words[typed_words.len()..];
        let mut delta_str = delta_words.join(" ");
        if !already_typed.ends_with(' ') && !already_typed.ends_with('\n') && !delta_str.starts_with('\n') {
            delta_str = format!(" {}", delta_str);
        }
        delta_str
    } else {
        // If final transcript ends with punctuation, append it if missing from typed
        if let Some(last_char) = clean_final.chars().last() {
            if (last_char == '.' || last_char == '?' || last_char == '!' || last_char == ',' || last_char == '\n')
                && !clean_typed.ends_with(last_char)
            {
                return last_char.to_string();
            }
        }
        String::new()
    }
}
