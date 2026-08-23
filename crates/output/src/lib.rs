use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use serde::{Deserialize, Serialize};
use std::thread::sleep;
use std::time::Duration;
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PasteOutcome {
    Pasted,
    CopiedToClipboardFallback,
}

#[derive(Debug, Error)]
pub enum OutputError {
    #[error("Clipboard access failed: {0}")]
    ClipboardError(String),

    #[error("Keyboard simulation error: {0}")]
    SimulationError(String),
}

pub struct OutputEngine;

impl OutputEngine {
    /// Copies text to OS clipboard
    pub fn copy_to_clipboard(text: &str) -> Result<(), OutputError> {
        let mut clipboard = Clipboard::new()
            .map_err(|e| OutputError::ClipboardError(e.to_string()))?;
        clipboard
            .set_text(text.to_owned())
            .map_err(|e| OutputError::ClipboardError(e.to_string()))?;
        Ok(())
    }

    /// Simulates Ctrl+V (or Cmd+V on macOS) to paste clipboard contents into the active window
    pub fn simulate_paste() -> Result<(), OutputError> {
        let mut enigo = Enigo::new(&Settings::default())
            .map_err(|e| OutputError::SimulationError(e.to_string()))?;

        // Give a short 50ms breath for window focus
        sleep(Duration::from_millis(50));

        #[cfg(target_os = "macos")]
        {
            let press_res = enigo.key(Key::Meta, Direction::Press);
            let click_res = enigo.key(Key::V, Direction::Click);
            let release_res = enigo.key(Key::Meta, Direction::Release);

            press_res.map_err(|e| OutputError::SimulationError(e.to_string()))?;
            click_res.map_err(|e| OutputError::SimulationError(e.to_string()))?;
            release_res.map_err(|e| OutputError::SimulationError(e.to_string()))?;
        }

        #[cfg(not(target_os = "macos"))]
        {
            let press_res = enigo.key(Key::Control, Direction::Press);
            let click_res = enigo.key(Key::V, Direction::Click);
            let release_res = enigo.key(Key::Control, Direction::Release);

            press_res.map_err(|e| OutputError::SimulationError(e.to_string()))?;
            click_res.map_err(|e| OutputError::SimulationError(e.to_string()))?;
            release_res.map_err(|e| OutputError::SimulationError(e.to_string()))?;
        }

        Ok(())
    }

    /// Complete safe paste sequence: Copy to clipboard -> simulate Ctrl+V.
    /// If simulated key injection fails, the text is guaranteed to remain on the clipboard.
    pub fn paste_text(text: &str) -> Result<PasteOutcome, OutputError> {
        // Step 1: Copy to clipboard
        Self::copy_to_clipboard(text)?;

        // Step 2: Attempt simulated paste
        match Self::simulate_paste() {
            Ok(()) => {
                println!("[Forge Output] Successfully simulated Ctrl+V paste ({} characters).", text.len());
                Ok(PasteOutcome::Pasted)
            }
            Err(e) => {
                eprintln!("[Forge Output] Simulated paste failed ({:?}), retained in clipboard.", e);
                Ok(PasteOutcome::CopiedToClipboardFallback)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_generate_real_header_bmp() {
        let icon_path = "../../apps/desktop/src-tauri/icons/icon.png";
        let header_path = "../../apps/desktop/src-tauri/icons/header.bmp";

        let img = image::open(icon_path).expect("failed to open icon.png").to_rgba8();

        // 1. Auto-crop transparent outer margins so the squircle fills the frame cleanly
        let (width, height) = img.dimensions();
        let mut min_x = width;
        let mut min_y = height;
        let mut max_x = 0;
        let mut max_y = 0;

        for (x, y, p) in img.enumerate_pixels() {
            if p[3] > 40 {
                if x < min_x { min_x = x; }
                if x > max_x { max_x = x; }
                if y < min_y { min_y = y; }
                if y > max_y { max_y = y; }
            }
        }

        let crop_w = max_x.saturating_sub(min_x) + 1;
        let crop_h = max_y.saturating_sub(min_y) + 1;
        let cropped = image::imageops::crop_imm(&img, min_x, min_y, crop_w, crop_h).to_image();

        // 2. High-quality Lanczos3 resize to 50x50 px
        let icon_size = 50u32;
        let icon_resized = image::imageops::resize(
            &cropped,
            icon_size,
            icon_size,
            image::imageops::FilterType::Lanczos3,
        );

        let h_width = 150u32;
        let h_height = 57u32;
        let mut header_img = image::RgbImage::from_pixel(h_width, h_height, image::Rgb([255, 255, 255]));

        // Position on the right side of the header
        let offset_x = (h_width - icon_size - 8) as i64;
        let offset_y = ((h_height - icon_size) / 2) as i64;

        for (x, y, pixel) in icon_resized.enumerate_pixels() {
            let alpha = pixel[3] as f32 / 255.0;
            if alpha > 0.0 {
                let px = offset_x + x as i64;
                let py = offset_y + y as i64;
                if px >= 0 && px < h_width as i64 && py >= 0 && py < h_height as i64 {
                    let r = (pixel[0] as f32 * alpha + 255.0 * (1.0 - alpha)).round().clamp(0.0, 255.0) as u8;
                    let g = (pixel[1] as f32 * alpha + 255.0 * (1.0 - alpha)).round().clamp(0.0, 255.0) as u8;
                    let b = (pixel[2] as f32 * alpha + 255.0 * (1.0 - alpha)).round().clamp(0.0, 255.0) as u8;
                    header_img.put_pixel(px as u32, py as u32, image::Rgb([r, g, b]));
                }
            }
        }

        // 3. Unsharp mask sharpening kernel to make the soundbars and squircle boundaries razor sharp
        let mut sharpened = header_img.clone();
        for y in 1..(h_height - 1) {
            for x in 1..(h_width - 1) {
                if x >= offset_x as u32 && x < (offset_x as u32 + icon_size) {
                    let center = header_img.get_pixel(x, y);
                    let top = header_img.get_pixel(x, y - 1);
                    let bottom = header_img.get_pixel(x, y + 1);
                    let left = header_img.get_pixel(x - 1, y);
                    let right = header_img.get_pixel(x + 1, y);

                    let mut new_rgb = [0u8; 3];
                    for c in 0..3 {
                        let val = center[c] as f32 * 1.5 - (top[c] as f32 + bottom[c] as f32 + left[c] as f32 + right[c] as f32) * 0.125;
                        new_rgb[c] = val.round().clamp(0.0, 255.0) as u8;
                    }
                    sharpened.put_pixel(x, y, image::Rgb(new_rgb));
                }
            }
        }

        sharpened
            .save_with_format(header_path, image::ImageFormat::Bmp)
            .expect("failed to save header.bmp");

        let artifact_preview = "C:/Users/ALI/.gemini/antigravity-ide/brain/be87065f-7658-4932-870d-a52562ddcbf4/header_preview.png";
        let _ = sharpened.save_with_format(artifact_preview, image::ImageFormat::Png);
    }
}

