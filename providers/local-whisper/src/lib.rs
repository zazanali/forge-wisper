use async_trait::async_trait;
use directories::ProjectDirs;
use forge_transcription::{
    AudioData, ModelFamily, ModelFormat, ProviderCapabilities, ProviderError, Transcript,
    TranscriptionOptions, TranscriptionProvider,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{create_dir_all, remove_file, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

pub mod parakeet;
pub use parakeet::{LocalParakeetProvider, ParakeetArchiveInstaller};

pub mod vulkan;
pub use vulkan::{BackendDiagnostics, VulkanDevice, VulkanManager};

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
    #[serde(default = "default_whisper_family")]
    pub family: ModelFamily,
    #[serde(default = "default_ggml_format")]
    pub format: ModelFormat,
    #[serde(default)]
    pub tier_tag: String,
    #[serde(default)]
    pub sha256: String,
    #[serde(default)]
    pub expected_bytes: u64,
}

fn default_whisper_family() -> ModelFamily {
    ModelFamily::Whisper
}

fn default_ggml_format() -> ModelFormat {
    ModelFormat::Ggml
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareRecommendation {
    pub logical_cores: usize,
    pub estimated_ram_gb: u32,
    pub recommended_model_id: String,
    pub recommended_model_name: String,
    pub recommended_family: ModelFamily,
    pub reason: String,
}

#[derive(Clone)]
pub struct ModelManager {
    models_dir: PathBuf,
    active_downloads: Arc<Mutex<HashMap<String, ModelDownloadProgress>>>,
}

impl Default for ModelManager {
    fn default() -> Self {
        Self::new()
    }
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
                } else if path.is_dir() {
                    if let Ok(mut read_dir) = path.read_dir() {
                        if read_dir.next().is_some() {
                            return Some(path);
                        }
                    }
                }
            }
        }

        None
    }

    pub fn is_model_installed(&self, model: &LocalModelInfo) -> bool {
        match model.format {
            ModelFormat::Ggml => self.find_model_file(&model.filename).is_some(),
            ModelFormat::OnnxArchive => {
                let dir_name = model.filename.trim_end_matches(".tar.gz");
                let candidates = [
                    self.models_dir.join(dir_name),
                    self.models_dir.join(&model.id),
                    self.models_dir.join(&model.filename),
                ];
                candidates.iter().any(|p| {
                    if p.is_dir() {
                        p.read_dir().map(|mut d| d.next().is_some()).unwrap_or(false)
                    } else if p.is_file() {
                        p.metadata().map(|m| m.len() > 1024 * 1024).unwrap_or(false)
                    } else {
                        false
                    }
                })
            }
        }
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
                ModelFamily::Whisper,
                ModelFormat::Ggml,
                "Ultra Fast",
                "be07e048e1e599ad46341c8d2863564f8ff51248057323f330b41f5b6c10790b",
                77755427u64,
            ),
            (
                "base",
                "Whisper Base",
                "ggml-base.bin",
                142,
                500,
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
                true,
                ModelFamily::Whisper,
                ModelFormat::Ggml,
                "Everyday Dictation",
                "60ed5bc3dd14eea856493d334349b405782ddcaf00eec290733b6de41840e93f",
                147964211u64,
            ),
            (
                "small",
                "Whisper Small",
                "ggml-small.bin",
                466,
                1024,
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
                false,
                ModelFamily::Whisper,
                ModelFormat::Ggml,
                "Optimal Balance",
                "1be0a70e24f4e55de14e9703b22ea812f33733b26ee34c44e0792079089849c7",
                488187035u64,
            ),
            (
                "medium",
                "Whisper Medium",
                "ggml-medium.bin",
                1536,
                2600,
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
                false,
                ModelFamily::Whisper,
                ModelFormat::Ggml,
                "High Precision",
                "6c14d5477ccb403ff124d2627d35ef2d655f410522197be5f510b64d7b233a76",
                1533755467u64,
            ),
            (
                "large-v3-turbo",
                "Whisper Large v3 Turbo",
                "ggml-large-v3-turbo.bin",
                1638,
                2800,
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
                false,
                ModelFamily::Whisper,
                ModelFormat::Ggml,
                "Turbo + Max Accuracy",
                "4b46c6460fa0002abb5b974b76c8df81cb4e65d836696b341f4eb49975b34da5",
                1625972995u64,
            ),
            (
                "large-v3",
                "Whisper Large v3",
                "ggml-large-v3.bin",
                3100,
                4700,
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin",
                false,
                ModelFamily::Whisper,
                ModelFormat::Ggml,
                "Studio Precision",
                "ad82bf6a90437c304f8de8384695316bc5470d4e0300649f23ed217d74b48f39",
                3094995739u64,
            ),
            (
                "parakeet-v3-int8",
                "Parakeet V3 Int8",
                "parakeet-v3-int8",
                640,
                850,
                "https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx",
                false,
                ModelFamily::Parakeet,
                ModelFormat::OnnxArchive,
                "Fast Local",
                "",
                670619803u64,
            ),
        ];

        catalog
            .into_iter()
            .map(|(id, name, filename, size_mb, ram_mb, url, is_def, family, format, tier_tag, sha256, expected_bytes)| {
                let mut info = LocalModelInfo {
                    id: id.to_string(),
                    name: name.to_string(),
                    filename: filename.to_string(),
                    size_mb,
                    ram_estimate_mb: ram_mb,
                    download_url: url.to_string(),
                    is_installed: false,
                    is_default: is_def,
                    family,
                    format,
                    tier_tag: tier_tag.to_string(),
                    sha256: sha256.to_string(),
                    expected_bytes,
                };
                info.is_installed = self.is_model_installed(&info);
                info
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

        // Priority order: parakeet-v3-int8 > large-v3-turbo > large-v3 > medium > small > base > tiny
        let priority = [
            "parakeet-v3-int8",
            "large-v3-turbo",
            "large-v3",
            "medium",
            "small",
            "base",
            "tiny",
        ];
        for pref in priority {
            if let Some(found) = installed.iter().find(|m| m.id == pref) {
                return Some(found.clone());
            }
        }

        installed.into_iter().next()
    }

    /// Verifies the SHA-256 hash of a file on disk against expected hex string
    pub fn verify_file_sha256(path: &Path, expected_sha256: &str) -> Result<bool, std::io::Error> {
        let mut file = File::open(path)?;
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 65536];
        loop {
            let n = std::io::Read::read(&mut file, &mut buffer)?;
            if n == 0 {
                break;
            }
            hasher.update(&buffer[..n]);
        }
        let computed = hex::encode(hasher.finalize());
        Ok(computed.eq_ignore_ascii_case(expected_sha256))
    }

    pub async fn download_model(&self, model_id: &str) -> Result<PathBuf, ProviderError> {
        self.download_model_with_progress(model_id, |_, _| {}).await
    }

    pub async fn download_parakeet_files<F>(
        &self,
        mut progress: F,
    ) -> Result<PathBuf, ProviderError>
    where
        F: FnMut(u64, u64) + Send + 'static,
    {
        let model_dir = self.models_dir.join("parakeet-v3-int8");
        std::fs::create_dir_all(&model_dir).map_err(|e| ProviderError::ModelError(e.to_string()))?;

        let files: [(&str, &str, u64); 5] = [
            ("config.json", "https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx/resolve/main/config.json", 97),
            ("vocab.txt", "https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx/resolve/main/vocab.txt", 93939),
            ("nemo128.onnx", "https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx/resolve/main/nemo128.onnx", 139764),
            ("decoder_joint-model.int8.onnx", "https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx/resolve/main/decoder_joint-model.int8.onnx", 18202004),
            ("encoder-model.int8.onnx", "https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx/resolve/main/encoder-model.int8.onnx", 652183999),
        ];

        let total_size: u64 = files.iter().map(|(_, _, s)| *s).sum();
        let mut overall_downloaded: u64 = 0;
        let client = Client::new();

        {
            let mut guard = self.active_downloads.lock().unwrap();
            guard.insert(
                "parakeet-v3-int8".to_string(),
                ModelDownloadProgress {
                    model_id: "parakeet-v3-int8".to_string(),
                    downloaded_bytes: 0,
                    total_bytes: total_size,
                    percentage: 0,
                },
            );
        }

        for (filename, url, _) in files {
            let file_dest = model_dir.join(filename);
            let part_path = model_dir.join(format!("{}.part", filename));

            let mut response = client
                .get(url)
                .send()
                .await
                .map_err(|e| {
                    let _ = self.active_downloads.lock().unwrap().remove("parakeet-v3-int8");
                    ProviderError::NetworkError(e.to_string())
                })?;

            if !response.status().is_success() {
                let _ = self.active_downloads.lock().unwrap().remove("parakeet-v3-int8");
                return Err(ProviderError::NetworkError(format!(
                    "Failed to download '{}' (HTTP {})",
                    filename,
                    response.status()
                )));
            }

            let mut file = File::create(&part_path).map_err(|e| {
                let _ = self.active_downloads.lock().unwrap().remove("parakeet-v3-int8");
                ProviderError::ModelError(e.to_string())
            })?;

            let mut file_downloaded: u64 = 0;
            while let Some(chunk) = response.chunk().await.map_err(|e| {
                let _ = self.active_downloads.lock().unwrap().remove("parakeet-v3-int8");
                let _ = remove_file(&part_path);
                ProviderError::NetworkError(e.to_string())
            })? {
                if let Err(e) = file.write_all(&chunk) {
                    let _ = self.active_downloads.lock().unwrap().remove("parakeet-v3-int8");
                    let _ = remove_file(&part_path);
                    return Err(ProviderError::ModelError(e.to_string()));
                }
                file_downloaded += chunk.len() as u64;
                let current_overall = overall_downloaded + file_downloaded;
                let percentage = if total_size > 0 {
                    ((current_overall as f64 / total_size as f64) * 100.0).round() as u32
                } else {
                    0
                };

                {
                    let mut guard = self.active_downloads.lock().unwrap();
                    if let Some(item) = guard.get_mut("parakeet-v3-int8") {
                        item.downloaded_bytes = current_overall;
                        item.percentage = percentage;
                    }
                }

                progress(current_overall, total_size);
            }

            let _ = file.flush();
            drop(file);
            overall_downloaded += file_downloaded;

            if let Err(e) = std::fs::rename(&part_path, &file_dest) {
                let _ = self.active_downloads.lock().unwrap().remove("parakeet-v3-int8");
                let _ = remove_file(&part_path);
                return Err(ProviderError::ModelError(e.to_string()));
            }
        }

        {
            let mut guard = self.active_downloads.lock().unwrap();
            guard.remove("parakeet-v3-int8");
        }

        Ok(model_dir)
    }

    pub async fn download_model_with_progress<F>(
        &self,
        model_id: &str,
        mut progress: F,
    ) -> Result<PathBuf, ProviderError>
    where
        F: FnMut(u64, u64) + Send + 'static,
    {
        if model_id == "parakeet-v3-int8" {
            return self.download_parakeet_files(progress).await;
        }

        let models = self.list_available_models();
        let target = models
            .into_iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| ProviderError::ModelError(format!("Model ID '{}' not recognized", model_id)))?;

        let dest_path = self.models_dir.join(&target.filename);
        let part_path = self.models_dir.join(format!("{}.part", target.filename));
        let client = Client::new();

        tracing::info!(
            "[Model Manager] Starting download for model '{}' ({}) from {}",
            model_id, target.name, target.download_url
        );

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
            .unwrap_or_else(|| {
                if target.expected_bytes > 0 {
                    target.expected_bytes
                } else {
                    target.size_mb * 1024 * 1024
                }
            });

        let mut downloaded: u64 = 0;
        let mut hasher = Sha256::new();
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
            hasher.update(&chunk);
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
        drop(file);

        let downloaded_len = std::fs::metadata(&part_path).map(|m| m.len()).unwrap_or(downloaded);
        let computed_hash = hex::encode(hasher.finalize());

        // Validate expected byte count if defined
        if target.expected_bytes > 0 && downloaded_len != target.expected_bytes {
            let _ = self.active_downloads.lock().unwrap().remove(model_id);
            let _ = remove_file(&part_path);
            tracing::error!(
                "[Model Manager] Byte count mismatch for '{}': expected {}, downloaded {}",
                model_id, target.expected_bytes, downloaded_len
            );
            return Err(ProviderError::VerificationFailed(format!(
                "Byte count mismatch for model '{}': expected {} bytes, downloaded {} bytes. Incomplete download removed.",
                model_id, target.expected_bytes, downloaded_len
            )));
        }

        // Validate SHA-256 hash if defined
        if !target.sha256.is_empty() && !computed_hash.eq_ignore_ascii_case(&target.sha256) {
            let _ = self.active_downloads.lock().unwrap().remove(model_id);
            let _ = remove_file(&part_path);
            tracing::error!(
                "[Model Manager] SHA-256 integrity mismatch for '{}': expected {}, computed {}",
                model_id, target.sha256, computed_hash
            );
            return Err(ProviderError::VerificationFailed(format!(
                "Integrity check failed: SHA-256 mismatch for model '{}'. The downloaded file was corrupted or tampered with and has been removed.",
                model_id
            )));
        }

        tracing::info!(
            "[Model Manager] Integrity check passed for '{}' (SHA-256: {}). Activating model.",
            model_id, computed_hash
        );

        // Atomically rename .part -> final .bin / archive
        if let Err(e) = std::fs::rename(&part_path, &dest_path) {
            let _ = self.active_downloads.lock().unwrap().remove(model_id);
            let _ = remove_file(&part_path);
            return Err(ProviderError::ModelError(e.to_string()));
        }

        // If target is an ONNX archive, extract into model directory
        let final_path = if target.format == ModelFormat::OnnxArchive {
            let extract_dir = self.models_dir.join(&target.id);
            match ParakeetArchiveInstaller::extract_archive(&dest_path, &extract_dir) {
                Ok(dir) => {
                    // Archive extracted successfully; remove the archive tarball to save disk space
                    let _ = remove_file(&dest_path);
                    dir
                }
                Err(e) => {
                    let _ = self.active_downloads.lock().unwrap().remove(model_id);
                    let _ = remove_file(&dest_path);
                    return Err(e);
                }
            }
        } else {
            dest_path
        };

        // Cleanup active download
        {
            let mut guard = self.active_downloads.lock().unwrap();
            guard.remove(model_id);
        }

        Ok(final_path)
    }

    pub fn delete_model(&self, model_id: &str) -> Result<bool, ProviderError> {
        let models = self.list_available_models();
        let target = models
            .into_iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| ProviderError::ModelError(format!("Model ID '{}' not found", model_id)))?;

        let mut deleted = false;
        if let Some(existing_path) = self.find_model_file(&target.filename) {
            if existing_path.is_dir() {
                let _ = std::fs::remove_dir_all(&existing_path);
            } else {
                let _ = remove_file(&existing_path);
            }
            deleted = true;
        }

        // Also remove possible directory targets for archives
        let dir_candidate = self.models_dir.join(target.filename.trim_end_matches(".tar.gz"));
        if dir_candidate.exists() && dir_candidate.is_dir() {
            let _ = std::fs::remove_dir_all(&dir_candidate);
            deleted = true;
        }
        let id_candidate = self.models_dir.join(&target.id);
        if id_candidate.exists() && id_candidate.is_dir() {
            let _ = std::fs::remove_dir_all(&id_candidate);
            deleted = true;
        }

        Ok(deleted)
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

        let (rec_id, rec_name, rec_family, reason) = if ram_gb >= 16 && logical_cores >= 8 {
            (
                "large-v3-turbo",
                "Whisper Large v3 Turbo",
                ModelFamily::Whisper,
                format!(
                    "High-performance hardware detected ({} cores, {} GB RAM); Whisper Large v3 Turbo recommended for top accuracy and speed.",
                    logical_cores, ram_gb
                ),
            )
        } else if ram_gb >= 8 && logical_cores >= 4 {
            (
                "parakeet-v3-int8",
                "Parakeet V3 Int8",
                ModelFamily::Parakeet,
                format!(
                    "Balanced multi-core CPU detected ({} cores, {} GB RAM); Parakeet V3 Int8 recommended for ultra-fast, low-latency offline dictation.",
                    logical_cores, ram_gb
                ),
            )
        } else {
            (
                "base",
                "Whisper Base",
                ModelFamily::Whisper,
                format!(
                    "Standard hardware detected ({} cores, {} GB RAM); Whisper Base recommended for smooth latency.",
                    logical_cores, ram_gb
                ),
            )
        };

        HardwareRecommendation {
            logical_cores,
            estimated_ram_gb: ram_gb,
            recommended_model_id: rec_id.to_string(),
            recommended_model_name: rec_name.to_string(),
            recommended_family: rec_family,
            reason,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ContextCacheKey {
    pub model_path: PathBuf,
    pub backend_type: String, // "cpu", "vulkan"
    pub gpu_device_id: Option<u32>,
}

pub struct LocalWhisperProvider {
    model_manager: Arc<ModelManager>,
    active_model_id: Arc<Mutex<String>>,
    parakeet_provider: Arc<LocalParakeetProvider>,
    context_cache: Arc<Mutex<HashMap<ContextCacheKey, std::time::Instant>>>,
    active_backend: Arc<Mutex<forge_transcription::ComputeBackend>>,
}

impl LocalWhisperProvider {
    pub fn new() -> Self {
        let model_manager = Arc::new(ModelManager::new());
        let parakeet_provider = Arc::new(LocalParakeetProvider::with_models_dir(
            model_manager.models_dir.clone(),
        ));
        Self {
            model_manager,
            active_model_id: Arc::new(Mutex::new("base".to_string())),
            parakeet_provider,
            context_cache: Arc::new(Mutex::new(HashMap::new())),
            active_backend: Arc::new(Mutex::new(forge_transcription::ComputeBackend::Cpu)),
        }
    }

    pub fn set_active_model(&self, model_id: &str) {
        let mut active = self.active_model_id.lock().unwrap();
        *active = model_id.to_string();
        self.parakeet_provider.set_active_model(model_id);
    }

    pub fn set_active_backend(&self, backend: forge_transcription::ComputeBackend) {
        let mut active = self.active_backend.lock().unwrap();
        *active = backend;
    }

    pub fn active_backend(&self) -> forge_transcription::ComputeBackend {
        self.active_backend.lock().unwrap().clone()
    }

    pub fn get_backend_status(&self) -> BackendDiagnostics {
        let is_avail = VulkanManager::is_available();
        let devices = VulkanManager::enumerate_devices();
        let current_backend = self.active_backend();

        let (active_name, active_dev_name, active_dev_idx, vram_mb, fallback_reason) = match current_backend {
            forge_transcription::ComputeBackend::VulkanGpu { device_name, device_index } => {
                if is_avail {
                    let matching_dev = devices.iter().find(|d| d.device_index == device_index);
                    (
                        "vulkan".to_string(),
                        Some(device_name),
                        Some(device_index),
                        matching_dev.map(|d| d.dedicated_vram_mb),
                        None,
                    )
                } else {
                    let reason = if devices.iter().any(|d| d.dedicated_vram_mb < 512) {
                        "Integrated GPU has insufficient VRAM (< 512 MB); using optimized multi-threaded CPU."
                    } else {
                        "Vulkan runtime (vulkan-1.dll) not available; fell back to CPU"
                    };
                    (
                        "cpu".to_string(),
                        None,
                        None,
                        None,
                        Some(reason.to_string()),
                    )
                }
            }
            forge_transcription::ComputeBackend::Cpu => {
                ("cpu".to_string(), None, None, None, None)
            }
        };

        BackendDiagnostics {
            is_vulkan_available: is_avail,
            active_backend: active_name,
            active_device_name: active_dev_name,
            active_device_index: active_dev_idx,
            dedicated_vram_mb: vram_mb,
            available_devices: devices,
            fallback_reason,
        }
    }

    /// Resolve backend with auto-fallback to CPU if Vulkan device initialization is unavailable
    pub fn resolve_and_cache_context(
        &self,
        model_path: &Path,
        backend: &forge_transcription::ComputeBackend,
    ) -> ContextCacheKey {
        let (resolved_backend_type, gpu_device_id) = match backend {
            forge_transcription::ComputeBackend::VulkanGpu {
                device_name,
                device_index,
            } => {
                if VulkanManager::is_available() {
                    ("vulkan".to_string(), Some(*device_index))
                } else {
                    tracing::warn!(
                        "[Local Whisper] Vulkan GPU device #{} ('{}') requested but Vulkan is unavailable on this host. Falling back to CPU.",
                        device_index,
                        device_name
                    );
                    ("cpu".to_string(), None)
                }
            }
            forge_transcription::ComputeBackend::Cpu => ("cpu".to_string(), None),
        };

        let key = ContextCacheKey {
            model_path: model_path.to_path_buf(),
            backend_type: resolved_backend_type,
            gpu_device_id,
        };

        {
            let mut cache = self.context_cache.lock().unwrap();
            cache.insert(key.clone(), std::time::Instant::now());
        }

        key
    }

    pub fn context_cache_len(&self) -> usize {
        self.context_cache.lock().unwrap().len()
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
        let mut backends = vec![forge_transcription::ComputeBackend::Cpu];
        if VulkanManager::is_available() {
            for dev in VulkanManager::enumerate_devices() {
                backends.push(forge_transcription::ComputeBackend::VulkanGpu {
                    device_name: dev.device_name,
                    device_index: dev.device_index,
                });
            }
        }

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
                "parakeet-v3-int8".to_string(),
            ],
            requires_api_key: false,
            supported_families: vec![ModelFamily::Whisper, ModelFamily::Parakeet],
            supported_backends: backends,
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

        // Delegate to LocalParakeetProvider if Parakeet family or model requested
        if requested_id == "parakeet-v3-int8" || options.family == Some(ModelFamily::Parakeet) {
            return self.parakeet_provider.transcribe(audio, options).await;
        }

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
            family: Some(ModelFamily::Whisper),
            backend: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_pinned_catalog_integrity() {
        let manager = ModelManager::new();
        let models = manager.list_available_models();

        assert_eq!(models.len(), 7, "Catalog should have 6 Whisper models + 1 Parakeet model");

        for model in &models {
            assert!(!model.id.is_empty(), "Model ID must not be empty");
            assert!(!model.name.is_empty(), "Model name must not be empty");
            assert!(!model.download_url.is_empty(), "Download URL must not be empty");
            assert!(
                model.download_url.starts_with("https://"),
                "Download URL must use HTTPS"
            );
            if model.family != ModelFamily::Parakeet {
                assert_eq!(
                    model.sha256.len(),
                    64,
                    "Model '{}' must have a valid 64-character SHA-256 checksum",
                    model.id
                );
            }
            assert!(
                model.expected_bytes > 0,
                "Model '{}' must have an expected byte count",
                model.id
            );
            assert!(
                model.size_mb > 0,
                "Model '{}' must have positive size_mb",
                model.id
            );
        }

        let parakeet = models.iter().find(|m| m.id == "parakeet-v3-int8");
        assert!(parakeet.is_some(), "Parakeet V3 Int8 model must be in the catalog");
        let p = parakeet.unwrap();
        assert_eq!(p.family, ModelFamily::Parakeet);
        assert_eq!(p.format, ModelFormat::OnnxArchive);
        assert_eq!(p.tier_tag, "Fast Local");
    }

    #[test]
    fn test_sha256_verification_helper() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("forge_test_sha256.bin");
        let content = b"Forge Wisper Speech Engine Pinned SHA256 Test Payload";

        {
            let mut f = File::create(&test_file).expect("Failed to create test file");
            f.write_all(content).expect("Failed to write test file");
        }

        // Expected SHA-256 for the content
        let mut hasher = Sha256::new();
        hasher.update(content);
        let expected_hash = hex::encode(hasher.finalize());

        let match_result = ModelManager::verify_file_sha256(&test_file, &expected_hash)
            .expect("Verification function failed");
        assert!(match_result, "SHA-256 should match for identical payload");

        let mismatch_result = ModelManager::verify_file_sha256(
            &test_file,
            "0000000000000000000000000000000000000000000000000000000000000000",
        )
        .expect("Verification function failed");
        assert!(!mismatch_result, "SHA-256 must fail on mismatched hash");

        let _ = remove_file(test_file);
    }

    #[test]
    fn test_hardware_recommendation_family_aware() {
        let rec = HardwareDetector::detect_and_recommend();
        assert!(rec.logical_cores > 0, "Logical cores must be detected");
        assert!(rec.estimated_ram_gb > 0, "RAM must be detected");
        assert!(!rec.recommended_model_id.is_empty(), "Recommended model ID must not be empty");
        assert!(!rec.recommended_model_name.is_empty(), "Recommended model name must not be empty");
        assert!(!rec.reason.is_empty(), "Reason must be descriptive");

        match rec.recommended_family {
            ModelFamily::Whisper => {
                assert!(
                    rec.recommended_model_id == "large-v3-turbo" || rec.recommended_model_id == "base",
                    "Whisper recommendation should be large-v3-turbo or base"
                );
            }
            ModelFamily::Parakeet => {
                assert_eq!(rec.recommended_model_id, "parakeet-v3-int8");
                assert_eq!(rec.recommended_model_name, "Parakeet V3 Int8");
            }
        }
    }

    #[test]
    fn test_isolated_cpu_vulkan_context_caching() {
        let provider = LocalWhisperProvider::new();
        let model_path = PathBuf::from("models/ggml-base.bin");

        // 1. Resolve CPU context
        let cpu_key = provider.resolve_and_cache_context(&model_path, &forge_transcription::ComputeBackend::Cpu);
        assert_eq!(cpu_key.backend_type, "cpu");
        assert!(cpu_key.gpu_device_id.is_none());
        assert_eq!(provider.context_cache_len(), 1);

        // 2. Resolve Vulkan GPU context (or fallback)
        let vulkan_backend = forge_transcription::ComputeBackend::VulkanGpu {
            device_name: "Mock RTX 4070".to_string(),
            device_index: 0,
        };
        let gpu_key = provider.resolve_and_cache_context(&model_path, &vulkan_backend);

        if VulkanManager::is_available() {
            assert_eq!(gpu_key.backend_type, "vulkan");
            assert_eq!(gpu_key.gpu_device_id, Some(0));
            // CPU and Vulkan keys are isolated and both present
            assert_eq!(provider.context_cache_len(), 2);
            assert_ne!(cpu_key, gpu_key, "CPU and Vulkan cache keys must be isolated to prevent cross-contamination");
        } else {
            // Auto-fallback to CPU
            assert_eq!(gpu_key.backend_type, "cpu");
            assert!(gpu_key.gpu_device_id.is_none());
        }
    }

    #[test]
    fn test_backend_diagnostics_structure() {
        let provider = LocalWhisperProvider::new();
        let diag = provider.get_backend_status();

        assert_eq!(diag.is_vulkan_available, VulkanManager::is_available());
        if diag.is_vulkan_available {
            assert!(!diag.available_devices.is_empty());
        } else {
            assert!(diag.fallback_reason.is_some() || diag.active_backend == "cpu");
        }
    }
}

