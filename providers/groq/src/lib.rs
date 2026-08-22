use async_trait::async_trait;
use forge_transcription::{
    AudioData, ProviderCapabilities, ProviderError, Transcript, TranscriptionOptions,
    TranscriptionProvider,
};
use reqwest::multipart::{Form, Part};
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;

const GROQ_TRANSCRIPTION_URL: &str = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODELS_URL: &str = "https://api.groq.com/openai/v1/models";

pub struct GroqTranscriptionProvider {
    client: Client,
    api_key_getter: Box<dyn Fn() -> Result<String, ProviderError> + Send + Sync>,
}

#[derive(Debug, Deserialize)]
struct GroqResponse {
    text: String,
    #[serde(default)]
    language: Option<String>,
}

impl GroqTranscriptionProvider {
    pub fn new<F>(api_key_getter: F) -> Self
    where
        F: Fn() -> Result<String, ProviderError> + Send + Sync + 'static,
    {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            client,
            api_key_getter: Box::new(api_key_getter),
        }
    }

    /// Tests whether a given API key is valid against Groq's models endpoint
    pub async fn test_connection(&self, api_key: &str) -> Result<bool, ProviderError> {
        if api_key.trim().is_empty() {
            return Err(ProviderError::AuthenticationError("API key cannot be empty".to_string()));
        }

        let res = self
            .client
            .get(GROQ_MODELS_URL)
            .bearer_auth(api_key)
            .send()
            .await
            .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

        if res.status().is_success() {
            Ok(true)
        } else if res.status().as_u16() == 401 {
            Err(ProviderError::AuthenticationError("Invalid Groq API key".to_string()))
        } else {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            Err(ProviderError::InternalError(format!(
                "Groq status {}: {}",
                status, body
            )))
        }
    }
}

#[async_trait]
impl TranscriptionProvider for GroqTranscriptionProvider {
    fn id(&self) -> &str {
        "groq"
    }

    fn name(&self) -> &str {
        "Groq Whisper (Cloud STT)"
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_local: false,
            supports_cloud: true,
            supported_languages: vec![
                "auto".to_string(),
                "en".to_string(),
                "es".to_string(),
                "fr".to_string(),
                "de".to_string(),
                "it".to_string(),
                "pt".to_string(),
                "zh".to_string(),
                "ja".to_string(),
                "ar".to_string(),
                "ur".to_string(),
            ],
            available_models: vec![
                "whisper-large-v3-turbo".to_string(),
                "whisper-large-v3".to_string(),
            ],
            requires_api_key: true,
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

        let api_key = (self.api_key_getter)()?;
        if api_key.trim().is_empty() {
            return Err(ProviderError::AuthenticationError(
                "Groq API key not configured".to_string(),
            ));
        }

        let model = options
            .model
            .unwrap_or_else(|| "whisper-large-v3-turbo".to_string());

        let part = Part::bytes(audio.wav_bytes)
            .file_name("audio.wav")
            .mime_str("audio/wav")
            .map_err(|e| ProviderError::InvalidAudio(e.to_string()))?;

        let mut form = Form::new()
            .part("file", part)
            .text("model", model.clone())
            .text("response_format", "verbose_json");

        if let Some(lang) = options.language {
            if lang != "auto" {
                form = form.text("language", lang);
            }
        }

        if let Some(prompt) = options.prompt {
            form = form.text("prompt", prompt);
        }

        if let Some(temp) = options.temperature {
            form = form.text("temperature", temp.to_string());
        }

        let response = self
            .client
            .post(GROQ_TRANSCRIPTION_URL)
            .bearer_auth(api_key)
            .multipart(form)
            .send()
            .await
            .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let err_body = response.text().await.unwrap_or_default();
            if status.as_u16() == 401 {
                return Err(ProviderError::AuthenticationError(
                    "Invalid Groq API key".to_string(),
                ));
            }
            return Err(ProviderError::InternalError(format!(
                "Groq API error ({}): {}",
                status, err_body
            )));
        }

        let groq_res: GroqResponse = response
            .json()
            .await
            .map_err(|e| ProviderError::InternalError(e.to_string()))?;

        Ok(Transcript {
            text: groq_res.text,
            language: groq_res.language.unwrap_or_else(|| "en".to_string()),
            provider: "groq".to_string(),
            model,
            duration_ms: audio.duration_ms,
            confidence: Some(0.98),
        })
    }
}
