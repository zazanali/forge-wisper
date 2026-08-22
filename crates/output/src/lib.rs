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
            enigo.key(Key::Meta, Direction::Press).map_err(|e| OutputError::SimulationError(e.to_string()))?;
            enigo.key(Key::V, Direction::Click).map_err(|e| OutputError::SimulationError(e.to_string()))?;
            enigo.key(Key::Meta, Direction::Release).map_err(|e| OutputError::SimulationError(e.to_string()))?;
        }

        #[cfg(not(target_os = "macos"))]
        {
            enigo.key(Key::Control, Direction::Press).map_err(|e| OutputError::SimulationError(e.to_string()))?;
            enigo.key(Key::V, Direction::Click).map_err(|e| OutputError::SimulationError(e.to_string()))?;
            enigo.key(Key::Control, Direction::Release).map_err(|e| OutputError::SimulationError(e.to_string()))?;
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
