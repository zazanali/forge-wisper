import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AppSettings,
  AudioDeviceInfo,
  HardwareRecommendation,
  HistoryRecord,
  LocalModelInfo,
  ProcessingState,
  FormattingMode,
} from "../types";

export const api = {
  getProcessingState: () => invoke<ProcessingState>("get_processing_state"),
  startRecording: () => invoke<void>("start_recording"),
  getMicLevel: () => invoke<number>("get_mic_level"),
  stopRecording: () => invoke<string>("stop_recording"),
  cancelRecording: () => invoke<void>("cancel_recording"),

  getSettings: () => invoke<AppSettings>("get_settings"),
  updateSettings: (settings: AppSettings) =>
    invoke<void>("update_settings", { settings }),

  getAudioDevices: () => invoke<AudioDeviceInfo[]>("get_audio_devices"),

  getGroqKeyStatus: () => invoke<boolean>("get_groq_api_key_status"),
  setGroqKey: (apiKey: string) =>
    invoke<void>("set_groq_api_key", { apiKey }),
  deleteGroqKey: () => invoke<void>("delete_groq_api_key"),
  testGroqConnection: (apiKey: string) =>
    invoke<boolean>("test_groq_connection", { apiKey }),

  listHistory: (limit = 50, search?: string) =>
    invoke<HistoryRecord[]>("list_history", { limit, search }),
  deleteHistoryItem: (id: string) =>
    invoke<boolean>("delete_history_item", { id }),
  clearHistory: () => invoke<void>("clear_history"),
  reprocessHistoryItem: (id: string, mode: FormattingMode) =>
    invoke<string>("reprocess_history_item", { id, mode }),

  listModels: () => invoke<LocalModelInfo[]>("list_models"),
  downloadModel: (modelId: string) =>
    invoke<string>("download_model", { modelId }),
  getActiveModelDownloads: () =>
    invoke<
      Record<
        string,
        {
          model_id: string;
          downloaded_bytes: number;
          total_bytes: number;
          percentage: number;
        }
      >
    >("get_active_model_downloads"),
  deleteModel: (modelId: string) =>
    invoke<boolean>("delete_model", { modelId }),
  getHardwareRecommendation: () =>
    invoke<HardwareRecommendation>("get_hardware_recommendation"),
  openUrl: (url: string) => invoke<void>("open_url", { url }),
  getAutostartStatus: () => invoke<boolean>("get_autostart_status"),
  setAutostart: (enable: boolean) =>
    invoke<void>("set_autostart_status", { enable }),

  onStateChange: (
    callback: (payload: { state: ProcessingState; error?: string }) => void
  ) => {
    return listen<{ state: ProcessingState; error?: string }>(
      "forge://state-changed",
      (event) => callback(event.payload)
    );
  },

  onModelDownloadProgress: (
    callback: (payload: {
      model_id: string;
      downloaded_bytes: number;
      total_bytes: number;
      percentage: number;
    }) => void
  ) => {
    return listen<{
      model_id: string;
      downloaded_bytes: number;
      total_bytes: number;
      percentage: number;
    }>("forge://model-download-progress", (event) => callback(event.payload));
  },

  onToast: (callback: (message: string) => void) => {
    return listen<string>("forge://toast", (event) => callback(event.payload));
  },
};
