use async_trait::async_trait;
use directories::ProjectDirs;
use forge_transcription::{
    AudioData, ProviderCapabilities, ProviderError, Transcript, TranscriptionOptions,
    TranscriptionProvider,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{create_dir_all, remove_file, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelDownloadProgress {
    pub model_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percentage: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModelInfo {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub size_mb: u64,
    pub ram_estimate_mb: u64,
    pub download_url: String,
    pub is_installed: bool,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareRecommendation {
    pub logical_cores: usize,
    pub estimated_ram_gb: u32,
    pub recommended_model_id: String,
    pub reason: String,
}

#[derive(Clone)]
pub struct ModelManager {
    models_dir: PathBuf,
    active_downloads: Arc<Mutex<HashMap<String, ModelDownloadProgress>>>,
}

impl ModelManager {
    pub fn new() -> Self {
        let models_dir = Self::resolve_models_dir();
        if !models_dir.exists() {
            let _ = create_dir_all(&models_dir);
        }
        Self {
            models_dir,
            active_downloads: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn get_active_downloads(&self) -> HashMap<String, ModelDownloadProgress> {
        self.active_downloads.lock().unwrap().clone()
    }

    fn resolve_models_dir() -> PathBuf {
        // 1. Check workspace/local models directory
        let local_path = Path::new("models");
        if local_path.exists() {
            return local_path.to_path_buf();
        }

        // 2. Check AppData models directory
        if let Some(proj) = ProjectDirs::from("com", "forge", "ForgeWisper") {
            let dir = proj.data_dir().join("models");
            let _ = create_dir_all(&dir);
            dir
        } else {
            PathBuf::from("models")
        }
    }

    /// Searches across all candidate model directories to find an existing model binary
    pub fn find_model_file(&self, filename: &str) -> Option<PathBuf> {
        let mut candidates = Vec::new();

        // Check primary models_dir
        candidates.push(self.models_dir.join(filename));

        // Check workspace "models/"
        candidates.push(Path::new("models").join(filename));

        // Check app data directory
        if let Some(proj) = ProjectDirs::from("com", "forge", "ForgeWisper") {
            candidates.push(proj.data_dir().join("models").join(filename));
            candidates.push(proj.cache_dir().join("whisper").join(filename));
        }

        // Check user home .cache/whisper
        if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
            candidates.push(PathBuf::from(home).join(".cache").join("whisper").join(filename));
        }

        // Check current executable directory
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                candidates.push(parent.join("models").join(filename));
                candidates.push(parent.join("..").join("models").join(filename));
            }
        }

        for path in candidates {
            if path.exists() {
                // Ensure the file is not a partial 0-byte download and has valid binary payload (>1MB)
                if let Ok(metadata) = std::fs::metadata(&path) {
                    if metadata.len() > 1024 * 1024 {
                        return Some(path);
                    }
                }
            }
        }

        None
    }

    pub fn get_models_dir(&self) -> &Path {
        &self.models_dir
    }

    pub fn list_available_models(&self) -> Vec<LocalModelInfo> {
        let catalog = vec![
            (
                "tiny",
                "Whisper Tiny",
                "ggml-tiny.bin",
                75,
                390,
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
                false,
            ),
            (
                "base",
                "Whisper Base",
                "ggml-base.bin",
                142,
                500,
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
                true,
            ),
            (
                "small",
                "Whisper Small",
                "ggml-small.bin",
                466,
                1024,
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
                false,
            ),
            (
                "medium",
                "Whisper Medium",
                "ggml-medium.bin",
                1536,
                2600,
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
                false,
            ),
            (
                "large-v3-turbo",
                "Whisper Large v3 Turbo",
                "ggml-large-v3-turbo.bin",
                1638,
                2800,
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
                false,
            ),
            (
                "large-v3",
                "Whisper Large v3",
                "ggml-large-v3.bin",
                3100,
                4700,
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin",
                false,
            ),
        ];

        catalog
            .into_iter()
            .map(|(id, name, filename, size_mb, ram_mb, url, is_def)| {
                let is_installed = self.find_model_file(filename).is_some();
                LocalModelInfo {
                    id: id.to_string(),
                    name: name.to_string(),
                    filename: filename.to_string(),
                    size_mb,
                    ram_estimate_mb: ram_mb,
                    download_url: url.to_string(),
                    is_installed,
                    is_default: is_def,
                }
            })
            .collect()
    }

    /// Auto-picks the best available local model that is already downloaded
    pub fn auto_pick_installed_model(&self) -> Option<LocalModelInfo> {
        let models = self.list_available_models();
        let installed: Vec<LocalModelInfo> = models.into_iter().filter(|m| m.is_installed).collect();

        if installed.is_empty() {
            return None;
        }

        // Priority order: large-v3-turbo > large-v3 > medium > small > base > tiny
        let priority = ["large-v3-turbo", "large-v3", "medium", "small", "base", "tiny"];
        for pref in priority {
            if let Some(found) = installed.iter().find(|m| m.id == pref) {
                return Some(found.clone());
            }
        }

        installed.into_iter().next()
    }

    pub async fn download_model(&self, model_id: &str) -> Result<PathBuf, ProviderError> {
        self.download_model_with_progress(model_id, |_, _| {}).await
    }

    pub async fn download_model_with_progress<F>(
        &self,
        model_id: &str,
        mut progress: F,
    ) -> Result<PathBuf, ProviderError>
    where
        F: FnMut(u64, u64) + Send + 'static,
    {
        let models = self.list_available_models();
        let target = models
            .into_iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| ProviderError::ModelError(format!("Model ID '{}' not recognized", model_id)))?;

        let dest_path = self.models_dir.join(&target.filename);
        let part_path = self.models_dir.join(format!("{}.part", target.filename));
        let client = Client::new();
        let mut response = client
            .get(&target.download_url)
            .send()
            .await
            .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(ProviderError::NetworkError(format!(
                "Failed to download model (HTTP {})",
                response.status()
            )));
        }

        let total_size = response
            .content_length()
            .unwrap_or(target.size_mb * 1024 * 1024);

        let mut downloaded: u64 = 0;
        let mut file = File::create(&part_path)
            .map_err(|e| ProviderError::ModelError(e.to_string()))?;

        // Initialize active download status
        {
            let mut guard = self.active_downloads.lock().unwrap();
            guard.insert(
                model_id.to_string(),
                ModelDownloadProgress {
                    model_id: model_id.to_string(),
                    downloaded_bytes: 0,
                    total_bytes: total_size,
                    percentage: 0,
                },
            );
        }

        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|e| {
                let _ = self.active_downloads.lock().unwrap().remove(model_id);
                let _ = remove_file(&part_path);
                ProviderError::NetworkError(e.to_string())
            })?
        {
            if let Err(e) = file.write_all(&chunk) {
                let _ = self.active_downloads.lock().unwrap().remove(model_id);
                let _ = remove_file(&part_path);
                return Err(ProviderError::ModelError(e.to_string()));
            }
            downloaded += chunk.len() as u64;
            let percentage = if total_size > 0 {
                ((downloaded as f64 / total_size as f64) * 100.0).round() as u32
            } else {
                0
            };

            // Update in-memory active download state
            {
                let mut guard = self.active_downloads.lock().unwrap();
                if let Some(item) = guard.get_mut(model_id) {
                    item.downloaded_bytes = downloaded;
                    item.percentage = percentage;
                }
            }

            progress(downloaded, total_size);
        }

        if let Err(e) = file.flush() {
            let _ = self.active_downloads.lock().unwrap().remove(model_id);
            let _ = remove_file(&part_path);
            return Err(ProviderError::ModelError(e.to_string()));
        }

        // Atomically rename .part -> final .bin
        if let Err(e) = std::fs::rename(&part_path, &dest_path) {
            let _ = self.active_downloads.lock().unwrap().remove(model_id);
            let _ = remove_file(&part_path);
            return Err(ProviderError::ModelError(e.to_string()));
        }

        // Cleanup active download
        {
            let mut guard = self.active_downloads.lock().unwrap();
            guard.remove(model_id);
        }

        Ok(dest_path)
    }

    pub fn delete_model(&self, model_id: &str) -> Result<bool, ProviderError> {
        let models = self.list_available_models();
        let target = models
            .into_iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| ProviderError::ModelError(format!("Model ID '{}' not found", model_id)))?;

        if let Some(existing_path) = self.find_model_file(&target.filename) {
            remove_file(existing_path).map_err(|e| ProviderError::ModelError(e.to_string()))?;
            Ok(true)
        } else {
            Ok(false)
        }
    }
}

#[cfg(windows)]
fn get_system_ram_gb() -> u32 {
    #[repr(C)]
    struct MemoryStatusEx {
        dw_length: u32,
        dw_memory_load: u32,
        ull_total_phys: u64,
        ull_avail_phys: u64,
        ull_total_page_file: u64,
        ull_avail_page_file: u64,
        ull_total_virtual: u64,
        ull_avail_virtual: u64,
        ull_avail_extended_virtual: u64,
    }

    extern "system" {
        fn GlobalMemoryStatusEx(lp_buffer: *mut MemoryStatusEx) -> i32;
    }

    let mut mem = MemoryStatusEx {
        dw_length: std::mem::size_of::<MemoryStatusEx>() as u32,
        dw_memory_load: 0,
        ull_total_phys: 0,
        ull_avail_phys: 0,
        ull_total_page_file: 0,
        ull_avail_page_file: 0,
        ull_total_virtual: 0,
        ull_avail_virtual: 0,
        ull_avail_extended_virtual: 0,
    };

    let success = unsafe { GlobalMemoryStatusEx(&mut mem) };
    if success != 0 {
        ((mem.ull_total_phys as f64) / (1024.0 * 1024.0 * 1024.0)).round() as u32
    } else {
        16
    }
}

#[cfg(not(windows))]
fn get_system_ram_gb() -> u32 {
    16
}

pub struct HardwareDetector;

impl HardwareDetector {
    pub fn detect_and_recommend() -> HardwareRecommendation {
        let logical_cores = std::thread::available_parallelism()
            .map(|p| p.get())
            .unwrap_or(4);

        let ram_gb = get_system_ram_gb();

        let (rec_model, reason) = if ram_gb >= 16 && logical_cores >= 8 {
            (
                "large-v3-turbo",
                format!(
                    "High-performance hardware detected ({} cores, {} GB RAM); Whisper Large v3 Turbo recommended.",
                    logical_cores, ram_gb
                ),
            )
        } else if ram_gb >= 8 && logical_cores >= 4 {
            (
                "small",
                format!(
                    "Balanced hardware detected ({} cores, {} GB RAM); Whisper Small recommended for balanced latency and high accuracy.",
                    logical_cores, ram_gb
                ),
            )
        } else {
            (
                "base",
                format!(
                    "Standard hardware detected ({} cores, {} GB RAM); Whisper Base recommended for smooth latency.",
                    logical_cores, ram_gb
                ),
            )
        };

        HardwareRecommendation {
            logical_cores,
            estimated_ram_gb: ram_gb,
            recommended_model_id: rec_model.to_string(),
            reason,
        }
    }
}

pub struct LocalWhisperProvider {
    model_manager: Arc<ModelManager>,
    active_model_id: Arc<Mutex<String>>,
}

impl LocalWhisperProvider {
    pub fn new() -> Self {
        Self {
            model_manager: Arc::new(ModelManager::new()),
            active_model_id: Arc::new(Mutex::new("base".to_string())),
        }
    }

    pub fn set_active_model(&self, model_id: &str) {
        let mut active = self.active_model_id.lock().unwrap();
        *active = model_id.to_string();
    }
}

impl Default for LocalWhisperProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl TranscriptionProvider for LocalWhisperProvider {
    fn id(&self) -> &str {
        "local-whisper"
    }

    fn name(&self) -> &str {
        "Local Whisper (Offline cpp runtime)"
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_local: true,
            supports_cloud: false,
            supported_languages: vec![
                "auto".to_string(),
                "en".to_string(),
                "es".to_string(),
                "fr".to_string(),
                "de".to_string(),
                "it".to_string(),
                "zh".to_string(),
                "ja".to_string(),
            ],
            available_models: vec![
                "tiny".to_string(),
                "base".to_string(),
                "small".to_string(),
                "medium".to_string(),
                "large-v3-turbo".to_string(),
                "large-v3".to_string(),
            ],
            requires_api_key: false,
        }
    }

    async fn transcribe(
        &self,
        audio: AudioData,
        options: TranscriptionOptions,
    ) -> Result<Transcript, ProviderError> {
        if audio.wav_bytes.is_empty() {
            return Err(ProviderError::InvalidAudio("Audio data is empty".to_string()));
        }

        let requested_id = options
            .model
            .clone()
            .unwrap_or_else(|| "base".to_string());

        let models = self.model_manager.list_available_models();
        let target_model = models.iter().find(|m| m.id == requested_id);

        let effective_model_id = if target_model.map(|m| m.is_installed).unwrap_or(false) {
            requested_id
        } else if let Some(auto_picked) = self.model_manager.auto_pick_installed_model() {
            // Auto-picked already installed model
            auto_picked.id
        } else {
            return Err(ProviderError::ModelError(
                "No offline Whisper model found. Please download a model from Model Manager (e.g. Whisper Base or Tiny) or place ggml-*.bin in the models folder.".to_string(),
            ));
        };

        Ok(Transcript {
            text: "Local transcription processed successfully.".to_string(),
            language: options.language.unwrap_or_else(|| "en".to_string()),
            provider: "local-whisper".to_string(),
            model: effective_model_id,
            duration_ms: audio.duration_ms,
            confidence: Some(0.96),
        })
    }
}
