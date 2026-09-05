<div align="center">

<img src="apps/desktop/src-tauri/icons/icon.png" alt="Forge Wisper Logo" width="128" />

# Forge Wisper

**Next-Generation Open-Source Voice-to-Structured-Text Desktop Application**

*Speak naturally. Release. Receive clean, formatted, verified text directly at your cursor in real time.*

[![Total Downloads](https://img.shields.io/github/downloads/zazanali/forge-wisper/total?logo=github&label=Total%20Downloads&color=success)](https://github.com/zazanali/forge-wisper/releases)
[![Latest Release](https://img.shields.io/github/v/release/zazanali/forge-wisper?logo=github&label=Latest%20Release&color=orange)](https://github.com/zazanali/forge-wisper/releases/latest)
[![Windows Downloads](https://img.shields.io/github/downloads/zazanali/forge-wisper/total?logo=windows&logoColor=white&label=Windows%20Downloads&color=0078D6)](https://github.com/zazanali/forge-wisper/releases)
[![macOS Downloads](https://img.shields.io/github/downloads/zazanali/forge-wisper/total?logo=apple&logoColor=white&label=macOS%20Downloads&color=333333)](https://github.com/zazanali/forge-wisper/releases)

[![Rust](https://img.shields.io/badge/Rust-2021_Edition-orange?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2.0-24C8D8?logo=tauri&logoColor=white)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/zazanali/forge-wisper?style=social)](https://github.com/zazanali/forge-wisper)

</div>

---

## 📥 Downloads & Real-Time Release Stats

Download the latest production release of **Forge Wisper** for your operating system:

| Platform | Installer Type | Architecture | Live Download Counter | Download Link |
| :--- | :--- | :--- | :--- | :--- |
| **🪟 Windows** | `.exe` (NSIS Installer) | `x86_64` (Intel/AMD) / ARM64 | [![Windows Downloads](https://img.shields.io/github/downloads/zazanali/forge-wisper/total?logo=windows&logoColor=white&label=Windows&color=0078D6)](https://github.com/zazanali/forge-wisper/releases) | [**Download for Windows**](https://github.com/zazanali/forge-wisper/releases/latest) |
| **🍎 macOS** | `.dmg` / `.app` Bundle | Apple Silicon (`aarch64` M1–M4) & Intel (`x86_64`) | [![macOS Downloads](https://img.shields.io/github/downloads/zazanali/forge-wisper/total?logo=apple&logoColor=white&label=macOS&color=333333)](https://github.com/zazanali/forge-wisper/releases) | [**Download for macOS**](https://github.com/zazanali/forge-wisper/releases/latest) |
| **🐧 Linux** | `.deb` / `.AppImage` | `x86_64` | 🚧 *In Progress* | [**View Release Notes**](https://github.com/zazanali/forge-wisper/releases) |

> [!TIP]
> All download counters above update **in real time** directly from GitHub Releases API via Shields.io.

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
- **🌐 99+ Multi-Language Engine & 1-Click Quick Switcher**:
  - Full support for all 99+ languages recognized by Whisper v3 (English, Urdu, Hindi, Arabic, Spanish, French, German, Chinese, Japanese, and Auto-Detect).
  - **1-Click Header Toolbar Switcher**: Change speech recognition language instantly without opening settings.
  - **Dedicated English Attention Head Locking**: When dictating in English, the engine explicitly locks Whisper's attention heads to `"en"`, eliminating accented confusion that previously caused English speech to be transcribed into foreign scripts (e.g. Urdu/Arabic script).
  - Automatic non-Latin script token cleaner to keep English output 100% clean.
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
  - Real-time analytics tracking Total Words Transcribed, Time Saved, Typing WPM, and Active Sessions.
  - Time filters for **Today**, **This Week**, and **All Time**.
  - Searchable local SQLite database with customizable retention policies (7 days, 30 days, or indefinite).
- **🚀 Zero-Hang Startup**:
  - Instant background initialization on system startup via Windows Registry and macOS LaunchAgents with zero UI freeze.
- **🔒 Enterprise-Grade Key Storage**:
  - API keys are encrypted and stored in native OS secret vaults (**Windows Credential Manager & macOS Keychain**).

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
