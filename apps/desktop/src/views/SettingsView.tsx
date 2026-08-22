import React, { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import type {
  AppSettings,
  AudioDeviceInfo,
  RetentionPolicy,
} from "../types";
import {
  Zap,
  Cpu,
  Sparkles,
  Mic,
  Key,
  Keyboard,
  Shield,
  BookOpen,
  Check,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [audioDevices, setAudioDevices] = useState<AudioDeviceInfo[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    msg: string;
  } | null>(null);

  const [newSpoken, setNewSpoken] = useState("");
  const [newPreferred, setNewPreferred] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  const handleSave = async (updated: AppSettings) => {
    try {
      await api.updateSettings(updated);
      setSettings(updated);
      setSaveSuccess(true);
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
      setTestResult({ success: true, msg: "API Key saved securely in OS Keyring" });
    } catch (e) {
      setTestResult({ success: false, msg: `Failed to save key: ${e}` });
    }
  };

  const removeGroqKey = async () => {
    try {
      await api.deleteGroqKey();
      setHasStoredKey(false);
      setTestResult({ success: true, msg: "API Key removed from Keyring" });
    } catch (e) {
      console.error(e);
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

  const addDictionaryWord = () => {
    if (!settings || !newSpoken.trim() || !newPreferred.trim()) return;
    const updatedDict = {
      ...settings.dictionary,
      [newSpoken.trim().toLowerCase()]: newPreferred.trim(),
    };
    const updatedSettings = { ...settings, dictionary: updatedDict };
    handleSave(updatedSettings);
    setNewSpoken("");
    setNewPreferred("");
  };

  const removeDictionaryWord = (key: string) => {
    if (!settings) return;
    const updatedDict = { ...settings.dictionary };
    delete updatedDict[key];
    const updatedSettings = { ...settings, dictionary: updatedDict };
    handleSave(updatedSettings);
  };

  if (!settings) {
    return (
      <div className="p-8 text-center text-forge-muted flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn max-w-3xl pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-forge-text">
            Settings & Preferences
          </h2>
          <p className="text-xs text-forge-muted">
            Configure speech engines, microphone, shortcuts, and personal vocabulary (§84).
          </p>
        </div>
        {saveSuccess && (
          <span className="inline-flex items-center gap-1 text-xs text-forge-success bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/40">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      {/* 1. Speech Engine Selection */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-forge-accent uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4" /> Transcription Engine (§14)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Mock Option */}
          <button
            onClick={() =>
              handleSave({
                ...settings,
                provider: "mock",
                model: "mock-instant",
              })
            }
            className={`forge-card p-4 text-left transition-all ${
              settings.provider === "mock"
                ? "border-forge-accent/60 bg-forge-strong/10"
                : "hover:border-white/20"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Sparkles className="w-5 h-5 text-forge-accent" />
              {settings.provider === "mock" && (
                <span className="w-2 h-2 rounded-full bg-forge-accent" />
              )}
            </div>
            <div className="font-semibold text-sm text-forge-text">Mock Engine</div>
            <p className="text-xs text-forge-muted mt-1">
              Deterministic offline testing without any API key or heavy model.
            </p>
          </button>

          {/* Groq Cloud Option */}
          <button
            onClick={() =>
              handleSave({
                ...settings,
                provider: "groq",
                model: "whisper-large-v3-turbo",
              })
            }
            className={`forge-card p-4 text-left transition-all ${
              settings.provider === "groq"
                ? "border-amber-500/60 bg-amber-950/20"
                : "hover:border-white/20"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-5 h-5 text-amber-400" />
              {settings.provider === "groq" && (
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              )}
            </div>
            <div className="font-semibold text-sm text-forge-text">Groq Whisper</div>
            <p className="text-xs text-forge-muted mt-1">
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
            className={`forge-card p-4 text-left transition-all ${
              settings.provider === "local-whisper"
                ? "border-emerald-500/60 bg-emerald-950/20"
                : "hover:border-white/20"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Cpu className="w-5 h-5 text-emerald-400" />
              {settings.provider === "local-whisper" && (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </div>
            <div className="font-semibold text-sm text-forge-text">Local Whisper</div>
            <p className="text-xs text-forge-muted mt-1">
              100% private offline transcription running on your CPU/GPU.
            </p>
          </button>
        </div>
      </div>

      {/* 2. Groq API Configuration (if Groq selected or configure key) */}
      <div className="forge-card p-5 space-y-4 border border-white/10">
        <h4 className="text-sm font-semibold text-forge-text flex items-center gap-2">
          <Key className="w-4 h-4 text-amber-400" /> Groq API Credentials (§19)
        </h4>
        <p className="text-xs text-forge-muted">
          Your API key is never logged or saved to source code. It is stored securely in your OS Credential Vault (Keyring).
        </p>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={
                hasStoredKey
                  ? "•••••••••••••••••••••••••••• (Key is saved)"
                  : "Enter your gsk_... API key"
              }
              className="flex-1 px-3.5 py-2 bg-forge-bg border border-white/10 rounded-md text-sm text-forge-text focus:outline-none focus:border-forge-accent/40"
            />
            <button
              onClick={saveGroqKey}
              disabled={!apiKeyInput.trim()}
              className="px-4 py-2 bg-forge-surface hover:bg-forge-hover border border-white/10 rounded-md text-xs font-medium text-forge-text disabled:opacity-40"
            >
              Save Key
            </button>
            <button
              onClick={testConnection}
              disabled={isTestingKey}
              className="px-4 py-2 bg-forge-strong hover:bg-forge-strong/90 rounded-md text-xs font-medium text-white disabled:opacity-50 flex items-center gap-1.5"
            >
              {isTestingKey && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Test Connection
            </button>
            {hasStoredKey && (
              <button
                onClick={removeGroqKey}
                className="px-3 py-2 bg-forge-error/10 hover:bg-forge-error/20 text-forge-error rounded-md text-xs"
              >
                Remove
              </button>
            )}
          </div>

          {testResult && (
            <div
              className={`p-3 rounded text-xs flex items-center gap-2 ${
                testResult.success
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/40"
                  : "bg-red-950/80 text-red-400 border border-red-800/40"
              }`}
            >
              {testResult.success ? (
                <Check className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span>{testResult.msg}</span>
            </div>
          )}

          {/* Groq Model Picker */}
          {settings.provider === "groq" && (
            <div className="pt-2">
              <label className="text-xs text-forge-muted block mb-1.5">
                Groq Whisper Model
              </label>
              <select
                value={settings.model}
                onChange={(e) =>
                  handleSave({ ...settings, model: e.target.value })
                }
                className="w-full px-3 py-2 bg-forge-bg border border-white/10 rounded-md text-sm text-forge-text focus:outline-none focus:border-forge-accent/40"
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
        <h3 className="text-sm font-semibold text-forge-accent uppercase tracking-wider flex items-center gap-2">
          <Mic className="w-4 h-4" /> Microphone (§10)
        </h3>

        <div className="forge-card p-4">
          <label className="text-xs text-forge-muted block mb-1.5">
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
            className="w-full px-3 py-2 bg-forge-bg border border-white/10 rounded-md text-sm text-forge-text focus:outline-none focus:border-forge-accent/40"
          >
            <option value="">System Default Microphone</option>
            {audioDevices.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name} {d.is_default ? "(Default)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Hotkeys & Interaction Modes */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-forge-accent uppercase tracking-wider flex items-center gap-2">
          <Keyboard className="w-4 h-4" /> Shortcut & Trigger Mode (§11–§12)
        </h3>

        <div className="forge-card p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-forge-muted block mb-1.5">
                Global Hotkey
              </label>
              <input
                type="text"
                value={settings.hotkey}
                onChange={(e) =>
                  handleSave({ ...settings, hotkey: e.target.value })
                }
                className="w-full px-3 py-2 bg-forge-bg border border-white/10 rounded-md text-sm text-forge-text font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-forge-muted block mb-1.5">
                Interaction Trigger
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    handleSave({ ...settings, is_toggle_mode: false })
                  }
                  className={`flex-1 py-2 rounded-md text-xs font-medium border transition-colors ${
                    !settings.is_toggle_mode
                      ? "border-forge-accent bg-forge-strong/20 text-forge-text"
                      : "border-white/10 text-forge-muted hover:text-forge-text"
                  }`}
                >
                  Push-to-Talk (Hold)
                </button>
                <button
                  onClick={() =>
                    handleSave({ ...settings, is_toggle_mode: true })
                  }
                  className={`flex-1 py-2 rounded-md text-xs font-medium border transition-colors ${
                    settings.is_toggle_mode
                      ? "border-forge-accent bg-forge-strong/20 text-forge-text"
                      : "border-white/10 text-forge-muted hover:text-forge-text"
                  }`}
                >
                  Toggle (Start/Stop)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Personal Vocabulary / Dictionary */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-forge-accent uppercase tracking-wider flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Personal Dictionary (§25)
        </h3>

        <div className="forge-card p-4 space-y-3">
          <p className="text-xs text-forge-muted">
            Map phonetic or mistranscribed words into proper casing and company/project names.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={newSpoken}
              onChange={(e) => setNewSpoken(e.target.value)}
              placeholder="Spoken: e.g. 'lang chain'"
              className="flex-1 px-3 py-2 bg-forge-bg border border-white/10 rounded-md text-xs text-forge-text"
            />
            <input
              type="text"
              value={newPreferred}
              onChange={(e) => setNewPreferred(e.target.value)}
              placeholder="Preferred: e.g. 'LangChain'"
              className="flex-1 px-3 py-2 bg-forge-bg border border-white/10 rounded-md text-xs text-forge-text"
            />
            <button
              onClick={addDictionaryWord}
              disabled={!newSpoken.trim() || !newPreferred.trim()}
              className="px-3.5 py-2 bg-forge-strong hover:bg-forge-strong/90 rounded-md text-xs text-white disabled:opacity-40 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 pt-2">
            {Object.entries(settings.dictionary).map(([spoken, preferred]) => (
              <div
                key={spoken}
                className="flex items-center justify-between p-2 bg-black/30 rounded border border-white/5 text-xs font-mono"
              >
                <span>
                  <span className="text-forge-muted">{spoken}</span> →{" "}
                  <span className="text-forge-accent font-semibold">
                    {preferred}
                  </span>
                </span>
                <button
                  onClick={() => removeDictionaryWord(spoken)}
                  className="text-forge-muted hover:text-forge-error p-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. History Retention & Privacy */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-forge-accent uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4" /> History Retention & Privacy (§53, §59)
        </h3>

        <div className="forge-card p-4 space-y-3">
          <div>
            <label className="text-xs text-forge-muted block mb-1.5">
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
              className="w-full px-3 py-2 bg-forge-bg border border-white/10 rounded-md text-sm text-forge-text focus:outline-none"
            >
              <option value="Days30">Keep for 30 Days (Default)</option>
              <option value="Days7">Keep for 7 Days</option>
              <option value="Forever">Keep Forever</option>
              <option value="Off">Do Not Save (Off)</option>
            </select>
          </div>
          <p className="text-[11px] text-forge-muted">
            Audio is never persisted to disk in any retention mode.
          </p>
        </div>
      </div>
    </div>
  );
};
