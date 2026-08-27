<div align="center">

<img src="apps/desktop/src-tauri/icons/icon.png" alt="Forge Wisper Logo" width="128" />

# Forge Wisper

**Next-Generation Open-Source Voice-to-Structured-Text Desktop Application**

*Speak naturally. Release. Receive clean, formatted, verified text directly at your cursor.*

[![Rust](https://img.shields.io/badge/Rust-2021_Edition-orange?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2.0-24C8D8?logo=tauri&logoColor=white)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform: Windows & macOS](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-blue?logo=apple&logoColor=white)](#-platform-support)

</div>

---

## ⚡ What is Forge Wisper?

**Forge Wisper** is a high-performance, cross-platform, privacy-first desktop application designed around a frictionless, instant dictation workflow. Whether you're on **Windows** or **macOS (Apple Silicon M1/M2/M3/M4 & Intel)**, Forge Wisper captures your voice with native audio drivers, removes spoken pauses, executes self-corrections, formats lists, and injects clean text directly into your active window.

```text
[ Global Shortcut: Ctrl + Space (Win) / Cmd + Space (Mac) ]
                ↓
    🎙️ Speak Naturally (with pauses, corrections, or list items)
                ↓
    ⚡ Speech Recognition (Groq LPUs / Offline Local Whisper)
                ↓
    🧠 Rule-Based Cleaner (Filler Removal + Intent Correction)
                ↓
    🛡️ Verification Engine (Preserves numbers, dates & technical terms)
                ↓
    📋 Safe Auto-Paste into Active Application (with Clipboard Fallback)
```

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

## ✨ Key Features

- **⚡ Blazing Fast Cloud Transcription (Groq Whisper)**: Sub-second audio processing with `whisper-large-v3-turbo` powered by Groq LPUs. API keys are safely stored in your native OS Keyring (**Windows Credential Vault & macOS Keychain**).
- **🔒 Private & Offline Local Whisper**: Run Whisper directly on your machine (whisper.cpp / GGUF models) without any audio or text ever leaving your device.
- **🍎 Native macOS Compatibility**: CoreAudio NaN-sanitized recording, Apple microphone permission integration (`Info.plist`), and universal binary packaging.
- **🚀 Auto-Start on System Boot**: Automatically launches in the background on startup, instantly ready for your global hotkey.
- **🧠 Intelligent Rule-Based Voice Cleaner**:
  - **Filler Removal**: Automatically purges verbal crutches like *"um"*, *"ah"*, *"like, you know"*.
  - **Real-Time Self-Correction**: Say *"meet at 5 PM, no actually 6 PM"* $\to$ outputs *"6 PM"*.
  - **Contextual Formatting**: Spoken commands (*"bullet point"*, *"new line"*, *"todo item"*) format directly into clean markdown structures.
- **📖 Personal Dictionary & Voice Macro Expansions**:
  - **Phonetic Word Mappings**: Corrects brand names and technical jargon (e.g. *"lang chain"* $\to$ `LangChain`, *"postgres"* $\to$ `PostgreSQL`).
  - **Voice Snippets & Prompt Shortcuts**: Speak triggers like *"my signature"* or *"meeting notes"* to expand full formatted templates.
  - **Live Testing Sandbox**: Built-in interactive sandbox to test expansions in real time.
- **🛡️ Verification & Safe Auto-Paste**:
  - Cross-verifies entity integrity (dates, currencies, numbers) between raw and cleaned text to prevent dropped details.
  - Native OS simulated keyboard paste (fully optimized for Windows, macOS, and Linux) into whatever window currently has text focus, with automatic clipboard backup.
- **📚 Searchable SQLite History**:
  - Search past dictations, copy raw or cleaned transcripts, and configure automated data retention policies (7 days, 30 days, or indefinite).
- **🎨 Forge Modern Aesthetic**:
  - Precision dark and light modes with responsive typography, real-time reactive audio HUD, and clean minimal controls.

---

## 🚀 How Speech Processing Works in Practice

| Feature | Spoken Input | Formatted Output |
| :--- | :--- | :--- |
| **Filler Removal** | *"Um, we should, ah, deploy the new release."* | *"We should deploy the new release."* |
| **Self-Correction** | *"Let's ship on Tuesday, wait no Thursday morning."* | *"Let's ship on Thursday morning."* |
| **Spoken Lists** | *"todo item review pull request todo item run tests"* | `• [ ] review pull request`<br>`• [ ] run tests` |
| **Word Mappings** | *"check this in vs code with py torch and groq"* | *"check this in VS Code with PyTorch and Groq"* |
| **Spoken Emails** | *"email slide to ali dot khan at the rate gmail dot com"* | *"email slide to ali.khan@gmail.com"* |
| **Voice Macros** | *"please review this update my signature"* | *"please review this update<br><br>Best regards,<br>Zazan Ali<br>Lead Developer"* |

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
│   └── desktop/                 # Tauri v2 + React 19 + TypeScript + Tailwind Frontend
│       ├── src/                 # Application UI views & components
│       │   ├── views/           # Dashboard, History, Models, Dictionary, Settings
│       │   └── components/      # ForgeLogo, FloatingRecorder, Navigation
│       └── src-tauri/           # Tauri Rust Application Entry & Global Shortcut Handler
├── crates/                      # Modular, Testable Rust Backend Micro-Crates
│   ├── audio/                   # Low-latency microphone recording (cpal + hound)
│   ├── cleanup/                 # Rule-based cleanup, email normalization & word dictionary
│   ├── output/                  # Native OS input injection & keyboard paste simulator
│   ├── security/                # OS Keyring credential storage (Groq API keys)
│   ├── storage/                 # SQLite database engine & transcript retention
│   ├── transcription/           # Provider abstraction traits for speech engines
│   └── verification/            # Entity preservation & safety verification layer
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
- **Local-First Processing**: When using **Local Whisper**, 100% of speech recognition and text cleaning happens entirely on your local CPU/GPU with no internet access required.

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
