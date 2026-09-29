# 🧠 Local Speech Models Directory

This directory stores offline GGML / GGUF model binary weights and ONNX model directories for Forge Wisper's **Local Speech Recognition** engines (Whisper.cpp and FastConformer Parakeet ONNX).

---

## 📦 Supported Model Weights

| Model Name | Engine / Format | File / Directory Name | Disk Size | Required RAM | Speed / Accuracy Profile |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Parakeet V3 Int8** | ⚡ Parakeet ONNX | `parakeet-v3-int8/` | ~670 MB | ~1.2 GB | ⚡ Ultra-fast CPU/GPU, low latency |
| **Tiny** | 🔒 Whisper GGML | `ggml-tiny.bin` | ~75 MB | ~390 MB | ⚡ Ultra-fast / Basic English |
| **Base** | 🔒 Whisper GGML | `ggml-base.bin` | ~142 MB | ~500 MB | 🚀 Fast / Good everyday accuracy |
| **Small** | 🔒 Whisper GGML | `ggml-small.bin` | ~466 MB | ~1.0 GB | ⚖️ Balanced / High accuracy |
| **Medium** | 🔒 Whisper GGML | `ggml-medium.bin` | ~1.5 GB | ~2.6 GB | 🎯 High accuracy / Moderate speed |
| **Large-v3-Turbo** | 🔒 Whisper GGML | `ggml-large-v3-turbo.bin` | ~1.6 GB | ~2.8 GB | ⚡ Peak accuracy & optimized speed |
| **Large-v3** | 🔒 Whisper GGML | `ggml-large-v3.bin` | ~3.1 GB | ~4.7 GB | 🏆 Maximum accuracy for heavy accents |

---

## 📥 How to Download Models

### 1. In-App Model Manager (Recommended)
You can download, activate, and delete models directly from the Forge Wisper desktop UI:
- Open **Forge Wisper** $\to$ Navigate to the **Local Models** tab.
- Click **Download Model** next to your preferred model.
- The app automatically streams weights, tracks real-time progress, validates cryptographic checksums (SHA-256), and activates the model immediately.

### 2. Manual Download (Airgapped / Offline Environments)
If you are deploying Forge Wisper in an offline or airgapped environment, you can download model files manually:
- **Whisper Models**: [ggerganov/whisper.cpp on Hugging Face](https://huggingface.co/ggerganov/whisper.cpp/tree/main) (`ggml-*.bin`)
- **Parakeet Model**: [istupakov/parakeet-tdt-0.6b-v3-onnx on Hugging Face](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx) (`config.json`, `vocab.txt`, `nemo128.onnx`, `decoder_joint-model.int8.onnx`, `encoder-model.int8.onnx`)
- Place downloaded weights inside `%APPDATA%\com.forge.ForgeWisper\models\` (Windows) or `~/Library/Application Support/com.forge.ForgeWisper/models/` (macOS).

---

## 🔒 Git Policy

All binary weight files (`*.bin`, `*.gguf`, `*.pt`, `*.onnx`) are **gitignored** to keep the repository lightweight. Only this `README.md` is committed to version control.
