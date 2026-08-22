use async_trait::async_trait;
use forge_transcription::{
    AudioData, ProviderCapabilities, ProviderError, Transcript, TranscriptionOptions,
    TranscriptionProvider,
};
use std::time::Duration;
use tokio::time::sleep;

pub struct MockTranscriptionProvider {
    mock_text: Option<String>,
    simulate_delay_ms: u64,
}

impl MockTranscriptionProvider {
    pub fn new() -> Self {
        Self {
            mock_text: None,
            simulate_delay_ms: 300,
        }
    }

    pub fn with_fixed_text(text: &str) -> Self {
        Self {
            mock_text: Some(text.to_string()),
            simulate_delay_ms: 100,
        }
    }
}

impl Default for MockTranscriptionProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl TranscriptionProvider for MockTranscriptionProvider {
    fn id(&self) -> &str {
        "mock"
    }

    fn name(&self) -> &str {
        "Mock Engine (Keyless / Offline Test)"
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_local: true,
            supports_cloud: false,
            supported_languages: vec!["en".to_string(), "auto".to_string()],
            available_models: vec!["mock-instant".to_string(), "mock-delayed".to_string()],
            requires_api_key: false,
        }
    }

    async fn transcribe(
        &self,
        audio: AudioData,
        _options: TranscriptionOptions,
    ) -> Result<Transcript, ProviderError> {
        if audio.wav_bytes.is_empty() {
            return Err(ProviderError::InvalidAudio("Empty audio bytes supplied".to_string()));
        }

        if self.simulate_delay_ms > 0 {
            sleep(Duration::from_millis(self.simulate_delay_ms)).await;
        }

        let text = self.mock_text.clone().unwrap_or_else(|| {
            "Schedule the team demo for Tuesday, actually Thursday at 10 AM.".to_string()
        });

        Ok(Transcript {
            text,
            language: "en".to_string(),
            provider: "mock".to_string(),
            model: "mock-instant".to_string(),
            duration_ms: audio.duration_ms,
            confidence: Some(0.99),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_transcription() {
        let provider = MockTranscriptionProvider::with_fixed_text("Hello from Forge Wisper mock");
        let audio = AudioData::new(vec![0; 100], 16000, 1, 1000);
        let transcript = provider
            .transcribe(audio, TranscriptionOptions::default())
            .await
            .unwrap();

        assert_eq!(transcript.text, "Hello from Forge Wisper mock");
        assert_eq!(transcript.provider, "mock");
    }
}
