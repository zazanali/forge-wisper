import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/tauri";
import type {
  AppSettings,
  AudioDeviceInfo,
  FormattingMode,
  RetentionPolicy,
} from "../types";
import { ForgeLogo } from "../components/ForgeLogo";
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
  Sliders,
  Lock,
  Volume2,
  Info,
  Eye,
  EyeOff,
  Radio,
  RotateCcw,
  ExternalLink,
} from "lucide-react";

interface SettingsViewProps {
  onNavigate?: (tab: any) => void;
}

type SettingsCategory = "engine" | "shortcuts" | "security" | "appearance" | "about";

export const formatKeyForDisplay = (keyStr: string): string => {
  const k = keyStr.trim();
  if (k === "Control" || k === "Ctrl") return "Ctrl";
  if (k === "Super" || k === "Meta" || k === "Command" || k === "Cmd" || k === "Win" || k === "Windows") return "Win";
  if (k.startsWith("Key") && k.length === 4) return k.slice(3);
  if (k.startsWith("Digit") && k.length === 6) return k.slice(5);
  return k;
};

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate: _onNavigate }) => {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("engine");
  const [settings, setSettings] = useState<AppSettings | null>(null);
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

  // Hotkey Recorder State
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [hotkeyFeedback, setHotkeyFeedback] = useState<string | null>(null);

  // Microphone Live Testing
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const intervalRef = useRef<number | null>(null);

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
          // Scale float RMS (0.0 to 0.4) to 0-100 percentage
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

      if (e.key === "Escape") {
        setIsRecordingHotkey(false);
        setRecordedKeys([]);
        return;
      }

      const keys: string[] = [];
      if (e.ctrlKey) keys.push("Control");
      if (e.altKey) keys.push("Alt");
      if (e.shiftKey) keys.push("Shift");
      if (e.metaKey) keys.push("Super");

      const key = e.key;
      const code = e.code;
      const isModifier = ["Control", "Alt", "Shift", "Meta", "OS"].includes(key);

      if (!isModifier) {
        let hotkeyToken = code;
        if (code && code.startsWith("Key") && code.length === 4) {
          hotkeyToken = code;
        } else if (code && code.startsWith("Digit") && code.length === 6) {
          hotkeyToken = code;
        } else if (code === "Space" || key === " ") {
          hotkeyToken = "Space";
        } else if (code === "Backquote" || key === "`" || key === "~") {
          hotkeyToken = "Backquote";
        } else if (key.startsWith("F") && !isNaN(Number(key.slice(1)))) {
          hotkeyToken = key.toUpperCase();
        } else if (key.length === 1 && /[a-zA-Z]/.test(key)) {
          hotkeyToken = `Key${key.toUpperCase()}`;
        } else if (key.length === 1 && /[0-9]/.test(key)) {
          hotkeyToken = `Digit${key}`;
        } else {
          hotkeyToken = code || key;
        }

        if (!keys.includes(hotkeyToken)) {
          keys.push(hotkeyToken);
        }

        const finalHotkeyStr = keys.join("+");
        if (settings && finalHotkeyStr.length > 0) {
          const readable = finalHotkeyStr.split("+").map(formatKeyForDisplay).join(" + ");
          setIsRecordingHotkey(false);
          setRecordedKeys([]);
          const success = await handleSave({ ...settings, hotkey: finalHotkeyStr });
          if (success) {
            setHotkeyFeedback(`✓ "${readable}" saved and active!`);
            setTimeout(() => setHotkeyFeedback(null), 3500);
          }
        }
      } else {
        setRecordedKeys(keys);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [isRecordingHotkey, settings]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
      const devices = await api.getAudioDevices();
      setAudioDevices(devices);
      const keyStatus = await api.getGroqKeyStatus();
      setHasStoredKey(keyStatus);
    } catch (e) {
      console.error(e);
    }
  };

  const resolveEffectiveTheme = (themePreference?: string) => {
    if (themePreference === "system") {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return themePreference || "light";
  };

  const handleSave = async (updated: AppSettings) => {
    try {
      await api.updateSettings(updated);
      setSettings(updated);
      setSaveSuccess(true);
      document.documentElement.setAttribute("data-theme", resolveEffectiveTheme(updated.theme));
      setTimeout(() => setSaveSuccess(false), 2000);
      return true;
    } catch (e: any) {
      console.error("Save settings error:", e);
      const errorMsg = typeof e === "string" ? e : e?.message || "Failed to update settings";
      setHotkeyFeedback(`❌ ${errorMsg}`);
      setTimeout(() => setHotkeyFeedback(null), 5000);
      return false;
    }
  };

  const saveGroqKey = async () => {
    if (!apiKeyInput.trim()) return;
    try {
      await api.setGroqKey(apiKeyInput.trim());
      setApiKeyInput("");
      setHasStoredKey(true);
      setIsKeySaved(true);
      setTestResult({ success: true, msg: "API Key saved securely in OS Keyring" });
      setTimeout(() => setIsKeySaved(false), 3000);
    } catch (e) {
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
      <div className="p-12 text-center text-[var(--text-muted)] flex items-center justify-center gap-2 font-sans">
        <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
        <span>Loading preferences...</span>
      </div>
    );
  }

  const categories: { id: SettingsCategory; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "engine", label: "Engine & Audio", icon: Cpu },
    { id: "shortcuts", label: "Hotkeys & Voice", icon: Keyboard },
    { id: "security", label: "API Credentials", icon: Key },
    { id: "appearance", label: "Appearance & Privacy", icon: Palette },
    { id: "about", label: "About System", icon: Info },
  ];

  return (
    <div className="space-y-5 animate-fadeIn font-sans w-full pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-medium text-[var(--text-primary)] tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[var(--accent)]" />
            Preferences & System Settings
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Manage your speech recognition engine, hotkeys, credentials, and app aesthetics.
          </p>
        </div>

        {saveSuccess && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--success)] bg-[var(--success-bg)] px-2.5 py-1 rounded-[6px] border border-[var(--success-border)] font-medium font-mono shrink-0">
            <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Preferences Saved
          </span>
        )}
      </div>

      {/* Category Navigation Bar */}
      <div className="flex items-center gap-1 p-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[8px] overflow-x-auto">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-all cursor-pointer select-none ${
                isActive
                  ? "bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] font-medium"
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
              <h3 className="text-[12px] font-medium text-[var(--accent)] uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Cpu className="w-4 h-4" /> Active Transcription Provider
              </h3>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">Select processing backend</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Groq Cloud Option */}
              <div
                onClick={() =>
                  handleSave({
                    ...settings,
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
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-medium bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">Cloud LPU</span>
                    )}
                  </div>
                  <div className="font-medium text-[14px] text-[var(--text-primary)]">Groq Cloud Whisper</div>
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
                  handleSave({
                    ...settings,
                    provider: "local-whisper",
                    model: "base",
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
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-medium bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">100% Offline</span>
                    )}
                  </div>
                  <div className="font-medium text-[14px] text-[var(--text-primary)]">Local Offline Whisper</div>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                    100% private offline transcription running on your local machine using GGML model binaries.
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[12px] font-mono text-[var(--text-secondary)]">
                  <span>Zero internet needed</span>
                  <span className="text-[var(--accent)] font-medium">100% Private</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2-Column Grid: Model Architecture & Microphone Device */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Left Card: Whisper Model Architecture */}
            <div className="forge-card p-4 space-y-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-primary)] flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                    {settings.provider === "groq" ? (
                      <Zap className="w-4 h-4 text-[var(--warning)]" />
                    ) : (
                      <Cpu className="w-4 h-4 text-[var(--accent)]" />
                    )}
                    {settings.provider === "groq" ? "Cloud Whisper Model" : "Local Whisper Model"}
                  </label>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    {settings.provider === "groq" ? "LPU Turbo" : "GGML Offline"}
                  </span>
                </div>

                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                  {settings.provider === "groq"
                    ? "Select the cloud Whisper model for transcription accuracy vs inference speed."
                    : "Select the local quantized GGML model architecture for offline transcription."}
                </p>
              </div>

              <div>
                <label className="text-[11px] text-[var(--text-muted)] block mb-1 font-mono">
                  Active Model
                </label>
                {settings.provider === "groq" ? (
                  <select
                    value={settings.model}
                    onChange={(e) => handleSave({ ...settings, model: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[7px] text-[13px] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                  >
                    <option value="whisper-large-v3-turbo">whisper-large-v3-turbo (Fastest Latency)</option>
                    <option value="whisper-large-v3">whisper-large-v3 (Maximum Precision)</option>
                  </select>
                ) : (
                  <select
                    value={settings.model}
                    onChange={(e) => handleSave({ ...settings, model: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[7px] text-[13px] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                  >
                    <option value="base">base.bin (Default • 142 MB • Fast)</option>
                    <option value="tiny">tiny.bin (75 MB • Ultra Lightweight)</option>
                    <option value="small">small.bin (466 MB • Balanced)</option>
                    <option value="medium">medium.bin (1.5 GB • High Accuracy)</option>
                    <option value="large-v3">large-v3.bin (3.1 GB • Maximum Accuracy)</option>
                  </select>
                )}
              </div>
            </div>

            {/* Right Card: Microphone Device & Live Input Level */}
            <div className="forge-card p-4 space-y-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-primary)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-[13px] font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-[var(--accent)]" /> Microphone Device & Input
                  </h4>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">Auto-fallback</span>
                </div>

                <div>
                  <label className="text-[11px] text-[var(--text-muted)] block mb-1 font-mono">Selected Input Device</label>
                  <select
                    value={settings.microphone || ""}
                    onChange={(e) => handleSave({ ...settings, microphone: e.target.value ? e.target.value : null })}
                    className="w-full px-3 py-2 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[7px] text-[13px] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                  >
                    <option value="">System Default Microphone (Automatic)</option>
                    {audioDevices.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name} {d.is_default ? "★ (OS Default)" : ""}
                      </option>
                    ))}
                  </select>
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
                      isMicTesting
                        ? "btn-danger"
                        : "btn-secondary"
                    }`}
                  >
                    {isMicTesting ? "Stop Meter" : "Test Microphone"}
                  </button>
                </div>

                {isMicTesting && (
                  <div className="space-y-1 pt-1 animate-fadeIn">
                    <div className="h-2 bg-[var(--surface-elevated)] rounded-[999px] overflow-hidden border border-[var(--border)]">
                      <div
                        className={`h-full rounded-[999px] transition-all duration-75 ${
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
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY 2: Hotkeys & Voice */}
      {activeCategory === "shortcuts" && (
        <div className="space-y-5 animate-fadeIn">
          {/* Global Hotkey Config - Vibe Coded Hero */}
          <div className="forge-card p-5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-primary)] shadow-sm space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[8px] bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent)]">
                  <Keyboard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">
                    Global Shortcut
                  </h3>
                  <p className="text-[12px] text-[var(--text-muted)]">
                    Hold or press anywhere in Windows to transcribe
                  </p>
                </div>
              </div>

              {settings.hotkey !== "Control+Space" && (
                <button
                  type="button"
                  onClick={() => {
                    handleSave({ ...settings, hotkey: "Control+Space" });
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
                          const success = await handleSave({ ...settings, hotkey: finalStr });
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
                      handleSave({ ...settings, hotkey: preset.value });
                      setHotkeyFeedback(`✓ Set to ${preset.label}`);
                      setTimeout(() => setHotkeyFeedback(null), 3000);
                    }}
                    className={`px-2.5 py-1 rounded-[6px] text-[11px] font-mono transition-all cursor-pointer border ${
                      isCurrent
                        ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent-border)] font-semibold shadow-xs"
                        : "bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border)]"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Subtle Inline Feedback */}
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
          </div>

          {/* Trigger Mode & Formatting Mode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Trigger Mode Card */}
            <div className="forge-card p-4 space-y-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-primary)] flex flex-col justify-between">
              <div>
                <h4 className="text-[13px] font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-[var(--accent)]" /> Trigger Mode
                </h4>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1">
                  Choose how your hotkey activates recording.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleSave({ ...settings, is_toggle_mode: false })}
                  className={`flex-1 py-2 px-3 rounded-[6px] text-[12px] font-medium border transition-all cursor-pointer text-center ${
                    !settings.is_toggle_mode
                      ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Push-to-Talk (Hold)
                </button>
                <button
                  type="button"
                  onClick={() => handleSave({ ...settings, is_toggle_mode: true })}
                  className={`flex-1 py-2 px-3 rounded-[6px] text-[12px] font-medium border transition-all cursor-pointer text-center ${
                    settings.is_toggle_mode
                      ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Toggle (Click to Start)
                </button>
              </div>
            </div>

            {/* Default Formatting Mode */}
            <div className="forge-card p-4 space-y-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-primary)] flex flex-col justify-between">
              <div>
                <h4 className="text-[13px] font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[var(--accent)]" /> Default Formatting Mode
                </h4>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1">
                  How text is cleaned and structured before pasting.
                </p>
              </div>

              <select
                value={settings.formatting_mode}
                onChange={(e) => handleSave({ ...settings, formatting_mode: e.target.value as FormattingMode })}
                className="w-full px-3 py-2 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[7px] text-[13px] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)] cursor-pointer"
              >
                <option value="Smart">Smart (Contextual verbal self-corrections)</option>
                <option value="Clean">Clean (Punctuation, casing & filler removal)</option>
                <option value="Structured">Structured (Convert spoken outlines into bullet points)</option>
                <option value="Raw">Raw (Verbatim speech without modification)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY 3: API Credentials */}
      {activeCategory === "security" && (
        <div className="space-y-5 animate-fadeIn">
          <div className="forge-card p-4 space-y-3.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface-primary)]">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Key className="w-4 h-4 text-[var(--warning)]" /> Groq Cloud API Credentials
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-mono bg-[var(--surface-elevated)] text-[var(--accent)] border border-[var(--border)]">
                <Lock className="w-3 h-3" /> OS Keyring Secured
              </span>
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
          </div>
        </div>
      )}

      {/* CATEGORY 4: Appearance & Privacy */}
      {activeCategory === "appearance" && (
        <div className="space-y-5 animate-fadeIn">
          {/* Theme Selector */}
          <div className="space-y-2.5">
            <h3 className="text-[12px] font-medium text-[var(--accent)] uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Palette className="w-4 h-4" /> Interface Theme
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Obsidian Dark */}
              <button
                type="button"
                onClick={() => handleSave({ ...settings, theme: "dark" })}
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
                onClick={() => handleSave({ ...settings, theme: "light" })}
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
                <div className="font-medium text-[14px] text-[var(--text-primary)]">Clean Slate Light</div>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                  Crisp daytime light palette for bright desktop environments.
                </p>
              </button>

              {/* System Sync */}
              <button
                type="button"
                onClick={() => handleSave({ ...settings, theme: "system" })}
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
                <div className="font-medium text-[14px] text-[var(--text-primary)]">System Sync</div>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                  Automatically syncs with your Windows OS dark/light mode.
                </p>
              </button>
            </div>
          </div>

          {/* History Retention Policy */}
          <div className="forge-card p-4 space-y-2.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface-primary)]">
            <div className="flex items-center justify-between">
              <h4 className="text-[14px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[var(--accent)]" /> History Retention & Disk Security
              </h4>
              <span className="text-[11px] font-mono text-[var(--accent)]">Zero Audio On Disk</span>
            </div>

            <div>
              <label className="text-[11px] text-[var(--text-muted)] block mb-1 font-mono">Transcript Retention</label>
              <select
                value={settings.retention_policy}
                onChange={(e) => handleSave({ ...settings, retention_policy: e.target.value as RetentionPolicy })}
                className="w-full px-3 py-2 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[7px] text-[13px] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)] cursor-pointer"
              >
                <option value="Days30">Keep Transcripts for 30 Days (Default)</option>
                <option value="Days7">Keep Transcripts for 7 Days</option>
                <option value="Forever">Keep Transcripts Forever (Local SQLite)</option>
                <option value="Off">Do Not Save Transcripts (Incognito Mode)</option>
              </select>
            </div>
            <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
              Forge Wisper guarantees that raw audio recordings are processed completely in-memory and are never stored or cached to disk.
            </p>
          </div>
        </div>
      )}

      {/* CATEGORY 5: About & System */}
      {activeCategory === "about" && (
        <div className="space-y-5 animate-fadeIn">
          <div className="forge-card p-5 rounded-[8px] border border-[var(--border)] bg-[var(--surface-primary)] space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-3">
                <ForgeLogo size={42} />
                <div>
                  <div className="text-[16px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    Forge Wisper
                    <span className="text-[10px] font-mono text-[var(--accent)] px-2 py-0.5 rounded-[4px] bg-[var(--accent-subtle)] border border-[var(--accent-border)]">
                      v0.1.0-beta
                    </span>
                  </div>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                    Universal, low-latency AI speech dictation & verbal formatting engine.
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

            <div className="pt-1 flex flex-col sm:flex-row items-center justify-between text-[12px] text-[var(--text-muted)] gap-2">
              <span>Crafted for high-speed voice workflows & clean code dictation.</span>
              <button
                type="button"
                onClick={() => api.openUrl("https://github.com/zazanali/forge-wisper")}
                className="font-mono text-[var(--accent)] hover:underline hover:text-[var(--accent-hover)] transition-colors inline-flex items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0"
                title="Open GitHub repository in browser"
              >
                <span>github.com/zazanali/forge-wisper</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

