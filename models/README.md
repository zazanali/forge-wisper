# 🧠 Local Whisper Models Directory

This directory stores offline GGML / GGUF model binary weights for Forge Wisper's **Local Whisper** offline speech recognition engine.

---

## 📦 Supported Model Weights

| Model Name | File Name | Disk Size | Required RAM | Speed / Accuracy Profile |
| :--- | :--- | :--- | :--- | :--- |
| **Tiny** | `ggml-tiny.bin` | ~75 MB | ~390 MB | ⚡ Ultra-fast / Basic English |
| **Base** | `ggml-base.bin` | ~142 MB | ~500 MB | 🚀 Fast / Good everyday accuracy |
| **Small** | `ggml-small.bin` | ~466 MB | ~1.0 GB | ⚖️ Balanced / High accuracy |
| **Medium** | `ggml-medium.bin` | ~1.5 GB | ~2.6 GB | 🎯 High accuracy / Moderate speed |
| **Large-v3-Turbo** | `ggml-large-v3-turbo.bin` | ~1.6 GB | ~2.8 GB | ⚡ Peak accuracy & optimized speed |
| **Large-v3** | `ggml-large-v3.bin` | ~3.1 GB | ~4.7 GB | 🏆 Maximum accuracy for heavy accents |

---

## 📥 How to Download Models

### 1. In-App Model Manager (Recommended)
You can download, activate, and delete models directly from the Forge Wisper desktop UI:
- Open **Forge Wisper** $\to$ Navigate to the **Models** tab.
- Click **Download Model** next to your preferred model.
- The app automatically downloads, verifies the file integrity, and activates it.

### 2. Manual Download (Offline Airgapped Environments)
If you are deploying Forge Wisper in an offline or airgapped environment, you can download model files manually from HuggingFace:
- Source: [ggerganov/whisper.cpp on HuggingFace](https://huggingface.co/ggerganov/whisper.cpp/tree/main)
- Place the downloaded `ggml-*.bin` file directly inside this directory or in your OS app data directory (`%APPDATA%\forge\ForgeWisper\data\models` on Windows).

---

## 🔒 Git Policy

All binary weight files (`*.bin`, `*.gguf`, `*.pt`, `*.onnx`) are **gitignored** to keep the repository lightweight. Only this `README.md` is committed to version control.
