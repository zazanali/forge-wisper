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
      <div className="p-8 text-center text-[#5C6478] flex items-center justify-center gap-2 font-sans">
        <Loader2 className="w-5 h-5 animate-spin text-[#FF4D5E]" /> Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn max-w-3xl pb-12 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-[#E8ECF2]">
            Settings & Preferences
          </h2>
          <p className="text-xs text-[#9BA3B5]">
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
            className={`forge-card p-4 text-left rounded-xl transition-all ${
              settings.provider === "mock"
                ? "border-[#FF4D5E] bg-[#FF4D5E]/10 shadow-lg shadow-[#FF4D5E]/10"
                : "border-[#2A2E38] hover:border-[#FF4D5E]/40"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Sparkles className="w-5 h-5 text-[#FF4D5E]" />
              {settings.provider === "mock" && (
                <span className="w-2 h-2 rounded-full bg-[#FF4D5E]" />
              )}
            </div>
            <div className="font-semibold text-sm text-[#E8ECF2]">Mock Engine</div>
            <p className="text-xs text-[#9BA3B5] mt-1">
              Deterministic offline testing without any API key or model.
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
            className={`forge-card p-4 text-left rounded-xl transition-all ${
              settings.provider === "groq"
                ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10"
                : "border-[#2A2E38] hover:border-amber-500/40"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-5 h-5 text-amber-400" />
              {settings.provider === "groq" && (
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              )}
            </div>
            <div className="font-semibold text-sm text-[#E8ECF2]">Groq Whisper</div>
            <p className="text-xs text-[#9BA3B5] mt-1">
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
            className={`forge-card p-4 text-left rounded-xl transition-all ${
              settings.provider === "local-whisper"
                ? "border-[#3FE3C4] bg-[#3FE3C4]/10 shadow-lg shadow-[#3FE3C4]/10"
                : "border-[#2A2E38] hover:border-[#3FE3C4]/40"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Cpu className="w-5 h-5 text-[#3FE3C4]" />
              {settings.provider === "local-whisper" && (
                <span className="w-2 h-2 rounded-full bg-[#3FE3C4]" />
              )}
            </div>
            <div className="font-semibold text-sm text-[#E8ECF2]">Local Whisper</div>
            <p className="text-xs text-[#9BA3B5] mt-1">
              100% private offline transcription running on your machine.
            </p>
          </button>
        </div>
      </div>

      {/* 2. Groq API Configuration */}
      <div className="forge-card p-5 space-y-4 rounded-xl border border-[#2A2E38]">
        <h4 className="text-sm font-semibold text-[#E8ECF2] flex items-center gap-2 font-display">
          <Key className="w-4 h-4 text-amber-400" /> Groq API Credentials
        </h4>
        <p className="text-xs text-[#9BA3B5]">
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
                  ? "•••••••••••••••••••••••••••• (Key is saved)"
                  : "Enter your gsk_... API key"
              }
              className="flex-1 px-3.5 py-2 bg-[#0C0E14] border border-[#2A2E38] rounded-xl text-sm text-[#E8ECF2] focus:outline-none focus:border-[#FF4D5E] font-mono"
            />
            <div className="flex gap-2">
              <button
                onClick={saveGroqKey}
                disabled={!apiKeyInput.trim()}
                className="px-4 py-2 bg-[#1C2028] hover:bg-[#252A34] border border-[#2A2E38] rounded-xl text-xs font-semibold text-[#E8ECF2] disabled:opacity-40 transition-colors"
              >
                Save Key
              </button>
              <button
                onClick={testConnection}
                disabled={isTestingKey}
                className="px-4 py-2 btn-blade rounded-xl text-xs font-semibold text-white disabled:opacity-50 flex items-center gap-1.5"
              >
                {isTestingKey && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Test Connection
              </button>
              {hasStoredKey && (
                <button
                  onClick={removeGroqKey}
                  className="px-3 py-2 bg-[#FF4D5E]/15 hover:bg-[#FF4D5E]/25 text-[#FF4D5E] border border-[#FF4D5E]/30 rounded-xl text-xs font-semibold transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                testResult.success
                  ? "bg-[#3FE3C4]/15 text-[#3FE3C4] border border-[#3FE3C4]/30"
                  : "bg-[#FF4D5E]/15 text-[#FF4D5E] border border-[#FF4D5E]/30"
              }`}
            >
              {testResult.success ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{testResult.msg}</span>
            </div>
          )}

          {/* Groq Model Picker */}
          {settings.provider === "groq" && (
            <div className="pt-2">
              <label className="text-xs text-[#9BA3B5] block mb-1.5 font-mono">
                Groq Whisper Model
              </label>
              <select
                value={settings.model}
                onChange={(e) =>
                  handleSave({ ...settings, model: e.target.value })
                }
                className="w-full px-3.5 py-2.5 bg-[#0C0E14] border border-[#2A2E38] rounded-xl text-sm text-[#E8ECF2] focus:outline-none focus:border-[#FF4D5E]"
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

        <div className="forge-card p-4 space-y-3 rounded-xl border border-[#2A2E38]">
          <div>
            <label className="text-xs text-[#9BA3B5] block mb-1.5 font-mono">
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
              className="w-full px-3.5 py-2.5 bg-[#0C0E14] border border-[#2A2E38] rounded-xl text-sm text-[#E8ECF2] focus:outline-none focus:border-[#FF4D5E]"
            >
              <option value="">System Default Microphone</option>
              {audioDevices.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name} {d.is_default ? "(Default)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 border-t border-[#2A2E38] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9BA3B5]">Microphone Hardware Level Test</span>
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
                <div className="h-3 bg-[#0C0E14] rounded-full overflow-hidden border border-[#2A2E38] p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-75 ${
                      micLevel > 60
                        ? "bg-amber-400"
                        : micLevel > 10
                        ? "bg-[#3FE3C4]"
                        : "bg-[#5C6478]"
                    }`}
                    style={{ width: `${Math.max(4, micLevel)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#5C6478] font-mono">
                  <span>Mute</span>
                  <span className={micLevel > 15 ? "text-[#3FE3C4] font-bold" : ""}>
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

        <div className="forge-card p-4 space-y-4 rounded-xl border border-[#2A2E38]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#9BA3B5] block mb-1.5 font-mono">
                Global Hotkey
              </label>
              <input
                type="text"
                value={settings.hotkey}
                onChange={(e) =>
                  handleSave({ ...settings, hotkey: e.target.value })
                }
                className="w-full px-3.5 py-2 bg-[#0C0E14] border border-[#2A2E38] rounded-xl text-sm text-[#E8ECF2] font-mono focus:outline-none focus:border-[#FF4D5E]"
              />
            </div>

            <div>
              <label className="text-xs text-[#9BA3B5] block mb-1.5 font-mono">
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
                      : "border-[#2A2E38] text-[#9BA3B5] hover:text-[#E8ECF2] hover:bg-[#1C2028]"
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
                      : "border-[#2A2E38] text-[#9BA3B5] hover:text-[#E8ECF2] hover:bg-[#1C2028]"
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
        <h3 className="text-xs font-semibold text-[#FF4D5E] uppercase tracking-wider flex items-center gap-2 font-display">
          <BookOpen className="w-4 h-4" /> Personal Dictionary
        </h3>

        <div className="forge-card p-4 space-y-3 rounded-xl border border-[#2A2E38]">
          <p className="text-xs text-[#9BA3B5]">
            Map phonetic or mistranscribed words into proper casing and company/project names.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newSpoken}
              onChange={(e) => setNewSpoken(e.target.value)}
              placeholder="Spoken: e.g. 'lang chain'"
              className="flex-1 px-3.5 py-2 bg-[#0C0E14] border border-[#2A2E38] rounded-xl text-xs text-[#E8ECF2] focus:outline-none focus:border-[#FF4D5E]"
            />
            <input
              type="text"
              value={newPreferred}
              onChange={(e) => setNewPreferred(e.target.value)}
              placeholder="Preferred: e.g. 'LangChain'"
              className="flex-1 px-3.5 py-2 bg-[#0C0E14] border border-[#2A2E38] rounded-xl text-xs text-[#E8ECF2] focus:outline-none focus:border-[#FF4D5E]"
            />
            <button
              onClick={addDictionaryWord}
              disabled={!newSpoken.trim() || !newPreferred.trim()}
              className="px-4 py-2 btn-blade rounded-xl text-xs font-semibold text-white disabled:opacity-40 flex items-center gap-1 justify-center"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 pt-2">
            {Object.entries(settings.dictionary).map(([spoken, preferred]) => (
              <div
                key={spoken}
                className="flex items-center justify-between p-2.5 bg-[#0C0E14] rounded-xl border border-[#2A2E38] text-xs font-mono"
              >
                <span>
                  <span className="text-[#9BA3B5]">{spoken}</span> →{" "}
                  <span className="text-[#FF4D5E] font-semibold">
                    {preferred}
                  </span>
                </span>
                <button
                  onClick={() => removeDictionaryWord(spoken)}
                  className="text-[#5C6478] hover:text-[#FF4D5E] p-1 transition-colors"
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
        <h3 className="text-xs font-semibold text-[#FF4D5E] uppercase tracking-wider flex items-center gap-2 font-display">
          <Shield className="w-4 h-4" /> History Retention & Privacy
        </h3>

        <div className="forge-card p-4 space-y-3 rounded-xl border border-[#2A2E38]">
          <div>
            <label className="text-xs text-[#9BA3B5] block mb-1.5 font-mono">
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
              className="w-full px-3.5 py-2.5 bg-[#0C0E14] border border-[#2A2E38] rounded-xl text-sm text-[#E8ECF2] focus:outline-none focus:border-[#FF4D5E]"
            >
              <option value="Days30">Keep for 30 Days (Default)</option>
              <option value="Days7">Keep for 7 Days</option>
              <option value="Forever">Keep Forever</option>
              <option value="Off">Do Not Save (Off)</option>
            </select>
          </div>
          <p className="text-[11px] text-[#5C6478]">
            Audio is never persisted to disk in any retention mode.
          </p>
        </div>
      </div>
    </div>
  );
};
