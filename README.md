<div align="center">

<img src="apps/desktop/src-tauri/icons/icon.png" alt="Forge Wisper Logo" width="128" />

# Forge Wisper

**Next-Generation Open-Source Voice-to-Structured-Text Desktop Application**

*Speak naturally. Release. Receive clean, formatted, verified text directly at your cursor in real time.*

[![Rust](https://img.shields.io/badge/Rust-2021_Edition-orange?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2.0-24C8D8?logo=tauri&logoColor=white)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform: Windows & macOS](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-blue?logo=apple&logoColor=white)](#-platform-support--compatibility)
[![GitHub Stars](https://img.shields.io/github/stars/zazanali/forge-wisper?style=social)](https://github.com/zazanali/forge-wisper)

</div>

---

## 📥 Downloads & Installation

Get the latest official release for your operating system from the **[GitHub Releases Page](https://github.com/zazanali/forge-wisper/releases/latest)**:

| Platform | Package Format | Architecture | Compatibility |
| :--- | :--- | :--- | :--- |
| **🪟 Windows** | `.exe` (NSIS Installer) | `x86_64` (Intel/AMD) / ARM64 | Windows 10 (64-bit) & Windows 11 |
| **🍎 macOS** | `.dmg` / `.app` Bundle | Apple Silicon (`aarch64` M1–M4) & Intel (`x86_64`) | macOS 12 (Monterey) to macOS 15 (Sequoia)+ |
| **🐧 Linux** | `.deb` / `.AppImage` | `x86_64` | 🚧 *In Progress* |

---

## ⚡ What is Forge Wisper?

**Forge Wisper** is a high-performance, cross-platform, privacy-first desktop voice-to-text engine designed around a frictionless, instant dictation workflow. Whether you're in an IDE, browser, document editor, terminal, or messenger, Forge Wisper captures your speech with native low-latency audio drivers, removes spoken pauses, auto-corrects slips of the tongue, expands dynamic voice macros, and streams clean text directly at your cursor.

```text
[ Global Shortcut: Ctrl + Space (Win) / Cmd + Space (Mac) ]
                ↓
    🎙️ Speak Naturally (English, Urdu, Hindi, Spanish, French, etc.)
                ↓
    ⚡ Speech Recognition (Groq LPUs / Offline Local Whisper)
                ↓
    🧠 Rule-Based Cleaner (Filler Removal + Intent Correction + Non-Latin Stripping)
                ↓
    📝 Dynamic Snippet Engine (Voice Macros auto-expand onto new lines)
                ↓
    🛡️ Verification Engine (Preserves numbers, dates & technical terms)
                ↓
    ⚡ Real-Time Cursor Injection (Direct keystroke paste into active window)
```

---

## ✨ Key Features

- **⚡ Real-Time Cursor Dictation**:
  - Transcribed text is typed directly into whatever text box, input field, or code editor you clicked on.
  - Zero intrusive preview popups blocking your screen — sleek minimal floating HUD only.
- **⚡ Instant Settings Switching & Zero-Latency Setup**:
  - Toggling transcription formatting modes, audio input devices, speech providers (Local Whisper / Groq Cloud), or languages now executes with **0ms visual delay** through optimistic UI state updates.
  - Offloads disk file operations and utilizes smart in-memory state diffing to skip redundant Windows Registry (`reg.exe`) and Win32 hotkey re-registration hooks, eliminating 8–10s anti-virus scan pauses.
- **🎙️ Live Microphone Hotplug Detection**:
  - The microphone selector dynamically probes and detects newly connected USB or Bluetooth audio devices on demand, eliminating the need to restart the application when switching headsets.
- **🔄 Antigravity-Style In-App Online Updater**:
  - Automatically queries GitHub Releases API in the background with zero impact on startup speed.
  - **Dynamic State Indicators**: Features an interactive rotating sync indicator (`RefreshCw`) during checks and transitions to an upgrade indicator (`ArrowUpCircle`) when a newer version is ready.
  - **Floating Update Banner**: Unobtrusive top-centered notification when a new version is detected.
  - **"What's New" Release Modal**: Rich changelog preview, published date, installer size breakdown, and release highlights.
  - **Real-Time Download Streaming**: Live progress bar tracking downloaded megabytes and percentage (`forge://update-download-progress`).
  - **1-Click Seamless Installation**: Launches the installer in a resilient detached process (`CREATE_BREAKAWAY_FROM_JOB | DETACHED_PROCESS` on Windows, native `.dmg` on macOS) and smoothly restarts the application.
  - **Manual Check for Updates**: Instant check button in Settings with live version status badges (*"Up to Date"*, *"Checking..."*, or *"Update Available"*).
- **🌐 45+ Multi-Language Engine with Live Search & Auto-Detect**:
  - Full support for 45+ world languages (English, Urdu, Hindi, Arabic, Spanish, French, German, Chinese, Japanese, Russian, Turkish, etc.) plus intelligent "Auto-Detect".
  - **Live Search Dropdown**: Real-time language search picker on the Dashboard for instant selection.
  - **Script-Aware Hallucination Protection**: Non-Latin script filtering is language-aware — foreign scripts (such as Urdu or Arabic) are preserved when speaking those languages, while accidental foreign scripts during English dictation are cleanly scrubbed.
  - **Reprocess with Target Language**: Re-transcribe historical audio with on-the-fly language switching.
- **⚡ Ultra-Fast In-Memory Secret Caching (<10ms Settings Load)**:
  - Eliminated 5-6 second UI freezes when navigating pages or saving API keys through atomic in-memory credential caching with native OS vault synchronization (Windows Credential Manager & macOS Keychain).
- **📝 100% Dynamic Voice Snippets & Macro Expansions**:
  - Fully dynamic voice shortcuts and macros configured directly in the app.
  - **Next-Line Expansion**: Spoken voice triggers expand cleanly onto new lines (`\n\n`) instead of appending awkwardly to the previous sentence.
  - Live interactive sandbox to test expansions in real time.
- **🎙️ Band-Limited Anti-Aliased Audio Pipeline**:
  - High-precision audio decimation filter with sinc/Blackman windowing to resample high-definition microphone streams (48kHz/96kHz) down to Whisper's native 16kHz with zero aliasing artifacts.
  - Full CoreAudio NaN and Inf sample sanitization on macOS.
- **⚡ Dual AI Engines (Groq Cloud & Local Whisper)**:
  - **Groq Cloud LPUs**: Sub-second cloud transcription with `whisper-large-v3-turbo`.
  - **100% Offline Local Whisper**: On-device Whisper (GGUF / whisper.cpp) for complete offline privacy.
- **📊 Dynamic Accomplishment Metrics & SQLite History**:
  - Real-time analytics tracking Total Words Transcribed, Time Saved, Typing WPM, and Active Sessions based on raw recorded PCM duration.
  - Timeframe filters for **Today**, **This Week**, and **All Time** with persistent state.
  - Searchable local SQLite database with customizable retention policies (7 days, 30 days, or indefinite).
- **📱 Fluid Device-Adaptive Responsive Layout**:
  - Fully adaptive layouts supporting mobile, tablet, laptop, and multi-monitor desktop setups (`sm`, `md`, `lg`, `xl`).
  - Slide-over collapsible drawer navigation for compact displays with backdrop blur and touch-friendly controls.
- **🚀 Zero-Hang Startup**:
  - Instant background initialization on system startup via Windows Registry and macOS LaunchAgents with zero UI freeze.
- **🔒 Enterprise-Grade Key Storage**:
  - API keys are encrypted and stored in native OS secret vaults (**Windows Credential Manager & macOS Keychain**).
- **💬 Official AI NetworkX Community Hub**:
  - Direct integration with [community.ainetworkx.com](https://community.ainetworkx.com) for sharing custom voice macros, workflows, feature requests, and community support.

---

## 💻 Platform Support & Compatibility

| Platform | Supported OS Versions | Architecture | Output Injection | Status |
| :--- | :--- | :--- | :--- | :--- |
| **🪟 Windows** | Windows 10 (64-bit, v19041+) & Windows 11 | `x86_64` / ARM64 | `Ctrl + V` Virtual Key + Registry Auto-Start | ✅ Supported (`.exe` NSIS) |
| **🍎 macOS** | macOS 12 (Monterey), 13 (Ventura), 14 (Sonoma), 15 (Sequoia)+ | `aarch64` (Apple Silicon M1-M4) & `x86_64` (Intel) | `Cmd + V` (`Meta + v`) Main-Thread CGEvent | ✅ Supported (`.dmg` / `.app`) |
| **🐧 Linux** | Ubuntu 20.04+, Debian 11+, Fedora 36+, Arch Linux | `x86_64` | Native X11 / Wayland Paste Injection | 🚧 In Progress |

---

## ⚙️ System & Hardware Requirements

| Requirement | ⚡ Cloud Mode (Groq Cloud) | 🔒 Offline Local Mode (Whisper.cpp) |
| :--- | :--- | :--- |
| **Memory (RAM)** | **512 MB minimum** (App uses ~100–250 MB) | **2 GB – 4 GB RAM** (Tiny/Base/Small models)<br>**8 GB+ RAM** (Large-v3 models) |
| **Disk Space** | **~50 MB** for the desktop application | **~50 MB** + Model Weight:<br>• Base: ~140 MB<br>• Small: ~460 MB<br>• Medium/Turbo: ~1.5 GB<br>• Large-v3: ~3.1 GB |
| **Processor (CPU/GPU)**| Any dual-core Intel, AMD, or Apple Silicon CPU | • **Windows/Linux**: Intel/AMD x86_64 with AVX2 support<br>• **macOS**: Apple Silicon (M1/M2/M3/M4) or Intel Core i5/i7 |
| **Microphone** | Any built-in or USB microphone | Any built-in or USB microphone |
| **Internet Connection**| Required for cloud speech transcription | **100% Offline** (Zero internet required) |

---

## 🚀 How Speech Processing Works in Practice

| Feature | Spoken Input | Formatted Output |
| :--- | :--- | :--- |
| **Filler Removal** | *"Um, we should, ah, deploy the new release."* | *"We should deploy the new release."* |
| **Self-Correction** | *"Let's ship on Tuesday, wait no Thursday morning."* | *"Let's ship on Thursday morning."* |
| **Spoken Lists** | *"todo item review pull request todo item run tests"* | `• [ ] review pull request`<br>`• [ ] run tests` |
| **Word Mappings** | *"check this in vs code with py torch and groq"* | *"check this in VS Code with PyTorch and Groq"* |
| **Spoken Emails** | *"email slide to ali dot khan at the rate gmail dot com"* | *"email slide to ali.khan@gmail.com"* |
| **Dynamic Snippets** | *"please review this update my signature"* | *"please review this update<br><br>Best regards,<br>Ali Zazan<br>Lead Developer"* |

---

## 🗣️ Spoken Voice Commands

Forge Wisper recognizes natural speech cues, spoken emails, and punctuation out of the box:

| Category | Spoken Phrase | Output |
| :--- | :--- | :--- |
| **Emails** | `"ali dot khan at gmail dot com"`, `"ali. Khan at the gmail. Com"` | `ali.khan@gmail.com` |
| **Websites** | `"visit www dot google dot com for search"` | `visit www.google.com for search` |
| **Structure** | `"new paragraph"` / `"next paragraph"` | `\n\n` (Double Line Break) |
| **Structure** | `"new line"` / `"next line"` | `\n` (Single Line Break) |
| **Lists** | `"bullet point"` / `"bullet"` | `\n- ` (Bullet Item) |
| **Checklists** | `"checkbox"` / `"todo item"` | `\n- [ ] ` (Task Item) |
| **Punctuation** | `"comma"`, `"period"`, `"question mark"`, `"exclamation mark"` | `,` `.` `?` `!` |
| **Symbols** | `"open parenthesis"`, `"close parenthesis"`, `"quote"` | `(` `)` `"` |
| **Symbols** | `"at sign"`, `"hashtag"`, `"colon"`, `"semicolon"` | `@` `#` `:` `;` |

---

## 🏗️ Architecture & Monorepo Structure

```text
forge-wisper/
├── apps/
│   ├── desktop/                 # Tauri v2 + React 18 + TypeScript + Tailwind Desktop Client
│   │   ├── src/                 # Application UI views, state, and components
│   │   │   ├── views/           # Dashboard, History, ModelManager, Dictionary, Settings, FloatingRecorder
│   │   │   ├── components/      # ForgeLogo and shared UI icon components
│   │   │   ├── types/           # TypeScript interfaces, settings schema & supported languages
│   │   │   └── lib/             # Tauri IPC bridge wrappers (audio, storage, shortcuts)
│   │   └── src-tauri/           # Tauri Rust Application Entry, System Tray, Global Hotkeys & Native Bridge
│   └── macOS/                   # macOS build scripts, entitlements, and universal binary setup
├── crates/                      # Modular, Testable Rust Backend Micro-Crates
│   ├── audio/                   # Low-latency microphone recording (cpal + hound + sinc decimation)
│   ├── cleanup/                 # Rule-based cleanup, email normalization & foreign script filtering
│   ├── output/                  # Native OS input injection & keyboard paste simulator
│   ├── security/                # OS Keyring credential storage (Groq API keys)
│   ├── storage/                 # SQLite database engine & transcript retention
│   ├── transcription/           # Provider abstraction traits for speech engines
│   └── verification/            # Entity preservation & safety verification layer
├── models/                      # Local offline Whisper GGUF model storage directory
└── providers/                   # Speech Recognition Providers
    ├── groq/                    # Cloud Whisper via Groq LPU API
    └── local-whisper/           # Offline on-device Whisper (whisper.cpp) with auto-discovery
```

---

## 🛠️ Getting Started

### Prerequisites

- **[Node.js 18+](https://nodejs.org/)** and **[pnpm](https://pnpm.io/)** (`npm install -g pnpm`)
- **[Rust](https://rustup.rs/) (1.78+)** with MSVC Build Tools on Windows
- **[Tauri v2 CLI](https://tauri.app/)** (`cargo install tauri-cli --version "^2.0.0"`)

### Installation & Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/zazanali/forge-wisper.git
   cd forge-wisper
   ```

2. **Install frontend dependencies**:
   ```bash
   pnpm install
   ```

3. **Run in Desktop Development Mode**:
   ```bash
   pnpm tauri:dev
   ```

4. **Build Production Installer / Packages**:
   ```bash
   # Windows (Generates .exe NSIS installer)
   pnpm tauri:build

   # macOS (Sets up universal targets & generates .dmg / .app bundle)
   sh apps/macOS/setup.sh
   pnpm build:macos
   ```

### Running Test Suite

```bash
# Run all unit and integration tests across all Rust crates
cargo test --workspace

# Run speech cleanup and email normalization test suite
cargo test --package forge-cleanup
```

---

## 🔒 Security & Privacy

- **No Cloud Audio Storage**: Audio recordings are processed in memory and discarded immediately after transcription.
- **Secure Key Storage**: API credentials (such as Groq keys) are stored using native OS secret vaults (Windows Credential Manager, macOS Keychain, Linux Secret Service) via the `keyring` crate.
- **Local-First Processing**: When using **Local Whisper**, 100% of speech recognition and text cleaning happens entirely on your local CPU/GPU with zero network requests.

---

## 💬 Community & Support

Join the official **Forge Wisper & AI NetworkX Community** to discuss new features, exchange custom voice macros, report issues, and collaborate:

- 🌐 **Community Forum**: [community.ainetworkx.com](https://community.ainetworkx.com)
- 🐛 **Issue Tracker**: [GitHub Issues](https://github.com/zazanali/forge-wisper/issues)
- 💡 **Discussions**: [GitHub Discussions](https://github.com/zazanali/forge-wisper/discussions)

---

## 🤝 Contributing

Contributions are welcome! If you'd like to help improve Forge Wisper:

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 👤 Author & Creator

**Ali Zazan**
- GitHub: [@zazanali](https://github.com/zazanali)
- Repository: [Forge Wisper](https://github.com/zazanali/forge-wisper)

---

## 👥 Contributors

Thank you to everyone who has helped build and improve **Forge Wisper**!

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/zazanali">
        <img src="https://github.com/zazanali.png" width="70px;" alt="Ali Zazan" style="border-radius: 50%;" /><br />
        <sub><b>Ali Zazan</b></sub>
      </a><br />
      <sub>Creator & Core Architecture</sub>
    </td>
    <td align="center">
      <a href="https://github.com/ihtisham-code">
        <img src="https://github.com/ihtisham-code.png" width="70px;" alt="Ihtisham Hussain" style="border-radius: 50%;" /><br />
        <sub><b>Ihtisham Hussain</b></sub>
      </a><br />
      <sub>Native macOS Support & Packaging</sub>
    </td>
  </tr>
</table>

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for more information.

Third-party models (such as OpenAI Whisper models) remain subject to their respective original licenses.
