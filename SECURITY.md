# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Privacy & Key Storage Guarantee

- **API Keys**: Groq API keys and any future provider tokens are stored strictly in the operating system's secure credential vault (Windows Credential Manager via `keyring`). Keys are never written to disk, logs, or telemetry.
- **Audio Persistence**: Audio data captured from the microphone is kept strictly in memory for processing and is immediately dropped after transcription. Audio is **never** saved to disk unless explicitly configured for diagnostic testing.
- **Transcripts**: Dictation history is stored locally in an embedded SQLite database. No transcripts are transmitted to external servers without explicit user consent.

## Reporting a Vulnerability

If you discover a security vulnerability within Forge Wisper, please report it responsibly by contacting the maintainers directly or opening a private security advisory on GitHub.
