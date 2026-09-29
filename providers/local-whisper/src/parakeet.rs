use async_trait::async_trait;
use flate2::read::GzDecoder;
use forge_transcription::{
    AudioData, ComputeBackend, ModelFamily, ProviderCapabilities, ProviderError, Transcript,
    TranscriptionOptions, TranscriptionProvider,
};
use reqwest::Client;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{create_dir_all, remove_dir_all, remove_file, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tar::Archive;
use tracing::{error, info, warn};
use transcribe_rs::engines::parakeet::{
    ParakeetEngine, ParakeetInferenceParams, ParakeetModelParams, TimestampGranularity,
};
use transcribe_rs::TranscriptionEngine;

#[derive(Debug, thiserror::Error)]
pub enum ParakeetInstallError {
    #[error("I/O error during archive extraction: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Corrupt archive: {0}")]
    CorruptArchive(String),

    #[error("Potential directory traversal detected in archive entry: {0}")]
    PathTraversal(String),

    #[error("Extraction verification failed: missing expected model artifacts")]
    MissingArtifacts,
}

pub struct ParakeetArchiveInstaller;

impl ParakeetArchiveInstaller {
    /// Extracts a `.tar.gz` archive into `target_dir`, skipping macOS archive metadata
    /// entries (e.g., `__MACOSX`, `._*`, `.DS_Store`) and protecting against path traversal.
    pub fn extract_archive(archive_path: &Path, target_dir: &Path) -> Result<PathBuf, ProviderError> {
        info!(
            "[Parakeet Installer] Extracting archive '{}' into '{}'...",
            archive_path.display(),
            target_dir.display()
        );

        if !archive_path.exists() {
            let msg = format!("Archive file '{}' does not exist", archive_path.display());
            error!("[Parakeet Installer] {}", msg);
            return Err(ProviderError::ModelError(msg));
        }

        if !target_dir.exists() {
            create_dir_all(target_dir).map_err(|e| {
                let msg = format!(
                    "Failed to create target directory '{}': {}. Check filesystem permissions.",
                    target_dir.display(),
                    e
                );
                error!("[Parakeet Installer] {}", msg);
                ProviderError::ModelError(msg)
            })?;
        }

        let tar_file = File::open(archive_path).map_err(|e| {
            let msg = format!("Failed to open archive file: {}", e);
            error!("[Parakeet Installer] {}", msg);
            ProviderError::ModelError(msg)
        })?;

        let tar_gz = GzDecoder::new(tar_file);
        let mut archive = Archive::new(tar_gz);

        let entries = archive.entries().map_err(|e| {
            let msg = format!(
                "Archive is corrupt or not in valid gzip format ({}). Please re-download.",
                e
            );
            error!("[Parakeet Installer] {}", msg);
            ProviderError::ModelError(msg)
        })?;

        let mut extracted_count = 0;
        let mut skipped_macos_count = 0;

        for entry_res in entries {
            let mut entry = match entry_res {
                Ok(e) => e,
                Err(e) => {
                    let msg = format!("Corrupt entry found in archive: {}", e);
                    error!("[Parakeet Installer] {}", msg);
                    let _ = remove_dir_all(target_dir);
                    return Err(ProviderError::ModelError(msg));
                }
            };

            let entry_path = match entry.path() {
                Ok(p) => p.into_owned(),
                Err(e) => {
                    let msg = format!("Invalid path inside archive entry: {}", e);
                    error!("[Parakeet Installer] {}", msg);
                    let _ = remove_dir_all(target_dir);
                    return Err(ProviderError::ModelError(msg));
                }
            };

            // 1. Skip macOS archive metadata entries
            let path_str = entry_path.to_string_lossy();
            let is_macos_meta = path_str.contains("__MACOSX")
                || path_str.contains(".DS_Store")
                || entry_path
                    .file_name()
                    .map(|f| f.to_string_lossy().starts_with("._"))
                    .unwrap_or(false);

            if is_macos_meta {
                skipped_macos_count += 1;
                continue;
            }

            // 2. Prevent directory traversal (Tar-Slip & absolute path vulnerability protection)
            if entry_path.is_absolute() || entry_path.has_root() {
                let msg = format!(
                    "Absolute path detected in archive entry '{}' (potential Tar-Slip attack)",
                    path_str
                );
                error!("[Parakeet Installer] Security alert: {}", msg);
                let _ = remove_dir_all(target_dir);
                return Err(ProviderError::VerificationFailed(msg));
            }

            for component in entry_path.components() {
                match component {
                    std::path::Component::ParentDir
                    | std::path::Component::RootDir
                    | std::path::Component::Prefix(_) => {
                        let msg = format!(
                            "Directory traversal attack detected in archive entry '{}'",
                            path_str
                        );
                        error!("[Parakeet Installer] Security alert: {}", msg);
                        let _ = remove_dir_all(target_dir);
                        return Err(ProviderError::VerificationFailed(msg));
                    }
                    _ => {}
                }
            }

            let entry_type = entry.header().entry_type();
            // Reject symbolic and hard links to prevent arbitrary filesystem link attacks
            if entry_type.is_symlink() || entry_type.is_hard_link() {
                let msg = format!(
                    "Symlink or hardlink entry forbidden in model archive: '{}'",
                    path_str
                );
                error!("[Parakeet Installer] Security alert: {}", msg);
                let _ = remove_dir_all(target_dir);
                return Err(ProviderError::VerificationFailed(msg));
            }

            // 3. Unpack into target directory and verify destination path boundaries
            let out_path = target_dir.join(&entry_path);
            if !out_path.starts_with(target_dir) {
                let msg = format!(
                    "Resolved path '{}' escapes target directory '{}'",
                    out_path.display(),
                    target_dir.display()
                );
                error!("[Parakeet Installer] Security alert: {}", msg);
                let _ = remove_dir_all(target_dir);
                return Err(ProviderError::VerificationFailed(msg));
            }

            if let Some(parent) = out_path.parent() {
                if !parent.exists() {
                    let _ = create_dir_all(parent);
                }
            }

            if entry_type.is_dir() {
                let _ = create_dir_all(&out_path);
            } else if entry_type.is_file() {
                if let Err(e) = entry.unpack(&out_path) {
                    let msg = format!(
                        "Failed to write extracted file '{}': {}. Check disk space and permissions.",
                        out_path.display(),
                        e
                    );
                    error!("[Parakeet Installer] {}", msg);
                    let _ = remove_dir_all(target_dir);
                    return Err(ProviderError::ModelError(msg));
                }
                extracted_count += 1;
            } else {
                warn!(
                    "[Parakeet Installer] Skipping non-standard entry type in archive: '{}'",
                    path_str
                );
            }
        }

        info!(
            "[Parakeet Installer] Extraction complete: {} files extracted, {} macOS metadata entries skipped.",
            extracted_count, skipped_macos_count
        );

        if extracted_count == 0 {
            warn!("[Parakeet Installer] Extraction produced zero files.");
        }

        Ok(target_dir.to_path_buf())
    }

    /// Downloads and extracts a Parakeet model archive in streaming mode with progress reporting
    pub async fn download_and_extract_streaming<F>(
        download_url: &str,
        archive_path: &Path,
        dest_dir: &Path,
        expected_sha256: &str,
        expected_bytes: u64,
        mut progress: F,
    ) -> Result<PathBuf, ProviderError>
    where
        F: FnMut(u64, u64) + Send + 'static,
    {
        let client = Client::new();
        let mut response = client
            .get(download_url)
            .send()
            .await
            .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(ProviderError::NetworkError(format!(
                "Failed to download Parakeet archive (HTTP {})",
                response.status()
            )));
        }

        let total_size = response
            .content_length()
            .unwrap_or(expected_bytes);

        let part_path = archive_path.with_extension("tar.gz.part");
        let mut file = File::create(&part_path).map_err(|e| {
            ProviderError::ModelError(format!("Failed to create temporary archive file: {}", e))
        })?;

        let mut downloaded: u64 = 0;
        let mut hasher = Sha256::new();

        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|e| {
                let _ = remove_file(&part_path);
                ProviderError::NetworkError(e.to_string())
            })?
        {
            hasher.update(&chunk);
            if let Err(e) = file.write_all(&chunk) {
                let _ = remove_file(&part_path);
                return Err(ProviderError::ModelError(format!("Write error: {}", e)));
            }
            downloaded += chunk.len() as u64;
            progress(downloaded, total_size);
        }

        if let Err(e) = file.flush() {
            let _ = remove_file(&part_path);
            return Err(ProviderError::ModelError(format!("Flush error: {}", e)));
        }
        drop(file);

        // Verification: byte count
        let downloaded_len = std::fs::metadata(&part_path).map(|m| m.len()).unwrap_or(downloaded);
        if expected_bytes > 0 && downloaded_len != expected_bytes {
            let _ = remove_file(&part_path);
            let msg = format!(
                "Byte count mismatch for Parakeet archive: expected {} bytes, downloaded {} bytes.",
                expected_bytes, downloaded_len
            );
            error!("[Parakeet Installer] {}", msg);
            return Err(ProviderError::VerificationFailed(msg));
        }

        // Verification: SHA-256
        let computed_hash = hex::encode(hasher.finalize());
        if !expected_sha256.is_empty() && !computed_hash.eq_ignore_ascii_case(expected_sha256) {
            let _ = remove_file(&part_path);
            let msg = format!(
                "SHA-256 checksum mismatch for Parakeet archive: expected {}, computed {}.",
                expected_sha256, computed_hash
            );
            error!("[Parakeet Installer] {}", msg);
            return Err(ProviderError::VerificationFailed(msg));
        }

        // Atomic rename .part -> final .tar.gz
        if let Err(e) = std::fs::rename(&part_path, archive_path) {
            let _ = remove_file(&part_path);
            return Err(ProviderError::ModelError(format!("Rename failed: {}", e)));
        }

        // Extract archive into destination directory
        let extract_res = Self::extract_archive(archive_path, dest_dir);

        // Clean up downloaded .tar.gz archive after verified extraction to conserve disk space
        if extract_res.is_ok() {
            let _ = remove_file(archive_path);
        }

        extract_res
    }
}

pub struct LocalParakeetProvider {
    models_dir: PathBuf,
    active_model_id: Arc<Mutex<String>>,
    engine_cache: Arc<Mutex<HashMap<PathBuf, Arc<Mutex<ParakeetEngine>>>>>,
}

impl LocalParakeetProvider {
    pub fn new() -> Self {
        let base_dir = directories::ProjectDirs::from("com", "forge", "ForgeWisper")
            .map(|dirs| dirs.data_dir().join("models"))
            .unwrap_or_else(|| PathBuf::from("models"));
        Self::with_models_dir(base_dir)
    }

    pub fn with_models_dir(models_dir: PathBuf) -> Self {
        Self {
            models_dir,
            active_model_id: Arc::new(Mutex::new("parakeet-v3-int8".to_string())),
            engine_cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn models_dir(&self) -> &Path {
        &self.models_dir
    }

    pub fn active_model_id(&self) -> String {
        self.active_model_id.lock().unwrap().clone()
    }

    pub fn set_active_model(&self, model_id: &str) {
        let mut active = self.active_model_id.lock().unwrap();
        *active = model_id.to_string();
    }

    pub fn clear_cache(&self) {
        if let Ok(mut cache) = self.engine_cache.lock() {
            cache.clear();
        }
    }

    pub fn cached_models_count(&self) -> usize {
        self.engine_cache.lock().map(|c| c.len()).unwrap_or(0)
    }

    pub fn get_or_load_engine(
        &self,
        model_dir: &Path,
    ) -> Result<Arc<Mutex<ParakeetEngine>>, ProviderError> {
        // 1. Fast-path: Check per-model ONNX engine cache
        {
            let cache = self.engine_cache.lock().map_err(|_| {
                ProviderError::InternalError("Engine cache lock poisoned".to_string())
            })?;
            if let Some(engine) = cache.get(model_dir) {
                return Ok(Arc::clone(engine));
            }
        }

        // 2. Validate directory existence
        if !model_dir.exists() {
            let msg = format!(
                "Parakeet model directory not found at '{}'. Please download 'parakeet-v3-int8' via the Model Manager.",
                model_dir.display()
            );
            error!("[Parakeet Provider] {}", msg);
            return Err(ProviderError::ModelError(msg));
        }

        info!(
            "[Parakeet Provider] Initializing ONNX Parakeet engine for model at '{}'...",
            model_dir.display()
        );

        let mut engine = ParakeetEngine::new();
        engine
            .load_model_with_params(model_dir, ParakeetModelParams::int8())
            .map_err(|e| {
                let msg = format!(
                    "Failed to initialize Parakeet ONNX session from '{}': {}. Verify model files are complete.",
                    model_dir.display(),
                    e
                );
                error!("[Parakeet Provider] {}", msg);
                ProviderError::ModelError(msg)
            })?;

        let engine_arc = Arc::new(Mutex::new(engine));

        // 3. Cache the newly initialized engine
        {
            let mut cache = self.engine_cache.lock().map_err(|_| {
                ProviderError::InternalError("Engine cache lock poisoned".to_string())
            })?;
            cache.insert(model_dir.to_path_buf(), Arc::clone(&engine_arc));
        }

        info!(
            "[Parakeet Provider] Successfully initialized and cached ONNX engine for '{}'",
            model_dir.display()
        );
        Ok(engine_arc)
    }
}

impl Default for LocalParakeetProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl TranscriptionProvider for LocalParakeetProvider {
    fn id(&self) -> &str {
        "local-parakeet"
    }

    fn name(&self) -> &str {
        "Local Parakeet V3 Int8 (ONNX CPU)"
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_local: true,
            supports_cloud: false,
            supported_languages: vec!["en".to_string()],
            available_models: vec!["parakeet-v3-int8".to_string()],
            requires_api_key: false,
            supported_families: vec![ModelFamily::Parakeet],
            supported_backends: vec![ComputeBackend::Cpu],
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
            .unwrap_or_else(|| self.active_model_id());

        let model_dir = self.models_dir.join(&requested_id);
        if !model_dir.exists() {
            return Err(ProviderError::ModelError(format!(
                "Parakeet model '{}' is not installed at '{}'. Please download it via the Model Manager.",
                requested_id,
                model_dir.display()
            )));
        }

        // Decode audio samples to 16kHz mono f32 in [-1.0, 1.0]
        let cursor = std::io::Cursor::new(&audio.wav_bytes);
        let mono_samples = match hound::WavReader::new(cursor) {
            Ok(reader) => {
                let spec = reader.spec();
                let samples: Vec<f32> = match spec.sample_format {
                    hound::SampleFormat::Int => {
                        let max_val = match spec.bits_per_sample {
                            16 => i16::MAX as f32,
                            24 => 8388607.0,
                            32 => i32::MAX as f32,
                            8 => i8::MAX as f32,
                            _ => 32767.0,
                        };
                        reader
                            .into_samples::<i32>()
                            .filter_map(|s| s.ok())
                            .map(|s| s as f32 / max_val)
                            .collect()
                    }
                    hound::SampleFormat::Float => {
                        reader
                            .into_samples::<f32>()
                            .filter_map(|s| s.ok())
                            .collect()
                    }
                };
                let channels = spec.channels as usize;
                if channels > 1 {
                    samples
                        .chunks(channels)
                        .map(|chunk| chunk.iter().sum::<f32>() / channels as f32)
                        .collect()
                } else {
                    samples
                }
            }
            Err(_) => {
                // If not a standard WAV header, attempt reading as raw 16-bit PCM little-endian
                if audio.wav_bytes.len().is_multiple_of(2) {
                    #[allow(clippy::chunks_exact_to_as_chunks)]
                    audio
                        .wav_bytes
                        .chunks_exact(2)
                        .map(|b| i16::from_le_bytes([b[0], b[1]]) as f32 / i16::MAX as f32)
                        .collect()
                } else {
                    return Err(ProviderError::InvalidAudio(
                        "Audio data is neither valid WAV nor 16-bit PCM".to_string(),
                    ));
                }
            }
        };

        if mono_samples.is_empty() {
            return Err(ProviderError::InvalidAudio("Audio contains no samples".to_string()));
        }

        let engine_arc = self.get_or_load_engine(&model_dir)?;
        let mut engine = engine_arc.lock().map_err(|_| {
            ProviderError::InternalError("Parakeet engine lock poisoned".to_string())
        })?;

        let inference_params = ParakeetInferenceParams {
            timestamp_granularity: TimestampGranularity::Segment,
        };

        let result = engine
            .transcribe_samples(mono_samples, Some(inference_params))
            .map_err(|e| {
                ProviderError::InternalError(format!("Parakeet inference error: {}", e))
            })?;

        Ok(Transcript {
            text: result.text.trim().to_string(),
            language: "en".to_string(),
            provider: "local-parakeet".to_string(),
            model: requested_id,
            duration_ms: audio.duration_ms,
            confidence: Some(0.98),
            family: Some(ModelFamily::Parakeet),
            backend: Some(ComputeBackend::Cpu),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use tar::Builder;

    #[test]
    fn test_extract_archive_with_macos_metadata_filtering() {
        let temp_dir = std::env::temp_dir().join(format!("forge_parakeet_test_{}", std::process::id()));
        let dest_dir = temp_dir.join("extracted");
        let archive_path = temp_dir.join("test_model.tar.gz");

        let _ = create_dir_all(&temp_dir);

        // Build in-memory .tar.gz with normal files AND macOS metadata artifacts
        let mut tar_builder = Builder::new(Vec::new());

        // 1. Valid model config file
        let config_data = b"{\"model_type\": \"parakeet-tdt\", \"sample_rate\": 16000}";
        let mut header = tar::Header::new_gnu();
        header.set_path("config.json").unwrap();
        header.set_size(config_data.len() as u64);
        header.set_mode(0o644);
        header.set_cksum();
        tar_builder.append(&header, &config_data[..]).unwrap();

        // 2. Valid model weights file
        let weights_data = vec![0xAB; 2048];
        let mut header2 = tar::Header::new_gnu();
        header2.set_path("model.onnx").unwrap();
        header2.set_size(weights_data.len() as u64);
        header2.set_mode(0o644);
        header2.set_cksum();
        tar_builder.append(&header2, &weights_data[..]).unwrap();

        // 3. macOS AppleDouble metadata file: ._config.json
        let macos_double = b"Mac OS X      ";
        let mut header3 = tar::Header::new_gnu();
        header3.set_path("._config.json").unwrap();
        header3.set_size(macos_double.len() as u64);
        header3.set_mode(0o644);
        header3.set_cksum();
        tar_builder.append(&header3, &macos_double[..]).unwrap();

        // 4. macOS directory metadata: __MACOSX/._model.onnx
        let mut header4 = tar::Header::new_gnu();
        header4.set_path("__MACOSX/._model.onnx").unwrap();
        header4.set_size(macos_double.len() as u64);
        header4.set_mode(0o644);
        header4.set_cksum();
        tar_builder.append(&header4, &macos_double[..]).unwrap();

        // 5. macOS Finder metadata: .DS_Store
        let mut header5 = tar::Header::new_gnu();
        header5.set_path(".DS_Store").unwrap();
        header5.set_size(macos_double.len() as u64);
        header5.set_mode(0o644);
        header5.set_cksum();
        tar_builder.append(&header5, &macos_double[..]).unwrap();

        let tar_bytes = tar_builder.into_inner().unwrap();

        // Compress tar -> gz
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(&tar_bytes).unwrap();
        let gz_bytes = encoder.finish().unwrap();

        // Write to archive file on disk
        std::fs::write(&archive_path, &gz_bytes).unwrap();

        // Run extractor
        let result = ParakeetArchiveInstaller::extract_archive(&archive_path, &dest_dir);
        assert!(result.is_ok(), "Extraction should succeed: {:?}", result.err());

        // Assert valid files exist
        assert!(dest_dir.join("config.json").exists(), "config.json must be extracted");
        assert!(dest_dir.join("model.onnx").exists(), "model.onnx must be extracted");

        // Assert macOS metadata was completely ignored
        assert!(!dest_dir.join("._config.json").exists(), "._config.json must be filtered");
        assert!(!dest_dir.join("__MACOSX").exists(), "__MACOSX directory must be filtered");
        assert!(!dest_dir.join(".DS_Store").exists(), ".DS_Store must be filtered");

        // Cleanup
        let _ = remove_dir_all(temp_dir);
    }

    #[test]
    fn test_corrupt_archive_handling() {
        let temp_dir = std::env::temp_dir().join(format!("forge_corrupt_test_{}", std::process::id()));
        let dest_dir = temp_dir.join("extracted");
        let archive_path = temp_dir.join("corrupted.tar.gz");

        let _ = create_dir_all(&temp_dir);
        std::fs::write(&archive_path, b"This is not a valid gzip file").unwrap();

        let result = ParakeetArchiveInstaller::extract_archive(&archive_path, &dest_dir);
        assert!(result.is_err(), "Corrupt archive must return error");

        let _ = remove_dir_all(temp_dir);
    }

    #[tokio::test]
    async fn test_parakeet_provider_capabilities_and_lifecycle() {
        let temp_dir =
            std::env::temp_dir().join(format!("forge_parakeet_prov_{}", std::process::id()));
        let _ = create_dir_all(&temp_dir);

        let provider = LocalParakeetProvider::with_models_dir(temp_dir.clone());
        assert_eq!(provider.id(), "local-parakeet");
        assert_eq!(provider.active_model_id(), "parakeet-v3-int8");

        let caps = provider.capabilities();
        assert!(caps.supports_local);
        assert!(!caps.supports_cloud);
        assert_eq!(caps.supported_families, vec![ModelFamily::Parakeet]);
        assert_eq!(caps.supported_backends, vec![ComputeBackend::Cpu]);
        assert_eq!(provider.cached_models_count(), 0);

        // Verify empty audio rejection
        let empty_audio = AudioData::new(Vec::new(), 16000, 1, 0);
        let res = provider
            .transcribe(empty_audio, TranscriptionOptions::default())
            .await;
        assert!(matches!(res, Err(ProviderError::InvalidAudio(_))));

        // Verify missing model rejection with descriptive error
        let dummy_audio = AudioData::new(vec![0u8; 100], 16000, 1, 100);
        let res2 = provider
            .transcribe(
                dummy_audio,
                TranscriptionOptions {
                    model: Some("parakeet-v3-int8".to_string()),
                    ..Default::default()
                },
            )
            .await;
        assert!(matches!(res2, Err(ProviderError::ModelError(_))));

        let _ = remove_dir_all(temp_dir);
    }

    #[test]
    fn test_parakeet_engine_cache_operations() {
        let temp_dir =
            std::env::temp_dir().join(format!("forge_parakeet_cache_{}", std::process::id()));
        let _ = create_dir_all(&temp_dir);

        let provider = LocalParakeetProvider::with_models_dir(temp_dir.clone());
        assert_eq!(provider.cached_models_count(), 0);
        provider.clear_cache();
        assert_eq!(provider.cached_models_count(), 0);

        let _ = remove_dir_all(temp_dir);
    }

    #[test]
    fn test_tar_slip_rejection() {
        let temp_dir =
            std::env::temp_dir().join(format!("forge_tarslip_test_{}", std::process::id()));
        let dest_dir = temp_dir.join("extracted");
        let archive_path = temp_dir.join("malicious.tar.gz");
        let _ = create_dir_all(&temp_dir);

        let mut tar_builder = Builder::new(Vec::new());
        let payload = b"malicious content";
        let mut header = tar::Header::new_gnu();
        // Malicious entry path attempting directory traversal via raw header bytes
        let name_bytes = b"../../escaped.txt";
        header.as_mut_bytes()[..name_bytes.len()].copy_from_slice(name_bytes);
        header.set_size(payload.len() as u64);
        header.set_mode(0o644);
        header.set_cksum();
        tar_builder.append(&header, &payload[..]).unwrap();

        let tar_bytes = tar_builder.into_inner().unwrap();
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(&tar_bytes).unwrap();
        let gz_bytes = encoder.finish().unwrap();
        std::fs::write(&archive_path, &gz_bytes).unwrap();

        let res = ParakeetArchiveInstaller::extract_archive(&archive_path, &dest_dir);
        assert!(res.is_err(), "Archive with ParentDir traversal must be rejected");
        assert!(!temp_dir.join("escaped.txt").exists());

        let _ = remove_dir_all(temp_dir);
    }
}
