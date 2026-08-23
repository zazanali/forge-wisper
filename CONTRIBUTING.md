<div align="center">

<img src="apps/desktop/src-tauri/icons/icon.png" alt="Forge Wisper Logo" width="100" />

# Contributing to Forge Wisper

**Next-Generation Open-Source Voice-to-Structured-Text Desktop Application**

</div>

---

Thank you for your interest in contributing to **Forge Wisper**! We welcome contributions of all kinds: bug fixes, new features, rule-based cleanup enhancements, documentation, and UI/UX improvements.

---

## 🏛️ Codebase Architecture

Forge Wisper is structured as a **Cargo Workspace & pnpm Monorepo**:

- **`apps/desktop/`**: Desktop GUI built with **Tauri v2**, **React 19**, **TypeScript**, and **Tailwind CSS**.
- **`apps/desktop/src-tauri/`**: Tauri Rust backend, window management, state persistence, and global hotkey handling.
- **`crates/`**: Modular, isolated, and testable Rust crates:
  - `crates/audio`: Audio capture and RMS volume level streaming (`cpal`, `hound`).
  - `crates/cleanup`: Speech cleaning engine, spoken correction logic, and dictionary replacements.
  - `crates/output`: Native OS keyboard injection and safe clipboard auto-paste.
  - `crates/security`: OS Keyring credential storage (`keyring` crate).
  - `crates/storage`: SQLite database engine and retention policy manager.
  - `crates/transcription`: Speech recognition trait definitions and error models.
  - `crates/verification`: Entity safety verification engine comparing raw transcripts with cleaned output.
- **`providers/`**: Speech recognition engine implementations:
  - `providers/groq`: Fast cloud transcription using Groq LPUs (`whisper-large-v3-turbo`).
  - `providers/local-whisper`: Offline on-device transcription with `whisper-rs` (whisper.cpp).

---

## 🛠️ Development Setup

### 1. Prerequisites
- **Node.js** 18+ and **pnpm** 9+ (`npm install -g pnpm`)
- **Rust** 1.78+ (via [rustup](https://rustup.rs/))
- **Tauri v2 CLI**: `cargo install tauri-cli --version "^2.0.0"`
- **Windows C++ Build Tools** (MSVC) on Windows, or standard build essentials on Linux/macOS.

### 2. Getting Started
```bash
# Clone the repository
git clone https://github.com/zazanali/forge-wisper.git
cd forge-wisper

# Install frontend dependencies
pnpm install

# Run tests to ensure everything passes
cargo test --workspace

# Start desktop app in development mode
pnpm tauri:dev
```

---

## 🧪 Testing & Validation

All contributions must maintain a passing test suite across all crates:

```bash
# Run all unit and integration tests across the workspace
cargo test --workspace

# Test a specific crate (e.g. cleanup engine)
cargo test --package forge-cleanup

# Build the frontend production bundle
pnpm build
```

---

## 📋 Pull Request Workflow

1. **Fork the repository** on GitHub.
2. **Create a branch** for your work:
   ```bash
   git checkout -b feature/my-new-feature
   ```
3. **Write clean, tested code**:
   - Follow standard Rust idioms (`cargo fmt` and `cargo clippy`).
   - Follow TypeScript strict typing standards.
   - Ensure responsive, accessible UI components.
4. **Commit with descriptive messages**:
   - `feat: add custom hotkey recorder in settings`
   - `fix: resolve word replacement case sensitivity issue`
   - `docs: update voice commands cheat sheet in README`
5. **Push and open a PR** against the `main` branch.

---

## 💡 Submitting Issues

- **Bug Reports**: Please include your OS version, hardware specs, whether you're using Groq or Local Whisper, and clear reproduction steps.
- **Feature Requests**: Describe the problem you're trying to solve and your proposed solution or UI behavior.

---

## 📄 License

By contributing to Forge Wisper, you agree that your contributions will be licensed under its [MIT License](LICENSE).
