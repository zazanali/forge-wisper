# Whisper Models Directory

This directory stores offline Whisper GGML / GGUF model files for Forge Wisper's **Local Whisper** provider.

## Supported Models

| Model | File Name | Disk Size | Required RAM | Speed / Accuracy |
| :--- | :--- | :--- | :--- | :--- |
| **Tiny** | `ggml-tiny.bin` | ~75 MB | ~390 MB | Fastest / Basic |
| **Base** | `ggml-base.bin` | ~142 MB | ~500 MB | Fast / Good |
| **Small** | `ggml-small.bin` | ~466 MB | ~1.0 GB | Balanced / Very Good |
| **Medium** | `ggml-medium.bin` | ~1.5 GB | ~2.6 GB | Moderate / High |
| **Large-v3-Turbo** | `ggml-large-v3-turbo.bin` | ~1.6 GB | ~2.8 GB | Fast / Excellent |
| **Large-v3** | `ggml-large-v3.bin` | ~3.1 GB | ~4.7 GB | High Accuracy / Peak |

Model binary files (`*.bin`, `*.gguf`) in this directory are gitignored. You can download and manage them directly through the Forge Wisper **Model Manager** UI.
