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
  formatting_mode: FormattingMode;
  hotkey: string;
  is_toggle_mode: boolean;
  retention_policy: RetentionPolicy;
  dictionary: Record<string, string>;
  snippets: Record<string, string>;
  theme: "dark" | "light" | "system";
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

export interface LocalModelInfo {
  id: string;
  name: string;
  filename: string;
  size_mb: number;
  ram_estimate_mb: number;
  download_url: string;
  is_installed: boolean;
  is_default: boolean;
}

export interface HardwareRecommendation {
  logical_cores: number;
  estimated_ram_gb: number;
  recommended_model_id: string;
  reason: string;
}
