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
            Some(name) if !name.trim().is_empty() => {
                let mut found = None;
                if let Ok(devices) = host.input_devices() {
                    for d in devices {
                        if let Ok(n) = d.name() {
                            if n == name || n.contains(name) || name.contains(&n) {
                                found = Some(d);
                                break;
                            }
                        }
                    }
                }
                // If specific named device not found, gracefully fall back to default input device
                found.or_else(|| host.default_input_device())
                    .ok_or_else(|| AudioError::NoDevice("No audio input device available".to_string()))?
            }
            _ => host
                .default_input_device()
                .ok_or_else(|| AudioError::NoDevice("No default input device found".to_string()))?,
        };

        let device_display_name = device.name().unwrap_or_else(|_| "Unknown Device".to_string());
        println!("[Forge Audio] Opening capture device: '{}'", device_display_name);

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
            eprintln!("[Forge Audio] Stream error: {:?}", err);
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

        println!(
            "[Forge Audio] Audio recording started. Sample rate: {} Hz, Channels: {}, Format: {:?}",
            sample_rate, channels, sample_format
        );

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

    /// Returns the approximate duration in seconds of audio captured so far in the buffer
    pub fn get_buffer_duration_secs(&self) -> f32 {
        let sample_count = {
            let buf = self.audio_buffer.lock().unwrap();
            buf.len()
        };
        if self.source_sample_rate > 0 && self.source_channels > 0 {
            (sample_count as f32) / (self.source_sample_rate as f32 * self.source_channels as f32)
        } else {
            0.0
        }
    }

    /// Takes a non-destructive in-memory snapshot of the currently recorded audio and encodes it to standard 16kHz WAV
    pub fn get_wav_snapshot(&self) -> Result<Vec<u8>, AudioError> {
        let raw_samples = self.audio_buffer.lock().unwrap().clone();
        if raw_samples.is_empty() {
            return Ok(Vec::new());
        }

        let mut samples = raw_samples;
        for sample in samples.iter_mut() {
            if sample.is_nan() || sample.is_infinite() {
                *sample = 0.0;
            }
        }

        let mono_samples: Vec<f32> = if self.source_channels > 1 {
            samples
                .chunks(self.source_channels as usize)
                .map(|chunk| chunk.iter().sum::<f32>() / chunk.len() as f32)
                .collect()
        } else {
            samples
        };

        let max_abs = mono_samples
            .iter()
            .map(|s| s.abs())
            .fold(0.0f32, f32::max);

        let normalized_samples: Vec<f32> = if max_abs > 0.0001 {
            let target_peak = 0.80f32;
            let gain = (target_peak / max_abs).clamp(1.0, 100.0);
            mono_samples
                .into_iter()
                .map(|s| (s * gain).clamp(-1.0, 1.0))
                .collect()
        } else {
            mono_samples
        };

        let target_sample_rate = 16000u32;
        let resampled: Vec<f32> = if self.source_sample_rate != target_sample_rate && self.source_sample_rate > 0 {
            resample_linear(&normalized_samples, self.source_sample_rate, target_sample_rate)
        } else {
            normalized_samples
        };

        encode_pcm16_wav(&resampled, target_sample_rate)
    }

    pub fn stop_and_encode_wav(self) -> Result<Vec<u8>, AudioError> {
        self.is_recording.store(false, Ordering::SeqCst);
        let mut raw_samples = self.audio_buffer.lock().unwrap().clone();

        // Handle empty or very short buffers gracefully
        if raw_samples.is_empty() {
            raw_samples = vec![0.0f32; 1600]; // 100ms silence
        }

        // Sanitize raw samples to prevent NaN panics during clamp operations (common on macOS CoreAudio)
        for sample in raw_samples.iter_mut() {
            if sample.is_nan() || sample.is_infinite() {
                *sample = 0.0;
            }
        }

        // Convert multi-channel to mono if needed
        let mono_samples: Vec<f32> = if self.source_channels > 1 {
            raw_samples
                .chunks(self.source_channels as usize)
                .map(|chunk| chunk.iter().sum::<f32>() / chunk.len() as f32)
                .collect()
        } else {
            raw_samples.clone()
        };

        // Peak Normalization / AGC: Scale quiet microphone audio to optimal Whisper amplitude (~0.80 peak)
        let max_abs = mono_samples
            .iter()
            .map(|s| s.abs())
            .fold(0.0f32, f32::max);

        let normalized_samples: Vec<f32> = if max_abs > 0.0001 {
            let target_peak = 0.80f32;
            let gain = (target_peak / max_abs).clamp(1.0, 100.0);
            mono_samples
                .into_iter()
                .map(|s| (s * gain).clamp(-1.0, 1.0))
                .collect()
        } else {
            mono_samples
        };

        // Resample to 16,000 Hz if needed (Whisper target sample rate)
        let target_sample_rate = 16000u32;
        let resampled: Vec<f32> = if self.source_sample_rate != target_sample_rate && self.source_sample_rate > 0 {
            resample_linear(&normalized_samples, self.source_sample_rate, target_sample_rate)
        } else {
            normalized_samples
        };

        println!(
            "[Forge Audio] Captured {} raw samples (Peak amplitude: {:.4}). Encoded {} samples at 16kHz.",
            raw_samples.len(),
            max_abs,
            resampled.len()
        );

        // Encode into 16-bit PCM WAV in memory
        encode_pcm16_wav(&resampled, target_sample_rate)
    }
}

/// High quality resampler for audio conversion to 16kHz with anti-aliased decimation
fn resample_linear(input: &[f32], src_rate: u32, target_rate: u32) -> Vec<f32> {
    if input.is_empty() {
        return Vec::new();
    }
    if src_rate == target_rate {
        return input.to_vec();
    }

    let ratio = src_rate as f64 / target_rate as f64;
    let target_len = (input.len() as f64 / ratio).round() as usize;
    let mut output = Vec::with_capacity(target_len);

    if ratio > 1.0 {
        // Downsampling with box-filter anti-aliasing area integration
        let window_half = (ratio * 0.5) as f64;
        for i in 0..target_len {
            let center = i as f64 * ratio;
            let start = (center - window_half).max(0.0);
            let end = (center + window_half).min((input.len() - 1) as f64);

            let start_idx = start.floor() as usize;
            let end_idx = end.ceil() as usize;

            let mut sum = 0.0f32;
            let mut count = 0.0f32;
            for idx in start_idx..=end_idx.min(input.len() - 1) {
                sum += input[idx];
                count += 1.0;
            }
            if count > 0.0 {
                output.push(sum / count);
            } else {
                let fallback_idx = (center.round() as usize).min(input.len() - 1);
                output.push(input[fallback_idx]);
            }
        }
    } else {
        // Upsampling with linear interpolation
        for i in 0..target_len {
            let src_idx = i as f64 * ratio;
            let idx0 = (src_idx.floor() as usize).min(input.len() - 1);
            let idx1 = (idx0 + 1).min(input.len() - 1);
            let frac = (src_idx - idx0 as f64) as f32;

            let s0 = input[idx0];
            let s1 = input[idx1];
            output.push(s0 + frac * (s1 - s0));
        }
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

    for &raw_sample in samples {
        let sample = if raw_sample.is_nan() || raw_sample.is_infinite() {
            0.0f32
        } else {
            raw_sample
        };
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

    #[test]
    fn test_list_and_probe_input_devices() {
        let devices = list_input_devices();
        println!("\n=== AUDIO INPUT DEVICES FOUND ===");
        match devices {
            Ok(devs) => {
                for (i, d) in devs.iter().enumerate() {
                    println!("[{}] {} (default: {})", i, d.name, d.is_default);
                }
            }
            Err(e) => println!("Error listing devices: {:?}", e),
        }
        println!("=================================\n");
    }
}
