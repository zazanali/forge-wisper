use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelFamily {
    Whisper,
    Parakeet,
}

impl std::fmt::Display for ModelFamily {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Whisper => write!(f, "Whisper"),
            Self::Parakeet => write!(f, "Parakeet"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelFormat {
    Ggml,
    OnnxArchive,
}

impl std::fmt::Display for ModelFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Ggml => write!(f, "GGML"),
            Self::OnnxArchive => write!(f, "ONNX Archive"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ComputeBackend {
    #[default]
    Cpu,
    VulkanGpu {
        device_name: String,
        device_index: u32,
    },
}

impl std::fmt::Display for ComputeBackend {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Cpu => write!(f, "CPU"),
            Self::VulkanGpu {
                device_name,
                device_index,
            } => write!(f, "Vulkan GPU #{} ({})", device_index, device_name),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMetadata {
    pub id: String,
    pub name: String,
    pub family: ModelFamily,
    pub format: ModelFormat,
    pub default_backend: ComputeBackend,
    pub supported_backends: Vec<ComputeBackend>,
    pub size_bytes: u64,
    pub sha256: String,
    pub ram_estimate_mb: u64,
    pub tier_tag: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioData {
    pub wav_bytes: Vec<u8>,
    pub sample_rate: u32,
    pub channels: u16,
    pub duration_ms: u64,
}

impl AudioData {
    pub fn new(wav_bytes: Vec<u8>, sample_rate: u32, channels: u16, duration_ms: u64) -> Self {
        Self {
            wav_bytes,
            sample_rate,
            channels,
            duration_ms,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionOptions {
    pub language: Option<String>,
    pub model: Option<String>,
    pub temperature: Option<f32>,
    pub prompt: Option<String>,
    #[serde(default)]
    pub family: Option<ModelFamily>,
    #[serde(default)]
    pub backend: Option<ComputeBackend>,
}

impl Default for TranscriptionOptions {
    fn default() -> Self {
        Self {
            language: None,
            model: None,
            temperature: Some(0.0),
            prompt: None,
            family: None,
            backend: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transcript {
    pub text: String,
    pub language: String,
    pub provider: String,
    pub model: String,
    pub duration_ms: u64,
    pub confidence: Option<f32>,
    #[serde(default)]
    pub family: Option<ModelFamily>,
    #[serde(default)]
    pub backend: Option<ComputeBackend>,
}

impl Default for Transcript {
    fn default() -> Self {
        Self {
            text: String::new(),
            language: "en".to_string(),
            provider: String::new(),
            model: String::new(),
            duration_ms: 0,
            confidence: None,
            family: None,
            backend: None,
        }
    }
}

impl Transcript {
    pub fn new(
        text: String,
        language: String,
        provider: String,
        model: String,
        duration_ms: u64,
        confidence: Option<f32>,
    ) -> Self {
        Self {
            text,
            language,
            provider,
            model,
            duration_ms,
            confidence,
            family: None,
            backend: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProviderCapabilities {
    pub supports_local: bool,
    pub supports_cloud: bool,
    pub supported_languages: Vec<String>,
    pub available_models: Vec<String>,
    pub requires_api_key: bool,
    #[serde(default)]
    pub supported_families: Vec<ModelFamily>,
    #[serde(default)]
    pub supported_backends: Vec<ComputeBackend>,
}

#[derive(Debug, Error)]
pub enum ProviderError {
    #[error("Audio format invalid or empty: {0}")]
    InvalidAudio(String),

    #[error("API Key missing or invalid: {0}")]
    AuthenticationError(String),

    #[error("Network failure communicating with provider: {0}")]
    NetworkError(String),

    #[error("Provider timeout: {0}")]
    Timeout(String),

    #[error("Model error: {0}")]
    ModelError(String),

    #[error("Model verification failed: {0}")]
    VerificationFailed(String),

    #[error("Backend unavailable: {0}")]
    BackendUnavailable(String),

    #[error("Internal provider error: {0}")]
    InternalError(String),
}

#[async_trait]
pub trait TranscriptionProvider: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn capabilities(&self) -> ProviderCapabilities;
    async fn transcribe(
        &self,
        audio: AudioData,
        options: TranscriptionOptions,
    ) -> Result<Transcript, ProviderError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_metadata_and_enums() {
        let meta = ModelMetadata {
            id: "parakeet-v3-int8".to_string(),
            name: "Parakeet V3 Int8".to_string(),
            family: ModelFamily::Parakeet,
            format: ModelFormat::OnnxArchive,
            default_backend: ComputeBackend::Cpu,
            supported_backends: vec![ComputeBackend::Cpu],
            size_bytes: 650 * 1024 * 1024,
            sha256: "test-hash-12345678".to_string(),
            ram_estimate_mb: 850,
            tier_tag: "Fast Local".to_string(),
        };

        assert_eq!(meta.family, ModelFamily::Parakeet);
        assert_eq!(meta.format, ModelFormat::OnnxArchive);
        assert_eq!(meta.family.to_string(), "Parakeet");
        assert_eq!(meta.format.to_string(), "ONNX Archive");
        assert_eq!(ComputeBackend::Cpu.to_string(), "CPU");

        let json = serde_json::to_string(&meta).expect("Serialization failed");
        let deserialized: ModelMetadata = serde_json::from_str(&json).expect("Deserialization failed");
        assert_eq!(deserialized.id, "parakeet-v3-int8");
        assert_eq!(deserialized.family, ModelFamily::Parakeet);
    }

    #[test]
    fn test_options_and_transcript_defaults() {
        let opts = TranscriptionOptions::default();
        assert!(opts.family.is_none());
        assert!(opts.backend.is_none());

        let transcript = Transcript {
            text: "Hello world".to_string(),
            language: "en".to_string(),
            provider: "local-whisper".to_string(),
            model: "base".to_string(),
            duration_ms: 1000,
            confidence: Some(0.99),
            family: Some(ModelFamily::Whisper),
            backend: Some(ComputeBackend::Cpu),
        };

        assert_eq!(transcript.family, Some(ModelFamily::Whisper));
    }
}

