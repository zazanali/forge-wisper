import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/tauri";
import {
  SUPPORTED_LANGUAGES,
  type AudioDeviceInfo,
  type FormattingMode,
  type RetentionPolicy,
  type UpdateInfo,
  type SettingsPatch,
} from "../types";
import { ForgeLogo } from "../components/ForgeLogo";
import { UpdateModal } from "../components/UpdateModal";
import aiNetworkXLogo from "@/assets/ainetworkx-logo.png";
import {
  Zap,
  Cpu,
  Mic,
  Key,
  Keyboard,
  Shield,
  Check,
  Loader2,
  AlertCircle,
  Sun,
  Moon,
  Monitor,
  Palette,
  Trash2,
  Sparkles,
  RefreshCw,
  ArrowUpCircle,
  Sliders,
  Lock,
  Volume2,
  Info,
  Eye,
  EyeOff,
  Radio,
  RotateCcw,
  ExternalLink,
  Globe,
  Languages,
  Search,
  Download,
} from "lucide-react";
import { Card, Badge, Toggle, Dropdown } from "../components/ui";
import { appStore, useAppStore } from "../state/appStore";

interface SettingsViewProps {
  onNavigate?: (tab: any) => void;
}

type SettingsCategory = "engine" | "language" | "shortcuts" | "security" | "appearance" | "about";

export const formatKeyForDisplay = (keyStr: string): string => {
  const k = keyStr.trim();
  if (k === "Control" || k === "Ctrl") return "Ctrl";
  if (k === "Super" || k === "Meta" || k === "Command" || k === "Cmd" || k === "Win" || k === "Windows") return "Win";
  if (k.startsWith("Key") && k.length === 4) return k.slice(3);
  if (k.startsWith("Digit") && k.length === 6) return k.slice(5);
  return k;
};

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate: _onNavigate }) => {
  const store = useAppStore();
  const settings = store.settings;

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("engine");
  const [audioDevices, setAudioDevices] = useState<AudioDeviceInfo[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    msg: string;
  } | null>(null);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [languageSearch, setLanguageSearch] = useState("");

  // Online Update State
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateCheckResult, setUpdateCheckResult] = useState<UpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Hotkey Recorder State
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [hotkeyFeedback, setHotkeyFeedback] = useState<string | null>(null);

  // Microphone Live Testing
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    api.getGroqKeyStatus()
      .then((status) => setHasStoredKey(status))
      .catch(() => setHasStoredKey(false));

    api.getAudioDevices()
      .then((devices) => setAudioDevices(devices || []))
      .catch((e) => console.error("Audio devices load warning:", e));
  }, []);

  const handlePatch = async (patch: SettingsPatch) => {
    try {
      await appStore.patchSettings(patch);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      return true;
    } catch (e: any) {
      console.error("Patch settings error:", e);
      const errorMsg = typeof e === "string" ? e : e?.message || "Failed to update settings";
      setHotkeyFeedback(`❌ ${errorMsg}`);
      setTimeout(() => setHotkeyFeedback(null), 5000);
      return false;
    }
  };

  const handleSelectLanguage = (code: string) => {
    const isValid = code === "auto" || SUPPORTED_LANGUAGES.some((l) => l.code === code);
    if (!isValid) return;
    handlePatch({ language: code });
  };

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const info = await api.checkForUpdates(true);
      setUpdateCheckResult(info);
      if (info.has_update) {
        setIsUpdateModalOpen(true);
      }
    } catch (err) {
      console.error("Update check failed:", err);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const toggleMicTest = async () => {
    if (isMicTesting) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      try {
        await api.cancelRecording();
      } catch {
        // ignore
      }
      setIsMicTesting(false);
      setMicLevel(0);
      return;
    }

    try {
      await api.startRecording();
      setIsMicTesting(true);

      intervalRef.current = window.setInterval(async () => {
        try {
          const rms = await api.getMicLevel();
          const percent = Math.min(100, Math.round(rms * 500));
          setMicLevel(percent);
        } catch {
          // ignore
        }
      }, 60);
    } catch (e) {
      alert(`Microphone Error: ${e}`);
    }
  };

  // Keyboard Event Listener for Hotkey Recording
  useEffect(() => {
    if (!isRecordingHotkey) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const k = e.key;
      const code = e.code;

      if (k === "Escape") {
        setIsRecordingHotkey(false);
        setRecordedKeys([]);
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Control");
      if (e.metaKey) parts.push("Super");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");

      let mainKey = "";
      if (code === "Space") mainKey = "Space";
      else if (code.startsWith("F") && !isNaN(Number(code.slice(1)))) mainKey = code;
      else if (code.startsWith("Key")) mainKey = code;
      else if (code.startsWith("Digit")) mainKey = code;
      else if (code === "Tab") mainKey = "Tab";
      else if (code === "Backquote") mainKey = "Backquote";
      else if (code === "Minus") mainKey = "Minus";
      else if (code === "Equal") mainKey = "Equal";
      else if (code === "BracketLeft") mainKey = "BracketLeft";
      else if (code === "BracketRight") mainKey = "BracketRight";
      else if (code === "Semicolon") mainKey = "Semicolon";
      else if (code === "Quote") mainKey = "Quote";
      else if (code === "Comma") mainKey = "Comma";
      else if (code === "Period") mainKey = "Period";
      else if (code === "Slash") mainKey = "Slash";

      if (mainKey && !parts.includes(mainKey)) {
        parts.push(mainKey);
      }

      if (parts.length > 0) {
        setRecordedKeys(parts);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecordingHotkey]);

  const saveGroqKey = async () => {
    const keyToSave = apiKeyInput.trim();
    if (!keyToSave) return;
    try {
      setApiKeyInput("");
      setHasStoredKey(true);
      setIsKeySaved(true);
      setTestResult({ success: true, msg: "API Key saved securely in OS Keyring & local vault" });
      setTimeout(() => setIsKeySaved(false), 3000);

      await api.setGroqKey(keyToSave);
    } catch (e) {
      setHasStoredKey(false);
      setTestResult({ success: false, msg: `Failed to save key: ${e}` });
    }
  };

  const deleteGroqKey = async () => {
    if (window.confirm("Are you sure you want to remove the stored Groq API key?")) {
      try {
        await api.deleteGroqKey();
        setHasStoredKey(false);
        setApiKeyInput("");
        setTestResult({ success: true, msg: "API Key removed from secure storage" });
      } catch (e) {
        setTestResult({ success: false, msg: `Failed to delete key: ${e}` });
      }
    }
  };

  const testConnection = async () => {
    setIsTestingKey(true);
    setTestResult(null);
    try {
      const ok = await api.testGroqConnection(apiKeyInput.trim());
      if (ok) {
        setTestResult({ success: true, msg: "Connection verified! Cloud transcription is ready." });
      }
    } catch (e) {
      setTestResult({ success: false, msg: String(e) });
    } finally {
      setIsTestingKey(false);
    }
  };



  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-[var(--text-muted)] font-mono text-[13px]">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  const categories: { id: SettingsCategory; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "engine", label: "Engine & Audio", icon: Cpu },
    { id: "language", label: "Language & Speech", icon: Globe },
    { id: "shortcuts", label: "Hotkeys", icon: Keyboard },
    { id: "security", label: "API Credentials", icon: Key },
    { id: "appearance", label: "Appearance & Privacy", icon: Palette },
    { id: "about", label: "About System", icon: Info },
  ];

  return (
    <div className="space-y-5 animate-fadeIn font-sans w-full pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[var(--accent)]" />
            Preferences &amp; System Settings
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Configure your speech recognition engines, global shortcuts, audio devices, and privacy parameters.
          </p>
        </div>

        {saveSuccess && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--success)] bg-[var(--success-bg)] px-2.5 py-1 rounded-[6px] border border-[var(--success-border)] font-medium font-mono shrink-0 animate-fadeIn">
            <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Preferences Saved
          </span>
        )}
      </div>

      {/* Category Navigation Bar */}
      <div className="flex items-center gap-1 p-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[8px] overflow-x-auto custom-scrollbar">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-1 min-w-[120px] shrink-0 whitespace-nowrap flex items-center justify-center gap-2 px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-all cursor-pointer select-none ${
                isActive
                  ? "bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] font-semibold shadow-2xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-transparent"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* CATEGORY 1: Engine & Audio */}
      {activeCategory === "engine" && (
        <div className="space-y-5 animate-fadeIn">
          {/* Provider Selection Cards */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-semibold text-[var(--accent)] uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Cpu className="w-4 h-4" /> Active Transcription Provider
              </h3>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">Select processing backend</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Groq Cloud Option */}
              <div
                onClick={() =>
                  handlePatch({
                    provider: "groq",
                    model: "whisper-large-v3-turbo",
                  })
                }
                className={`forge-card p-4 rounded-[8px] transition-all cursor-pointer bg-[var(--surface-primary)] border flex flex-col justify-between ${
                  settings.provider === "groq"
                    ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                    : "border-[var(--border)] hover:border-[var(--accent-border)]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="p-2 rounded-[6px] bg-[var(--surface-elevated)] text-[var(--warning)]">
                      <Zap className="w-4 h-4" />
                    </div>
                    {settings.provider === "groq" ? (
                      <Badge variant="accent" hasDot>
                        ACTIVE
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">Cloud LPU</span>
                    )}
                  </div>
                  <div className="font-semibold text-[14px] text-[var(--text-primary)]">Groq Cloud Whisper</div>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                    Ultra-low latency transcription powered by Groq custom LPUs (~200ms processing speed).
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[12px] font-mono text-[var(--text-secondary)]">
                  <span>whisper-large-v3-turbo</span>
                  <span className="text-[var(--warning)] font-medium">Cloud LPU</span>
                </div>
              </div>

              {/* Local Whisper Option */}
              <div
                onClick={() =>
                  handlePatch({
                    provider: "local-whisper",
                    model: "parakeet-v3-int8",
                  })
                }
                className={`forge-card p-4 rounded-[8px] transition-all cursor-pointer bg-[var(--surface-primary)] border flex flex-col justify-between ${
                  settings.provider === "local-whisper"
                    ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                    : "border-[var(--border)] hover:border-[var(--accent-border)]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="p-2 rounded-[6px] bg-[var(--surface-elevated)] text-[var(--accent)]">
                      <Cpu className="w-4 h-4" />
                    </div>
                    {settings.provider === "local-whisper" ? (
                      <Badge variant="accent" hasDot>
                        ACTIVE
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">100% Offline</span>
                    )}
                  </div>
                  <div className="font-semibold text-[14px] text-[var(--text-primary)]">Local Offline Whisper &amp; Parakeet</div>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                    100% private offline transcription running on your local machine using ONNX or GGML model runtimes.
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[12px] font-mono text-[var(--text-secondary)]">
                  <span>Zero internet needed</span>
                  <span className="text-[var(--accent)] font-medium">100% Private</span>
                </div>
              </div>
            </div>
          </div>

          {/* Model & Microphone Device Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Card: Active Model Dropdown */}
            <Card padding="md" className="flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[var(--accent)]" /> Active Model Selection
                  </h4>
                  <Badge variant="default" size="sm" className="font-mono">
                    {settings.provider === "groq" ? "Groq API" : "Local Engine"}
                  </Badge>
                </div>

                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-3">
                  {settings.provider === "groq"
                    ? "Select the cloud Whisper model for transcription accuracy vs inference speed."
                    : "Select the local model architecture (Parakeet V3 Int8 ONNX or quantized GGML)."}
                </p>

                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-muted)] block font-mono">
                    Model Architecture
                  </label>
                  {settings.provider === "groq" ? (
                    <Dropdown
                      value={settings.model}
                      onChange={(val) => handlePatch({ model: val })}
                      options={[
                        {
                          value: "whisper-large-v3-turbo",
                          label: "whisper-large-v3-turbo",
                          description: "Fastest Latency (~200ms)",
                          badge: "Recommended",
                        },
                        {
                          value: "whisper-large-v3",
                          label: "whisper-large-v3",
                          description: "Maximum Precision Accuracy",
                        },
                      ]}
                    />
                  ) : (
                    <Dropdown
                      value={settings.model}
                      onChange={(val) => handlePatch({ model: val })}
                      options={[
                        {
                          value: "parakeet-v3-int8",
                          label: "parakeet-v3-int8",
                          description: "Ultra-Fast Int8 ONNX • 600 MB",
                          badge: "Fast Local",
                        },
                        {
                          value: "base",
                          label: "base.bin",
                          description: "Default • 142 MB • Fast",
                        },
                        {
                          value: "tiny",
                          label: "tiny.bin",
                          description: "Ultra Lightweight • 75 MB",
                        },
                        {
                          value: "small",
                          label: "small.bin",
                          description: "Balanced Accuracy • 466 MB",
                        },
                        {
                          value: "medium",
                          label: "medium.bin",
                          description: "High Accuracy • 1.5 GB",
                        },
                        {
                          value: "large-v3",
                          label: "large-v3.bin",
                          description: "Maximum Accuracy • 3.1 GB",
                        },
                      ]}
                    />
                  )}
                </div>
              </div>

              <div className="pt-2 text-[11px] font-mono text-[var(--text-muted)] flex items-center justify-between border-t border-[var(--border-subtle)]">
                <span>Active: {settings.model}</span>
                <span className="text-[var(--accent)] font-medium">Ready</span>
              </div>
            </Card>

            {/* Right Card: Microphone Device & Live Input Level */}
            <Card padding="md" className="flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-[var(--accent)]" /> Microphone Device &amp; Input
                  </h4>
                  <Badge variant="default" size="sm" className="font-mono">Auto-fallback</Badge>
                </div>

                <div className="space-y-1 mb-2">
                  <label className="text-[11px] text-[var(--text-muted)] block font-mono">Selected Input Device</label>
                  <Dropdown
                    value={settings.microphone || ""}
                    onChange={(val) => handlePatch({ microphone: val ? val : null })}
                    options={[
                      {
                        value: "",
                        label: "System Default Microphone (Automatic)",
                        description: "Auto-detect system audio input",
                      },
                      ...audioDevices.map((d) => ({
                        value: d.name,
                        label: d.name,
                        badge: d.is_default ? "OS Default" : undefined,
                      })),
                    ]}
                  />
                </div>
              </div>

              {/* Live VU Meter Bar */}
              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[var(--text-secondary)] flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Hardware VU Meter
                  </span>
                  <button
                    type="button"
                    onClick={toggleMicTest}
                    className={`px-3 py-1 rounded-[6px] text-[12px] font-medium transition-all cursor-pointer ${
                      isMicTesting ? "btn-danger" : "btn-secondary"
                    }`}
                  >
                    {isMicTesting ? "Stop Meter" : "Test Microphone"}
                  </button>
                </div>

                {isMicTesting && (
                  <div className="space-y-1 pt-1 animate-fadeIn">
                    <div className="h-2 bg-[var(--surface-elevated)] rounded-full overflow-hidden border border-[var(--border)]">
                      <div
                        className={`h-full rounded-full transition-all duration-75 ${
                          micLevel > 60
                            ? "bg-[var(--warning)]"
                            : micLevel > 10
                            ? "bg-[var(--accent)]"
                            : "bg-[var(--text-muted)]"
                        }`}
                        style={{ width: `${Math.max(4, micLevel)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                      <span>Silent</span>
                      <span className={micLevel > 15 ? "text-[var(--accent)] font-medium" : ""}>
                        {micLevel > 15 ? "Sound Wave Detected ✓" : "Speak into mic..."}
                      </span>
                      <span>Peak</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* CATEGORY 2: Language & Speech */}
      {activeCategory === "language" && (
        <div className="space-y-5 animate-fadeIn">
          {/* Active Language Hero Card */}
          <Card padding="lg" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[8px] bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent)]">
                  <Languages className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">
                    Speech Recognition Language
                  </h3>
                  <p className="text-[12px] text-[var(--text-muted)]">
                    Whisper AI automatically detects or specializes transcription across 99+ global languages
                  </p>
                </div>
              </div>

              <Badge variant="accent" className="font-mono">
                {!settings.language || settings.language === "auto"
                  ? "✨ AUTO-DETECT ACTIVE"
                  : `LOCKED: ${settings.language.toUpperCase()}`}
              </Badge>
            </div>

            {/* Quick 1-Click Popular Language Pills */}
            <div className="pt-2">
              <span className="text-[11px] font-mono text-[var(--text-muted)] block mb-2">
                Popular &amp; Frequently Used:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { code: "auto", name: "Auto-Detect", flag: "🌐" },
                  { code: "en", name: "English", flag: "🇺🇸" },
                  { code: "ur", name: "Urdu (اردو)", flag: "🇵🇰" },
                  { code: "hi", name: "Hindi (हिन्दी)", flag: "🇮🇳" },
                  { code: "es", name: "Spanish", flag: "🇪🇸" },
                  { code: "fr", name: "French", flag: "🇫🇷" },
                  { code: "de", name: "German", flag: "🇩🇪" },
                  { code: "ar", name: "Arabic (العربية)", flag: "🇸🇦" },
                  { code: "zh", name: "Chinese (中文)", flag: "🇨🇳" },
                  { code: "ja", name: "Japanese (日本語)", flag: "🇯🇵" },
                  { code: "pt", name: "Portuguese", flag: "🇧🇷" },
                  { code: "ru", name: "Russian (Русский)", flag: "🇷🇺" },
                ].map((lang) => {
                  const isSelected = (settings.language || "auto") === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleSelectLanguage(lang.code)}
                      className={`px-3 py-1.5 rounded-[7px] text-[12px] font-medium transition-all cursor-pointer flex items-center gap-1.5 border ${
                        isSelected
                          ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent)] font-semibold shadow-2xs ring-1 ring-[var(--accent)]"
                          : "bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border)]"
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                      {isSelected && <Check className="w-3 h-3 text-[var(--accent)] ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Searchable 99+ Languages Grid */}
          <Card padding="md" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[var(--accent)]" /> All 99+ Supported Whisper Languages
                </h4>
                <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                  Select any language to specialize speech decoding or search by country / name
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={languageSearch}
                  onChange={(e) => setLanguageSearch(e.target.value)}
                  placeholder="Search languages..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            {/* Language Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto p-1 pr-2 custom-scrollbar">
              {SUPPORTED_LANGUAGES.filter((lang) => {
                const q = languageSearch.toLowerCase().trim();
                if (!q) return true;
                return (
                  lang.name.toLowerCase().includes(q) ||
                  (lang.nativeName && lang.nativeName.toLowerCase().includes(q)) ||
                  lang.code.toLowerCase().includes(q)
                );
              }).map((lang) => {
                const isSelected = (settings.language || "auto") === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`p-2.5 rounded-[7px] border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent-subtle)] ring-1 ring-[var(--accent)] shadow-2xs"
                        : "border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className="text-[18px] shrink-0">{lang.flag}</span>
                      <div className="truncate">
                        <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                          {lang.name}
                        </div>
                        {lang.nativeName && (
                          <div className="text-[11px] text-[var(--text-muted)] truncate">
                            {lang.nativeName}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-primary)] border border-[var(--border)] text-[var(--text-muted)]">
                        {lang.code}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* CATEGORY 3: Hotkeys & Dictation Controls */}
      {activeCategory === "shortcuts" && (
        <div className="space-y-5 animate-fadeIn">
          {/* Global Hotkey Config */}
          <Card padding="lg" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[8px] bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent)]">
                  <Keyboard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">
                    Global System Shortcut
                  </h3>
                  <p className="text-[12px] text-[var(--text-muted)]">
                    Hold or press anywhere in Windows to trigger audio dictation
                  </p>
                </div>
              </div>

              {settings.hotkey !== "Control+Space" && (
                <button
                  type="button"
                  onClick={() => {
                    handlePatch({ hotkey: "Control+Space" });
                    setHotkeyFeedback("✓ Reset to default Ctrl + Space");
                    setTimeout(() => setHotkeyFeedback(null), 3000);
                  }}
                  title="Reset to default (Ctrl + Space)"
                  className="p-1.5 rounded-[6px] hover:bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border)] transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Interactive Hero Keypad Box */}
            <div
              onClick={() => {
                setIsRecordingHotkey(true);
                setRecordedKeys([]);
              }}
              className={`p-4 rounded-[10px] border transition-all cursor-pointer select-none flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isRecordingHotkey
                  ? "bg-[var(--accent-subtle)] border-[var(--accent)] shadow-[0_0_24px_rgba(var(--accent-rgb),0.15)] ring-1 ring-[var(--accent)]"
                  : "bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border-[var(--border)] hover:border-[var(--accent-border)] shadow-inner"
              }`}
            >
              {/* Left: Keycaps or Active Recording State */}
              <div className="flex items-center gap-2 flex-wrap">
                {isRecordingHotkey ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-ping mr-1" />
                    <span className="text-[12px] font-mono text-[var(--accent)] font-medium">
                      Press keys now:
                    </span>
                    {recordedKeys.length > 0 ? (
                      recordedKeys.map((keyPart, idx) => (
                        <kbd
                          key={idx}
                          className="px-3 py-1.5 rounded-[6px] bg-[var(--surface-primary)] border border-[var(--accent-border)] text-[13px] font-mono font-bold text-[var(--accent)] shadow-sm"
                        >
                          {formatKeyForDisplay(keyPart)}
                        </kbd>
                      ))
                    ) : (
                      <span className="text-[12px] text-[var(--text-muted)] font-mono animate-pulse">
                        Listening... (e.g. Ctrl + Win, Alt + Space)
                      </span>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(settings.hotkey || "Control+Space").split("+").map((keyPart, idx, arr) => (
                      <React.Fragment key={idx}>
                        <kbd className="px-3 py-1.5 rounded-[7px] bg-[var(--surface-primary)] border border-[var(--border)] text-[13px] font-mono font-semibold text-[var(--text-primary)] shadow-sm">
                          {formatKeyForDisplay(keyPart)}
                        </kbd>
                        {idx < arr.length - 1 && (
                          <span className="text-[11px] font-mono text-[var(--text-muted)] font-bold">+</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {isRecordingHotkey ? (
                  <>
                    {recordedKeys.length >= 1 && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!settings) return;
                          const finalStr = recordedKeys.join("+");
                          setIsRecordingHotkey(false);
                          setRecordedKeys([]);
                          const success = await handlePatch({ hotkey: finalStr });
                          if (success) {
                            const readable = finalStr.split("+").map(formatKeyForDisplay).join(" + ");
                            setHotkeyFeedback(`✓ "${readable}" saved`);
                            setTimeout(() => setHotkeyFeedback(null), 3000);
                          }
                        }}
                        className="btn-primary px-3 py-1.5 rounded-[6px] text-[12px] font-mono font-semibold cursor-pointer shadow-sm"
                      >
                        ✓ Save
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsRecordingHotkey(false);
                        setRecordedKeys([]);
                      }}
                      className="px-2.5 py-1.5 rounded-[6px] bg-[var(--surface-primary)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-secondary)] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRecordingHotkey(true);
                      setRecordedKeys([]);
                    }}
                    className="btn-primary px-3 py-1.5 rounded-[6px] text-[12px] font-medium cursor-pointer flex items-center gap-1.5"
                  >
                    <Radio className="w-3 h-3" />
                    Record New
                  </button>
                )}
              </div>
            </div>

            {/* Quick Preset Pills */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] font-mono text-[var(--text-muted)] mr-1">Presets:</span>
              {[
                { label: "Ctrl + Space", value: "Control+Space" },
                { label: "Ctrl + Win", value: "Control+Super" },
                { label: "Alt + Space", value: "Alt+Space" },
                { label: "Win + Space", value: "Super+Space" },
                { label: "Ctrl + Shift + V", value: "Control+Shift+KeyV" },
                { label: "Ctrl + J", value: "Control+KeyJ" },
                { label: "F8", value: "F8" },
              ].map((preset) => {
                const isCurrent = settings.hotkey === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      handlePatch({ hotkey: preset.value });
                      setHotkeyFeedback(`✓ Set to ${preset.label}`);
                      setTimeout(() => setHotkeyFeedback(null), 3000);
                    }}
                    className={`px-2.5 py-1 rounded-[6px] text-[11px] font-mono transition-all cursor-pointer border ${
                      isCurrent
                        ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent-border)] font-semibold shadow-2xs"
                        : "bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border)]"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Inline Feedback */}
            {hotkeyFeedback && (
              <div
                className={`p-2.5 rounded-[8px] text-[12px] font-mono font-medium animate-fadeIn flex items-center gap-2 border ${
                  hotkeyFeedback.startsWith("❌") || hotkeyFeedback.startsWith("⚠️")
                    ? "bg-[var(--surface-elevated)] text-[var(--warning)] border-[var(--warning)]"
                    : "bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]"
                }`}
              >
                {hotkeyFeedback.startsWith("❌") || hotkeyFeedback.startsWith("⚠️") ? (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[var(--warning)]" />
                ) : (
                  <Check className="w-3.5 h-3.5 shrink-0 text-[var(--success)]" />
                )}
                <span>{hotkeyFeedback}</span>
              </div>
            )}
          </Card>

          {/* Trigger Mode & Formatting Mode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Trigger Mode Card with Toggle */}
            <Card padding="md" className="flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-[var(--accent)]" /> Trigger Activation Mode
                  </h4>
                  <Badge variant={settings.is_toggle_mode ? "accent" : "default"} size="sm" className="font-mono">
                    {settings.is_toggle_mode ? "Toggle Mode" : "Push-to-Talk"}
                  </Badge>
                </div>
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                  Choose between clicking once to start/stop or holding the shortcut down during speech.
                </p>
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <span className="text-[12px] font-medium text-[var(--text-primary)] block">
                    Toggle Mode (Single Click)
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">
                    {settings.is_toggle_mode ? "Click to start, click to stop" : "Hold down while speaking"}
                  </span>
                </div>
                <Toggle
                  checked={settings.is_toggle_mode}
                  onChange={(checked) => handlePatch({ is_toggle_mode: checked })}
                />
              </div>
            </Card>

            {/* Default Formatting Mode with Dropdown */}
            <Card padding="md" className="flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[var(--accent)]" /> Default Formatting Mode
                  </h4>
                  <Badge variant="default" size="sm" className="font-mono">{settings.formatting_mode}</Badge>
                </div>
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                  Controls punctuation, casing, filler words, and outline bullets.
                </p>
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)]">
                <Dropdown
                  value={settings.formatting_mode}
                  onChange={(val) => handlePatch({ formatting_mode: val as FormattingMode })}
                  options={[
                    {
                      value: "Smart",
                      label: "Smart (Verbal self-corrections)",
                      description: "Contextual speech cleaning and verbal self-correction removal",
                    },
                    {
                      value: "Clean",
                      label: "Clean (Punctuation & filler removal)",
                      description: "Cleans um, uh, casing and standardizes punctuation",
                    },
                    {
                      value: "Structured",
                      label: "Structured (Outlines to bullets)",
                      description: "Converts spoken lists and outlines into markdown bullet points",
                    },
                    {
                      value: "Raw",
                      label: "Raw (Verbatim speech)",
                      description: "Exact speech without any post-processing modifications",
                    },
                  ]}
                />
              </div>
            </Card>
          </div>

          {/* Dictation Output Mode */}
          <Card padding="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-[var(--warning)]" /> Dictation Output Mode
                </h4>
                <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                  Control how recognized words are written into your active Windows application.
                </p>
              </div>
              <Badge variant="accent" size="sm" className="font-mono">In-Place Insertion</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <button
                type="button"
                onClick={() => handlePatch({ output_mode: "realtime_stream" })}
                className={`p-3 rounded-[8px] text-left border transition-all cursor-pointer ${
                  (settings.output_mode || "realtime_stream") === "realtime_stream"
                    ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                    : "border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-[13px] text-[var(--text-primary)]">Real-Time Streaming</span>
                  {(settings.output_mode || "realtime_stream") === "realtime_stream" && (
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Writes text directly into whichever text box you clicked in real-time as you speak.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handlePatch({ output_mode: "progressive" })}
                className={`p-3 rounded-[8px] text-left border transition-all cursor-pointer ${
                  settings.output_mode === "progressive"
                    ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                    : "border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-[13px] text-[var(--text-primary)]">Smooth Typewriter</span>
                  {settings.output_mode === "progressive" && (
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Types entire paragraph smoothly with natural keystroke cadence upon speech completion.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handlePatch({ output_mode: "instant_paste" })}
                className={`p-3 rounded-[8px] text-left border transition-all cursor-pointer ${
                  settings.output_mode === "instant_paste"
                    ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                    : "border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-[13px] text-[var(--text-primary)]">Instant Paste</span>
                  {settings.output_mode === "instant_paste" && (
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Pastes full text instantly via clipboard simulation (Ctrl+V / Cmd+V).
                </p>
              </button>
            </div>
          </Card>
        </div>
      )}



      {/* CATEGORY 5: API Credentials */}
      {activeCategory === "security" && (
        <div className="space-y-5 animate-fadeIn">
          <Card padding="md" className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Key className="w-4 h-4 text-[var(--warning)]" /> Groq Cloud API Credentials
              </h3>
              <Badge variant="accent" size="sm" className="font-mono">
                <Lock className="w-3 h-3 mr-1 inline" /> OS Keyring Secured
              </Badge>
            </div>

            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
              Your API key is stored securely in your Windows OS Credential Vault (Keyring). It is never written to plain text files, logs, or repository code.
            </p>

            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={hasStoredKey ? "•••••••••••••••••••••••••••• (Saved in Vault)" : "gsk_..."}
                  className="w-full pl-3 pr-10 py-2 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[7px] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={saveGroqKey}
                  disabled={!apiKeyInput.trim()}
                  className={`px-4 py-2 rounded-[6px] text-[13px] font-medium transition-all cursor-pointer ${
                    isKeySaved
                      ? "bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success-border)]"
                      : "btn-primary disabled:opacity-40"
                  }`}
                >
                  {isKeySaved ? "✓ Key Stored" : "Save Key to Vault"}
                </button>

                <button
                  type="button"
                  onClick={testConnection}
                  disabled={isTestingKey || (!apiKeyInput.trim() && !hasStoredKey)}
                  className="px-3.5 py-2 rounded-[6px] btn-secondary text-[13px] font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  {isTestingKey && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Test Connection
                </button>

                {hasStoredKey && (
                  <button
                    type="button"
                    onClick={deleteGroqKey}
                    className="px-3 py-2 rounded-[6px] hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--error-border)] text-[12px] text-[var(--text-muted)] hover:text-[var(--error)] font-medium transition-all flex items-center gap-1 cursor-pointer ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove Key
                  </button>
                )}
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-[6px] text-[13px] flex items-center gap-2 animate-fadeIn ${
                    testResult.success
                      ? "bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success-border)] font-medium"
                      : "bg-[var(--error-bg)] text-[var(--error)] border border-[var(--error-border)] font-medium"
                  }`}
                >
                  {testResult.success ? (
                    <Check className="w-4 h-4 shrink-0 text-[var(--success)]" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{testResult.msg}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* CATEGORY 6: Appearance & Privacy */}
      {activeCategory === "appearance" && (
        <div className="space-y-5 animate-fadeIn">
          {/* Theme Selector */}
          <div className="space-y-2.5">
            <h3 className="text-[12px] font-semibold text-[var(--accent)] uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Palette className="w-4 h-4" /> Interface Theme
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Obsidian Dark */}
              <button
                type="button"
                onClick={() => handlePatch({ theme: "dark" })}
                className={`forge-card p-4 rounded-[8px] text-left transition-all bg-[var(--surface-primary)] border cursor-pointer ${
                  (settings.theme || "dark") === "dark"
                    ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                    : "border-[var(--border)] hover:border-[var(--accent-border)]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 rounded-[6px] bg-[var(--surface-elevated)] text-[var(--accent)]">
                    <Moon className="w-4 h-4" />
                  </div>
                  {(settings.theme || "dark") === "dark" && (
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                  )}
                </div>
                <div className="font-semibold text-[14px] text-[var(--text-primary)]">Obsidian Dark</div>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                  High-contrast dark mode with crisp Teal interactive accents.
                </p>
              </button>

              {/* Clean Slate Light */}
              <button
                type="button"
                onClick={() => handlePatch({ theme: "light" })}
                className={`forge-card p-4 rounded-[8px] text-left transition-all bg-[var(--surface-primary)] border cursor-pointer ${
                  settings.theme === "light"
                    ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                    : "border-[var(--border)] hover:border-[var(--accent-border)]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 rounded-[6px] bg-[var(--surface-elevated)] text-[var(--warning)]">
                    <Sun className="w-4 h-4" />
                  </div>
                  {settings.theme === "light" && (
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                  )}
                </div>
                <div className="font-semibold text-[14px] text-[var(--text-primary)]">Clean Slate Light</div>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                  Crisp daytime light palette for bright desktop environments.
                </p>
              </button>

              {/* System Sync */}
              <button
                type="button"
                onClick={() => handlePatch({ theme: "system" })}
                className={`forge-card p-4 rounded-[8px] text-left transition-all bg-[var(--surface-primary)] border cursor-pointer ${
                  settings.theme === "system"
                    ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                    : "border-[var(--border)] hover:border-[var(--accent-border)]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 rounded-[6px] bg-[var(--surface-elevated)] text-[var(--text-secondary)]">
                    <Monitor className="w-4 h-4" />
                  </div>
                  {settings.theme === "system" && (
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                  )}
                </div>
                <div className="font-semibold text-[14px] text-[var(--text-primary)]">System Sync</div>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                  Automatically syncs with your Windows OS dark/light mode.
                </p>
              </button>
            </div>
          </div>

          {/* System Startup & Background Auto-Launch */}
          <Card padding="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[14px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-[var(--accent)]" /> System Startup &amp; Background Autostart
                </h4>
                <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                  Starts Forge Wisper silently in the system tray when your Windows PC boots.
                </p>
              </div>

              <Toggle
                checked={!!settings.launch_at_startup}
                onChange={(checked) => handlePatch({ launch_at_startup: checked })}
              />
            </div>

            <div className="p-2.5 rounded-[6px] bg-[var(--surface-elevated)] border border-[var(--border)] text-[12px] text-[var(--text-secondary)] flex items-center justify-between font-mono">
              <span>Silent Tray Startup on PC Boot</span>
              <span className={settings.launch_at_startup ? "text-[var(--accent)] font-medium" : "text-[var(--text-muted)]"}>
                {settings.launch_at_startup ? "Enabled (0ms UI lag)" : "Disabled"}
              </span>
            </div>
          </Card>

          {/* History Retention Policy */}
          <Card padding="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[14px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[var(--accent)]" /> History Retention &amp; Disk Security
              </h4>
              <Badge variant="accent" size="sm" className="font-mono">Zero Audio On Disk</Badge>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-[var(--text-muted)] block font-mono">Transcript Retention Policy</label>
              <Dropdown
                value={settings.retention_policy}
                onChange={(val) => handlePatch({ retention_policy: val as RetentionPolicy })}
                options={[
                  {
                    value: "Days30",
                    label: "Keep Transcripts for 30 Days (Default)",
                    description: "Auto-prunes history records older than 30 days",
                  },
                  {
                    value: "Days7",
                    label: "Keep Transcripts for 7 Days",
                    description: "Auto-prunes history records older than one week",
                  },
                  {
                    value: "Forever",
                    label: "Keep Transcripts Forever (Local SQLite)",
                    description: "Never deletes history records automatically",
                  },
                  {
                    value: "Off",
                    label: "Do Not Save Transcripts (Incognito Mode)",
                    description: "Transcripts exist only in-memory and are never stored to SQLite",
                  },
                ]}
              />
            </div>
            <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
              Forge Wisper guarantees that raw audio recordings are processed completely in-memory and are never stored or cached to disk.
            </p>
          </Card>
        </div>
      )}

      {/* CATEGORY 7: About & System */}
      {activeCategory === "about" && (
        <div className="space-y-5 animate-fadeIn">
          <Card padding="lg" className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-3">
                <ForgeLogo size={42} />
                <div>
                  <div className="text-[16px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    Forge Wisper
                    <Badge variant="accent" size="sm" className="font-mono">
                      {updateCheckResult?.current_version ? `v${updateCheckResult.current_version}` : "v0.1.5"}
                    </Badge>
                  </div>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                    Cross-platform, low-latency AI speech dictation engine for Windows &amp; macOS.
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-[6px] bg-[var(--surface-elevated)] border border-[var(--border)] text-[12px] font-mono text-[var(--text-secondary)]">
                MIT License
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px] font-mono">
              <div className="p-3 bg-[var(--surface-elevated)] rounded-[6px] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] block text-[10px] uppercase">Engine Arch</span>
                <span className="text-[var(--text-primary)] font-medium">Tauri v2 + Rust + React</span>
              </div>
              <div className="p-3 bg-[var(--surface-elevated)] rounded-[6px] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] block text-[10px] uppercase">Author</span>
                <span className="text-[var(--text-primary)] font-medium">Ali Zazan</span>
              </div>
              <div className="p-3 bg-[var(--surface-elevated)] rounded-[6px] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] block text-[10px] uppercase">Audio Pipeline</span>
                <span className="text-[var(--text-primary)] font-medium">16kHz 16-bit Mono PCM</span>
              </div>
            </div>

            {/* Online Version & Update Management */}
            <div className="p-4 rounded-[8px] bg-[var(--surface-elevated)] border border-[var(--border)] space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-[6px] bg-[var(--accent-subtle)] text-[var(--accent)] shrink-0">
                    {updateCheckResult?.has_update ? (
                      <ArrowUpCircle className="w-5 h-5 text-[var(--accent)]" />
                    ) : (
                      <RefreshCw className={`w-5 h-5 ${checkingUpdate ? "animate-spin" : ""}`} />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-[14px] text-[var(--text-primary)] flex items-center gap-2 flex-wrap">
                      <span>Online Updates &amp; Version Status</span>
                      {updateCheckResult?.has_update ? (
                        <Badge variant="accent" size="sm" className="font-mono">
                          {updateCheckResult.latest_version} Available
                        </Badge>
                      ) : updateCheckResult ? (
                        <Badge variant="success" size="sm" className="font-mono">
                          Up to Date
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                      {updateCheckResult?.has_update
                        ? `A new version (${updateCheckResult.latest_version}) is ready with new features and optimizations.`
                        : updateCheckResult
                        ? `You are on the latest version of Forge Wisper (v${updateCheckResult.current_version}).`
                        : `Current version: v0.1.5. Automatic update checks run smoothly in the background.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                  {updateCheckResult?.has_update ? (
                    <button
                      type="button"
                      onClick={() => setIsUpdateModalOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-[12px] font-semibold transition-all shadow-xs cursor-pointer w-full sm:w-auto"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Update to {updateCheckResult.latest_version}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={checkingUpdate}
                      onClick={handleCheckForUpdates}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] text-[12px] font-medium transition-all shadow-xs cursor-pointer disabled:opacity-50 w-full sm:w-auto"
                    >
                      {checkingUpdate ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
                          <span>Checking...</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Check for Updates</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Community & Discussion Hub */}
            <div className="p-4 rounded-[8px] bg-[var(--surface-elevated)] border border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[7px] overflow-hidden bg-[var(--surface-primary)] border border-[var(--border)] shrink-0 flex items-center justify-center p-0.5 shadow-2xs">
                  <img
                    src={aiNetworkXLogo}
                    alt="AI NetworkX"
                    className="w-full h-full object-contain rounded-[5px]"
                  />
                </div>
                <div>
                  <div className="font-semibold text-[14px] text-[var(--text-primary)] flex items-center gap-2">
                    AI NetworkX Community
                    <Badge variant="accent" size="sm" className="font-mono">Official</Badge>
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                    Connect with creators, share voice workflows, request features, and get support.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => api.openUrl("https://community.ainetworkx.com")}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[12px] font-medium transition-all shadow-xs cursor-pointer shrink-0 w-full sm:w-auto"
                title="Visit AI NetworkX Community"
              >
                <span>community.ainetworkx.com</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between text-[12px] text-[var(--text-muted)] gap-2 border-t border-[var(--border-subtle)]">
              <span>Crafted for high-speed voice workflows &amp; clean code dictation.</span>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => api.openUrl("https://github.com/zazanali/forge-wisper")}
                  className="font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors inline-flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
                  title="Open GitHub repository in browser"
                >
                  <span>github.com/zazanali/forge-wisper</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Update Modal when triggered from Settings */}
      {updateCheckResult && (
        <UpdateModal
          updateInfo={updateCheckResult}
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
        />
      )}
    </div>
  );
};
