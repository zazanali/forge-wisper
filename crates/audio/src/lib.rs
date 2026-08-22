use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, StreamConfig};
use hound::{WavSpec, WavWriter};
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AudioError {
    #[error("No audio input device available: {0}")]
    NoDevice(String),

    #[error("Device configuration error: {0}")]
    ConfigError(String),

    #[error("Stream error: {0}")]
    StreamError(String),

    #[error("WAV encoding error: {0}")]
    EncodingError(String),

    #[error("Recording is already in progress")]
    AlreadyRecording,

    #[error("No active recording to stop")]
    NotRecording,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDeviceInfo {
    pub name: String,
    pub is_default: bool,
}

pub fn list_input_devices() -> Result<Vec<AudioDeviceInfo>, AudioError> {
    let host = cpal::default_host();
    let default_device_name = host
        .default_input_device()
        .and_then(|d| d.name().ok());

    let devices = host
        .input_devices()
        .map_err(|e| AudioError::NoDevice(e.to_string()))?;

    let mut result = Vec::new();
    for device in devices {
        if let Ok(name) = device.name() {
            let is_default = default_device_name.as_deref() == Some(&name);
            result.push(AudioDeviceInfo { name, is_default });
        }
    }

    Ok(result)
}

pub struct AudioRecorder {
    is_recording: Arc<AtomicBool>,
    audio_buffer: Arc<Mutex<Vec<f32>>>,
    rms_level: Arc<Mutex<f32>>,
    source_sample_rate: u32,
    source_channels: u16,
    _stream: cpal::Stream,
}

unsafe impl Send for AudioRecorder {}
unsafe impl Sync for AudioRecorder {}

impl AudioRecorder {
    pub fn start(device_name: Option<&str>) -> Result<Self, AudioError> {
        let host = cpal::default_host();
        let device = match device_name {
            Some(name) => {
                let mut found = None;
                if let Ok(devices) = host.input_devices() {
                    for d in devices {
                        if let Ok(n) = d.name() {
                            if n == name {
                                found = Some(d);
                                break;
                            }
                        }
                    }
                }
                found.ok_or_else(|| AudioError::NoDevice(format!("Device '{}' not found", name)))?
            }
            None => host
                .default_input_device()
                .ok_or_else(|| AudioError::NoDevice("No default input device found".to_string()))?,
        };

        let default_config = device
            .default_input_config()
            .map_err(|e| AudioError::ConfigError(e.to_string()))?;

        let sample_rate = default_config.sample_rate().0;
        let channels = default_config.channels();
        let sample_format = default_config.sample_format();

        let stream_config: StreamConfig = default_config.into();

        let audio_buffer = Arc::new(Mutex::new(Vec::<f32>::new()));
        let rms_level = Arc::new(Mutex::new(0.0f32));
        let is_recording = Arc::new(AtomicBool::new(true));

        let buffer_clone = Arc::clone(&audio_buffer);
        let rms_clone = Arc::clone(&rms_level);
        let recording_clone = Arc::clone(&is_recording);

        let err_fn = |err| {
            tracing::error!("Audio stream error: {:?}", err);
        };

        let stream = match sample_format {
            SampleFormat::F32 => device.build_input_stream(
                &stream_config,
                move |data: &[f32], _| {
                    if recording_clone.load(Ordering::Relaxed) {
                        let mut buf = buffer_clone.lock().unwrap();
                        buf.extend_from_slice(data);

                        // Compute rolling RMS level
                        if !data.is_empty() {
                            let sum_sq: f32 = data.iter().map(|s| s * s).sum();
                            let rms = (sum_sq / data.len() as f32).sqrt();
                            if let Ok(mut r) = rms_clone.lock() {
                                *r = rms;
                            }
                        }
                    }
                },
                err_fn,
                None,
            ),
            SampleFormat::I16 => device.build_input_stream(
                &stream_config,
                move |data: &[i16], _| {
                    if recording_clone.load(Ordering::Relaxed) {
                        let mut buf = buffer_clone.lock().unwrap();
                        buf.extend(data.iter().map(|&s| s as f32 / i16::MAX as f32));

                        if !data.is_empty() {
                            let sum_sq: f32 = data.iter().map(|&s| {
                                let norm = s as f32 / i16::MAX as f32;
                                norm * norm
                            }).sum();
                            let rms = (sum_sq / data.len() as f32).sqrt();
                            if let Ok(mut r) = rms_clone.lock() {
                                *r = rms;
                            }
                        }
                    }
                },
                err_fn,
                None,
            ),
            SampleFormat::U16 => device.build_input_stream(
                &stream_config,
                move |data: &[u16], _| {
                    if recording_clone.load(Ordering::Relaxed) {
                        let mut buf = buffer_clone.lock().unwrap();
                        buf.extend(data.iter().map(|&s| (s as f32 - 32768.0) / 32768.0));
                    }
                },
                err_fn,
                None,
            ),
            _ => return Err(AudioError::ConfigError("Unsupported sample format".to_string())),
        }
        .map_err(|e| AudioError::StreamError(e.to_string()))?;

        stream
            .play()
            .map_err(|e| AudioError::StreamError(e.to_string()))?;

        Ok(Self {
            is_recording,
            audio_buffer,
            rms_level,
            source_sample_rate: sample_rate,
            source_channels: channels,
            _stream: stream,
        })
    }

    pub fn get_current_rms(&self) -> f32 {
        *self.rms_level.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn stop_and_encode_wav(self) -> Result<Vec<u8>, AudioError> {
        self.is_recording.store(false, Ordering::SeqCst);
        let raw_samples = self.audio_buffer.lock().unwrap().clone();

        if raw_samples.is_empty() {
            return Err(AudioError::EncodingError("No audio samples recorded".to_string()));
        }

        // Convert multi-channel to mono if needed
        let mono_samples: Vec<f32> = if self.source_channels > 1 {
            raw_samples
                .chunks_exact(self.source_channels as usize)
                .map(|chunk| chunk.iter().sum::<f32>() / self.source_channels as f32)
                .collect()
        } else {
            raw_samples
        };

        // Check if audio has sufficient signal (silence detection)
        let max_abs = mono_samples
            .iter()
            .map(|s| s.abs())
            .fold(0.0f32, f32::max);

        if max_abs < 0.0015 {
            return Err(AudioError::EncodingError(
                "Audio is silent. Please check your microphone input level and speak clearly.".to_string(),
            ));
        }

        // Peak Normalization / AGC: Scale quiet microphone audio to optimal Whisper amplitude (~0.75 peak)
        let target_peak = 0.75f32;
        let gain = (target_peak / max_abs).clamp(1.0, 50.0);
        let normalized_samples: Vec<f32> = mono_samples
            .into_iter()
            .map(|s| (s * gain).clamp(-1.0, 1.0))
            .collect();

        // Resample to 16,000 Hz if needed (Whisper target sample rate)
        let target_sample_rate = 16000u32;
        let resampled: Vec<f32> = if self.source_sample_rate != target_sample_rate {
            resample_linear(&normalized_samples, self.source_sample_rate, target_sample_rate)
        } else {
            normalized_samples
        };

        // Encode into 16-bit PCM WAV in memory
        encode_pcm16_wav(&resampled, target_sample_rate)
    }
}

/// Linear resampler for audio conversion to 16kHz
fn resample_linear(input: &[f32], src_rate: u32, target_rate: u32) -> Vec<f32> {
    if input.is_empty() {
        return Vec::new();
    }
    let ratio = src_rate as f64 / target_rate as f64;
    let target_len = (input.len() as f64 / ratio).round() as usize;
    let mut output = Vec::with_capacity(target_len);

    for i in 0..target_len {
        let src_idx = i as f64 * ratio;
        let idx0 = src_idx.floor() as usize;
        let idx1 = (idx0 + 1).min(input.len() - 1);
        let frac = (src_idx - idx0 as f64) as f32;

        let s0 = input[idx0];
        let s1 = input[idx1];
        output.push(s0 + frac * (s1 - s0));
    }

    output
}

/// Encodes normalized f32 audio samples into standard 16-bit mono WAV bytes
pub fn encode_pcm16_wav(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, AudioError> {
    let spec = WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut cursor = Cursor::new(Vec::new());
    let mut writer = WavWriter::new(&mut cursor, spec)
        .map_err(|e| AudioError::EncodingError(e.to_string()))?;

    for &sample in samples {
        let clamped = sample.clamp(-1.0, 1.0);
        let int_val = (clamped * 32767.0).round() as i16;
        writer
            .write_sample(int_val)
            .map_err(|e| AudioError::EncodingError(e.to_string()))?;
    }

    writer
        .finalize()
        .map_err(|e| AudioError::EncodingError(e.to_string()))?;

    Ok(cursor.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_pcm16_wav() {
        // Generate a 1-second 440Hz sine wave at 16kHz
        let sample_rate = 16000;
        let samples: Vec<f32> = (0..sample_rate)
            .map(|i| (2.0 * std::f32::consts::PI * 440.0 * i as f32 / sample_rate as f32).sin())
            .collect();

        let wav_bytes = encode_pcm16_wav(&samples, sample_rate).expect("WAV encoding failed");
        assert!(!wav_bytes.is_empty());
        assert_eq!(&wav_bytes[0..4], b"RIFF");
        assert_eq!(&wav_bytes[8..12], b"WAVE");
    }

    #[test]
    fn test_resample_linear() {
        let input = vec![0.0, 1.0, 0.0, -1.0];
        let resampled = resample_linear(&input, 4, 8);
        assert_eq!(resampled.len(), 8);
    }
}
