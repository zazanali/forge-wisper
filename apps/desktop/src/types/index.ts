export type ProcessingState =
  | "Idle"
  | "Listening"
  | "Stopping"
  | "Transcribing"
  | "Cleaning"
  | "Structuring"
  | "Verifying"
  | "Inserting"
  | "Success"
  | "Cancelled"
  | "Error";

export type FormattingMode = "Raw" | "Clean" | "Structured" | "Smart";

export type RetentionPolicy = "Forever" | "Days30" | "Days7" | "Off";

export interface AppSettings {
  provider: string;
  model: string;
  microphone: string | null;
  language?: string;
  formatting_mode: FormattingMode;
  hotkey: string;
  is_toggle_mode: boolean;
  retention_policy: RetentionPolicy;
  dictionary: Record<string, string>;
  snippets: Record<string, string>;
  theme: "dark" | "light" | "system";
  launch_at_startup?: boolean;
  auto_check_updates?: boolean;
  output_mode?: "realtime_stream" | "progressive" | "instant_paste";
  typing_delay_ms?: number;
}

export type SettingsPatch = Partial<AppSettings>;

export interface VulkanDevice {
  device_index: number;
  device_name: string;
  device_type: string;
  vendor_id: number;
  vendor_name: string;
  driver_version: string;
  dedicated_vram_mb: number;
  is_discrete: boolean;
}

export interface BackendDiagnostics {
  is_vulkan_available: boolean;
  active_backend: string;
  active_device_name?: string | null;
  active_device_index?: number | null;
  dedicated_vram_mb?: number | null;
  available_devices: VulkanDevice[];
  fallback_reason?: string | null;
}

export interface UpdateInfo {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  release_title: string;
  release_notes: string;
  published_at: string;
  download_url: string;
  asset_name: string;
  asset_size_bytes: number;
}

export interface UpdateDownloadProgress {
  percentage: number;
  downloaded_bytes: number;
  total_bytes: number;
}

export interface LiveTranscriptPayload {
  text: string;
  delta?: string;
  is_partial: boolean;
}

export interface AudioDeviceInfo {
  name: string;
  is_default: boolean;
}

export interface HistoryRecord {
  id: string;
  created_at: string;
  app_name: string | null;
  provider_id: string;
  model_name: string;
  raw_text: string;
  final_text: string;
  duration_ms: number;
  verification_status: string;
}

export interface HistoryStats {
  total_records: number;
  total_words: number;
  total_duration_ms: number;
}

export interface HistoryPage {
  records: HistoryRecord[];
  total_count: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export type ModelFamily = "whisper" | "parakeet";
export type ModelFormat = "ggml" | "onnx_archive";

export interface LocalModelInfo {
  id: string;
  name: string;
  filename: string;
  size_mb: number;
  ram_estimate_mb: number;
  download_url: string;
  is_installed: boolean;
  is_default: boolean;
  family?: ModelFamily;
  format?: ModelFormat;
  tier_tag?: string;
  sha256?: string;
  expected_bytes?: number;
}

export interface HardwareRecommendation {
  logical_cores: number;
  estimated_ram_gb: number;
  recommended_model_id: string;
  recommended_model_name: string;
  recommended_family: ModelFamily;
  reason: string;
}

export interface LanguageOption {
  code: string;
  name: string;
  nativeName?: string;
  flag?: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "auto", name: "Auto-Detect Language", nativeName: "Automatic", flag: "🌐" },
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱" },
  { code: "pl", name: "Polish", nativeName: "Polski", flag: "🇵🇱" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  { code: "zh", name: "Chinese (Mandarin)", nativeName: "中文", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  { code: "ur", name: "Urdu", nativeName: "اردو", flag: "🇵🇰" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳" },
  { code: "th", name: "Thai", nativeName: "ไทย", flag: "🇹🇭" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "sv", name: "Swedish", nativeName: "Svenska", flag: "🇸🇪" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", flag: "🇺🇦" },
  { code: "cs", name: "Czech", nativeName: "Čeština", flag: "🇨🇿" },
  { code: "ro", name: "Romanian", nativeName: "Română", flag: "🇷🇴" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά", flag: "🇬🇷" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar", flag: "🇭🇺" },
  { code: "he", name: "Hebrew", nativeName: "עברית", flag: "🇮🇱" },
  { code: "fa", name: "Persian", nativeName: "فارسی", flag: "🇮🇷" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇧🇩" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", flag: "🇮🇳" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "tl", name: "Tagalog", nativeName: "Filipino", flag: "🇵🇭" },
  { code: "da", name: "Danish", nativeName: "Dansk", flag: "🇩🇰" },
  { code: "fi", name: "Finnish", nativeName: "Suomi", flag: "🇫🇮" },
  { code: "no", name: "Norwegian", nativeName: "Norsk", flag: "🇳🇴" },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina", flag: "🇸🇰" },
  { code: "bg", name: "Bulgarian", nativeName: "Български", flag: "🇧🇬" },
  { code: "hr", name: "Croatian", nativeName: "Hrvatski", flag: "🇭🇷" },
  { code: "sr", name: "Serbian", nativeName: "Српски", flag: "🇷🇸" },
  { code: "sl", name: "Slovenian", nativeName: "Slovenščina", flag: "🇸🇮" },
  { code: "et", name: "Estonian", nativeName: "Eesti", flag: "🇪🇪" },
  { code: "lv", name: "Latvian", nativeName: "Latviešu", flag: "🇱🇻" },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuvių", flag: "🇱🇹" },
];
