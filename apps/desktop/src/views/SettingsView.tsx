import React, { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import type {
  AppSettings,
  AudioDeviceInfo,
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
} from "lucide-react";

interface SettingsViewProps {
  onNavigate?: (tab: any) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate: _onNavigate }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [audioDevices, setAudioDevices] = useState<AudioDeviceInfo[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    msg: string;
  } | null>(null);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isKeySaved, setIsKeySaved] = useState(false);

  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const intervalRef = React.useRef<number | null>(null);

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
    } catch (e) {
      console.error(e);
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

  const testConnection = async () => {
    setIsTestingKey(true);
    setTestResult(null);
    try {
      const ok = await api.testGroqConnection(apiKeyInput.trim());
      if (ok) {
        setTestResult({ success: true, msg: "Connection successful!" });
      }
    } catch (e) {
      setTestResult({ success: false, msg: String(e) });
    } finally {
      setIsTestingKey(false);
    }
  };

  if (!settings) {
    return (
      <div className="p-8 text-center text-[var(--text-3)] flex items-center justify-center gap-2 font-sans">
        <Loader2 className="w-5 h-5 animate-spin text-[#FF4D5E]" /> Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn w-full pb-12 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-[var(--text-1)]">
            Settings & Preferences
          </h2>
          <p className="text-xs text-[var(--text-2)]">
            Configure speech engines, microphone, shortcuts, and personal vocabulary.
          </p>
        </div>
        {saveSuccess && (
          <span className="inline-flex items-center gap-1 text-xs text-[#3FE3C4] bg-[#3FE3C4]/15 px-3 py-1 rounded-lg border border-[#3FE3C4]/30 font-bold">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      {/* 1. Speech Engine Selection */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-[#FF4D5E] uppercase tracking-wider flex items-center gap-2 font-display">
          <Cpu className="w-4 h-4" /> Transcription Engine
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Groq Cloud Option */}
          <button
            onClick={() =>
              handleSave({
                ...settings,
                provider: "groq",
                model: "whisper-large-v3-turbo",
              })
            }
            className={`forge-card p-4 text-left rounded-xl transition-all bg-[var(--panel)] ${
              settings.provider === "groq"
                ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10"
                : "border-[var(--border)] hover:border-amber-500/40"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-5 h-5 text-amber-500" />
              {settings.provider === "groq" && (
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              )}
            </div>
            <div className="font-semibold text-sm text-[var(--text-1)]">Groq Whisper</div>
            <p className="text-xs text-[var(--text-2)] mt-1">
              Ultra-fast cloud transcription powered by Groq LPUs.
            </p>
          </button>

          {/* Local Whisper Option */}
          <button
            onClick={() =>
              handleSave({
                ...settings,
                provider: "local-whisper",
                model: "base",
              })
            }
            className={`forge-card p-4 text-left rounded-xl transition-all bg-[var(--panel)] ${
              settings.provider === "local-whisper"
                ? "border-[#3FE3C4] bg-[#3FE3C4]/10 shadow-lg shadow-[#3FE3C4]/10"
                : "border-[var(--border)] hover:border-[#3FE3C4]/40"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Cpu className="w-5 h-5 text-teal-600 dark:text-[#3FE3C4]" />
              {settings.provider === "local-whisper" && (
                <span className="w-2 h-2 rounded-full bg-[#3FE3C4]" />
              )}
            </div>
            <div className="font-semibold text-sm text-[var(--text-1)]">Local Whisper</div>
            <p className="text-xs text-[var(--text-2)] mt-1">
              100% private offline transcription running on your machine.
            </p>
          </button>
        </div>
      </div>

      {/* 2. Groq API Configuration */}
      <div className="forge-card p-5 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--panel)]">
        <h4 className="text-sm font-semibold text-[var(--text-1)] flex items-center gap-2 font-display">
          <Key className="w-4 h-4 text-amber-500" /> Groq API Credentials
        </h4>
        <p className="text-xs text-[var(--text-2)]">
          Your API key is never logged or saved to source code. It is stored securely in your OS Credential Vault (Keyring).
        </p>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={
                hasStoredKey
                  ? "•••••••••••••••••••••••••••• (Saved)"
                  : "Enter your gsk_... API key"
              }
              className="flex-1 px-3.5 py-2 bg-[var(--raised)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[#FF4D5E] font-mono"
            />
            <div className="flex gap-2">
              <button
                onClick={saveGroqKey}
                disabled={!apiKeyInput.trim()}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isKeySaved
                    ? "bg-[#3FE3C4]/15 text-[#3FE3C4] border border-[#3FE3C4]/40"
                    : "bg-[var(--raised)] hover:bg-[var(--raised-hover)] border border-[var(--border)] text-[var(--text-1)] disabled:opacity-40"
                }`}
              >
                {isKeySaved ? (
                  <span className="flex items-center gap-1.5 font-bold">
                    <Check className="w-3.5 h-3.5 text-[#3FE3C4]" /> Saved
                  </span>
                ) : (
                  "Save Key"
                )}
              </button>
              <button
                onClick={testConnection}
                disabled={isTestingKey || (!apiKeyInput.trim() && !hasStoredKey)}
                className="px-4 py-2 btn-blade rounded-xl text-xs font-semibold text-white disabled:opacity-50 flex items-center gap-1.5"
              >
                {isTestingKey && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Test Connection
              </button>
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                testResult.success
                  ? "bg-[#3FE3C4]/15 text-teal-700 dark:text-[#3FE3C4] border border-[#3FE3C4]/30 font-medium"
                  : "bg-[#FF4D5E]/15 text-[#FF4D5E] border border-[#FF4D5E]/30 font-medium"
              }`}
            >
              {testResult.success ? (
                <Check className="w-4 h-4 shrink-0 text-teal-600 dark:text-[#3FE3C4]" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{testResult.msg}</span>
            </div>
          )}

          {/* Groq Model Picker */}
          {settings.provider === "groq" && (
            <div className="pt-2">
              <label className="text-xs text-[var(--text-2)] block mb-1.5 font-mono">
                Groq Whisper Model
              </label>
              <select
                value={settings.model}
                onChange={(e) =>
                  handleSave({ ...settings, model: e.target.value })
                }
                className="w-full px-3.5 py-2.5 bg-[var(--raised)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-1)] focus:outline-none focus:border-[#FF4D5E]"
              >
                <option value="whisper-large-v3-turbo">
                  whisper-large-v3-turbo (Recommended Default)
                </option>
                <option value="whisper-large-v3">
                  whisper-large-v3 (Maximum Accuracy)
                </option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 3. Audio Microphone Input */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-[#FF4D5E] uppercase tracking-wider flex items-center gap-2 font-display">
          <Mic className="w-4 h-4" /> Microphone
        </h3>

        <div className="forge-card p-4 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--panel)]">
          <div>
            <label className="text-xs text-[var(--text-2)] block mb-1.5 font-mono">
              Input Device
            </label>
            <select
              value={settings.microphone || ""}
              onChange={(e) =>
                handleSave({
                  ...settings,
                  microphone: e.target.value ? e.target.value : null,
                })
              }
              className="w-full px-3.5 py-2.5 bg-[var(--raised)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-1)] focus:outline-none focus:border-[#FF4D5E]"
            >
              <option value="">System Default Microphone</option>
              {audioDevices.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name} {d.is_default ? "(Default)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 border-t border-[var(--border)] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-2)]">Microphone Hardware Level Test</span>
              <button
                type="button"
                onClick={toggleMicTest}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isMicTesting
                    ? "bg-[#FF4D5E]/20 text-[#FF4D5E] border border-[#FF4D5E]/40 animate-pulse"
                    : "btn-outline"
                }`}
              >
                {isMicTesting ? "Stop Live Test" : "Test Live Microphone"}
              </button>
            </div>

            {isMicTesting && (
              <div className="space-y-1.5 pt-1">
                <div className="h-3 bg-[var(--raised)] rounded-full overflow-hidden border border-[var(--border)] p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-75 ${
                      micLevel > 60
                        ? "bg-amber-400"
                        : micLevel > 10
                        ? "bg-[#3FE3C4]"
                        : "bg-[var(--text-3)]"
                    }`}
                    style={{ width: `${Math.max(4, micLevel)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[var(--text-3)] font-mono">
                  <span>Mute</span>
                  <span className={micLevel > 15 ? "text-teal-600 dark:text-[#3FE3C4] font-bold" : ""}>
                    {micLevel > 15 ? "Sound Detected ✓" : "Speak into mic..."}
                  </span>
                  <span>Max</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Hotkeys & Interaction Modes */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-[#FF4D5E] uppercase tracking-wider flex items-center gap-2 font-display">
          <Keyboard className="w-4 h-4" /> Shortcut & Trigger Mode
        </h3>

        <div className="forge-card p-4 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--panel)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[var(--text-2)] block mb-1.5 font-mono">
                Global Hotkey
              </label>
              <input
                type="text"
                value={settings.hotkey}
                onChange={(e) =>
                  handleSave({ ...settings, hotkey: e.target.value })
                }
                placeholder="Control+Space"
                className="w-full px-3.5 py-2 bg-[var(--raised)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-1)] font-mono focus:outline-none focus:border-[#FF4D5E]"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {["Control+Space", "Alt+Space", "Control+Shift+Space", "F8"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSave({ ...settings, hotkey: preset })}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono border transition-colors ${
                      settings.hotkey === preset
                        ? "border-[#FF4D5E] bg-[#FF4D5E]/15 text-[#FF4D5E]"
                        : "border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-hover)]"
                    }`}
                  >
                    {preset === "Control+Space" ? "Ctrl + Space (Default)" : preset.replace("Control", "Ctrl").replace("+", " + ")}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--text-2)] block mb-1.5 font-mono">
                Interaction Trigger
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    handleSave({ ...settings, is_toggle_mode: false })
                  }
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    !settings.is_toggle_mode
                      ? "border-[#FF4D5E] bg-[#FF4D5E]/15 text-[#FF4D5E]"
                      : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--raised)]"
                  }`}
                >
                  Push-to-Talk (Hold)
                </button>
                <button
                  onClick={() =>
                    handleSave({ ...settings, is_toggle_mode: true })
                  }
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    settings.is_toggle_mode
                      ? "border-[#FF4D5E] bg-[#FF4D5E]/15 text-[#FF4D5E]"
                      : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--raised)]"
                  }`}
                >
                  Toggle (Start/Stop)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Theme & Appearance */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-[#FF4D5E] uppercase tracking-wider flex items-center gap-2 font-display">
          <Palette className="w-4 h-4" /> Theme & Appearance
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Dark Theme */}
          <button
            type="button"
            onClick={() => handleSave({ ...settings, theme: "dark" })}
            className={`forge-card p-4 rounded-xl text-left transition-all bg-[var(--panel)] ${
              (settings.theme || "dark") === "dark"
                ? "border-[#FF4D5E] bg-[#FF4D5E]/10 shadow-lg shadow-[#FF4D5E]/10"
                : "border-[var(--border)] hover:border-[#FF4D5E]/40"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Moon className="w-5 h-5 text-[#FF4D5E]" />
              {(settings.theme || "dark") === "dark" && (
                <span className="w-2 h-2 rounded-full bg-[#FF4D5E]" />
              )}
            </div>
            <div className="font-semibold text-sm text-[var(--text-1)]">Obsidian Dark</div>
            <p className="text-xs text-[var(--text-2)] mt-1">
              High-contrast obsidian theme with Blade Red & Teal accents.
            </p>
          </button>

          {/* Light Theme */}
          <button
            type="button"
            onClick={() => handleSave({ ...settings, theme: "light" })}
            className={`forge-card p-4 rounded-xl text-left transition-all bg-[var(--panel)] ${
              settings.theme === "light"
                ? "border-[#3FE3C4] bg-[#3FE3C4]/10 shadow-lg shadow-[#3FE3C4]/10"
                : "border-[var(--border)] hover:border-[#3FE3C4]/40"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Sun className="w-5 h-5 text-amber-500" />
              {settings.theme === "light" && (
                <span className="w-2 h-2 rounded-full bg-[#3FE3C4]" />
              )}
            </div>
            <div className="font-semibold text-sm text-[var(--text-1)]">Clean Slate Light</div>
            <p className="text-xs text-[var(--text-2)] mt-1">
              Clean, crisp daytime light mode for bright workspaces.
            </p>
          </button>

          {/* System Default */}
          <button
            type="button"
            onClick={() => handleSave({ ...settings, theme: "system" })}
            className={`forge-card p-4 rounded-xl text-left transition-all bg-[var(--panel)] ${
              settings.theme === "system"
                ? "border-blue-400 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                : "border-[var(--border)] hover:border-blue-400/40"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Monitor className="w-5 h-5 text-blue-500" />
              {settings.theme === "system" && (
                <span className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </div>
            <div className="font-semibold text-sm text-[var(--text-1)]">System Default</div>
            <p className="text-xs text-[var(--text-2)] mt-1">
              Automatically syncs with Windows OS theme preference.
            </p>
          </button>
        </div>
      </div>

      {/* 6. History Retention & Privacy */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-[#FF4D5E] uppercase tracking-wider flex items-center gap-2 font-display">
          <Shield className="w-4 h-4" /> History Retention & Privacy
        </h3>

        <div className="forge-card p-4 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--panel)]">
          <div>
            <label className="text-xs text-[var(--text-2)] block mb-1.5 font-mono">
              Retention Policy
            </label>
            <select
              value={settings.retention_policy}
              onChange={(e) =>
                handleSave({
                  ...settings,
                  retention_policy: e.target.value as RetentionPolicy,
                })
              }
              className="w-full px-3.5 py-2.5 bg-[var(--raised)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-1)] focus:outline-none focus:border-[#FF4D5E]"
            >
              <option value="Days30">Keep for 30 Days (Default)</option>
              <option value="Days7">Keep for 7 Days</option>
              <option value="Forever">Keep Forever</option>
              <option value="Off">Do Not Save (Off)</option>
            </select>
          </div>
          <p className="text-[11px] text-[var(--text-3)]">
            Audio is never persisted to disk in any retention mode.
          </p>
        </div>
      </div>

      {/* 7. About & Branding */}
      <div className="forge-card p-5 rounded-2xl border border-[var(--border)] bg-[var(--panel)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <ForgeLogo size={44} />
          <div>
            <div className="text-sm font-bold font-display text-[var(--text-1)]">
              Forge Wisper <span className="text-[10px] font-mono text-teal-600 dark:text-[#3FE3C4] ml-1.5 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20">v0.1.0</span>
            </div>
            <p className="text-xs text-[var(--text-2)] mt-0.5">
              Created with ❤️ by <strong className="text-[var(--text-1)]">Ali Zazan</strong> • Open Source under MIT License
            </p>
          </div>
        </div>
        <div className="text-[11px] font-mono text-[var(--text-3)]">
          github.com/zazanali/forge-wisper
        </div>
      </div>
    </div>
  );
};
