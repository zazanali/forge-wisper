use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

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
}

impl Default for TranscriptionOptions {
    fn default() -> Self {
        Self {
            language: None,
            model: None,
            temperature: Some(0.0),
            prompt: None,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    pub supports_local: bool,
    pub supports_cloud: bool,
    pub supported_languages: Vec<String>,
    pub available_models: Vec<String>,
    pub requires_api_key: bool,
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
