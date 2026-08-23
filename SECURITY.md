<div align="center">

<img src="apps/desktop/src-tauri/icons/icon.png" alt="Forge Wisper Logo" width="100" />

# Security & Privacy Policy

**Next-Generation Open-Source Voice-to-Structured-Text Desktop Application**

</div>

---

## 🔒 Supported Versions

We actively provide security patches and updates for the following versions:

| Version | Supported          |
| :--- | :--- |
| **0.1.x** | :white_check_mark: Supported |

---

## 🛡️ Privacy & Security Guarantees

### 1. In-Memory Audio Processing
- **No Audio Persistence**: Audio recorded via your microphone is captured into transient memory buffers solely for transcription processing.
- **Immediate Discard**: Audio buffers are dropped and deallocated from RAM immediately after transcription is complete. Audio is **never written to disk or telemetry**.

### 2. Native OS Secret Vaults (Keyring)
- **Zero Plaintext API Keys**: Provider API keys (such as Groq API keys) are stored directly inside your operating system's native secure credential manager:
  - **Windows**: Windows Credential Manager
  - **macOS**: Apple Keychain
  - **Linux**: Secret Service API / GNOME Keyring / KWallet
- Keys are never serialized into plaintext configuration files, SQLite tables, or error logs.

### 3. Local-First Processing
- **Offline Guarantee**: When using **Local Whisper**, 100% of speech recognition, text cleaning, formatting, and auto-pasting occurs locally on your CPU/GPU. No data leaves your machine.
- **Local SQLite History**: All dictation history is stored in a local SQLite database (`history.db`) on your device.

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability or security bug within Forge Wisper, please report it responsibly:

1. **Do NOT open a public GitHub issue** for sensitive vulnerabilities.
2. Open a **Private Security Advisory** on GitHub via the **Security** tab of the repository.
3. Include:
   - A description of the vulnerability and its potential impact.
   - Step-by-step reproduction instructions or proof-of-concept.
   - Any suggested mitigations.

We will acknowledge receipt of your vulnerability report within 48 hours and work with you on a coordinated disclosure and patch release.
