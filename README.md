# Forge Wisper 🎙️⚡

> **Open-Source AI Voice-to-Structured-Text Desktop Application**  
> *Speak naturally. Release. Receive clean, verified, structured text directly in any active app.*

---

## What is Forge Wisper?

Forge Wisper is a privacy-conscious, local-first desktop application designed around a seamless interaction:

```text
Press / Hold Hotkey (Ctrl + Space)
        ↓
Speak Naturally
        ↓
Release Hotkey
        ↓
AI Transcription (Local Whisper / Groq)
        ↓
Rule-Based Cleanup + Structure + Verification
        ↓
Safe Paste into Active Application
```

Unlike basic speech-to-text tools, Forge Wisper handles **spoken corrections** (*"Tuesday, actually Thursday"*), removes filler words contextually, formats lists and headings, verifies entity preservation (numbers, dates, proper nouns), and safely pastes the result into your active application with automatic clipboard fallback.

---

## Features

- 🔒 **Privacy-First & Local-First**: Run fully offline with Local Whisper (whisper.cpp / GGUF models). No audio is persisted to disk by default.
- ⚡ **Groq Cloud STT Option**: Blazing fast cloud transcription using Groq Whisper (`whisper-large-v3-turbo`) with secure OS keyring key storage.
- 🛠️ **Voice-to-Structured-Text**: Rule-based cleaner that handles spoken corrections, filler removal, smart punctuation, numbers/currencies, and personal dictionary mapping.
- 🛡️ **Verification Engine & Safe Paste**: Compares raw transcripts with cleaned output to ensure critical entities (names, numbers, dates) are never hallucinated or lost before pasting.
- 📋 **Fail-Safe Clipboard**: If auto-paste is interrupted, your text is securely preserved on the system clipboard.
- 📚 **History & Reprocessing**: Searchable SQLite history table allowing you to copy raw or final text, reprocess with different settings, or prune history automatically.
- 🎨 **Forge Design System**: Dark warm aesthetic crafted with Space Grotesk, Inter, and tailored Forge color tokens (`#0E0E0E`, `#1C1B1B`, `#FFB595`, `#CA5924`).

---

## Architecture

```text
                          FORGE WISPER
                               │
                               ▼
                         Audio Capture (cpal + hound)
                               │
                               ▼
                      Transcription Layer
                               │
                  ┌────────────┴────────────┐
                  │                         │
            Local Whisper                 Groq (Cloud)
             (whisper-rs)              (whisper-large-v3)
                  │                         │
                  └────────────┬────────────┘
                               │
                               ▼
                         Raw Transcript
                               │
                               ▼
                      Correction Detection
                               │
                               ▼
                         Cleanup Engine
                               │
                               ▼
                      Verification Engine
                               │
                               ▼
                     Safe Paste / Clipboard
                               │
                               ▼
                       Active Application
```

---

## Quick Start

### Prerequisites
- [Node.js 18+](https://nodejs.org/) & [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/) (1.78+) with MSVC Build Tools on Windows
- [Tauri CLI](https://tauri.app/) (`cargo install tauri-cli --version "^2.0.0"`)

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/forge-wisper/forge-wisper.git
cd forge-wisper

# Install frontend dependencies
pnpm install

# Run in desktop development mode (Tauri 2)
pnpm tauri:dev
```

### Running Tests

```bash
cargo test --workspace
```

---

## License

This project is licensed under the [MIT License](LICENSE).
Third-party models (such as OpenAI Whisper models) remain subject to their respective original licenses.
