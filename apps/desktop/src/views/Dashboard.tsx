import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/tauri";
import type {
  AppSettings,
  AudioDeviceInfo,
  FormattingMode,
  HistoryRecord,
  ProcessingState,
} from "../types";
import { SUPPORTED_LANGUAGES } from "../types";
import {
  Mic,
  Square,
  Zap,
  Copy,
  Check,
  Loader2,
  Settings as SettingsIcon,
  FileText,
  MoreVertical,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { formatKeyForDisplay } from "./SettingsView";

interface DashboardProps {
  onNavigate: (tab: "dashboard" | "history" | "models" | "dictionary" | "settings") => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [procState, setProcState] = useState<ProcessingState>("Idle");
  const [audioDevices, setAudioDevices] = useState<AudioDeviceInfo[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dictationCopied, setDictationCopied] = useState(false);

  const [allHistoryRecords, setAllHistoryRecords] = useState<HistoryRecord[]>([]);
  const [timeframe, setTimeframe] = useState<"Today" | "Week" | "All">("Today");
  const [showTimeframeDropdown, setShowTimeframeDropdown] = useState(false);
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [showMicDropdown, setShowMicDropdown] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showTopLanguageDropdown, setShowTopLanguageDropdown] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Audio level and live timer
  const [audioLevel, setAudioLevel] = useState(0.25);
  const [durationSecs, setDurationSecs] = useState(0);
  const [liveSpokenText, setLiveSpokenText] = useState("");

  const formatDropdownRef = useRef<HTMLDivElement>(null);
  const timeframeDropdownRef = useRef<HTMLDivElement>(null);
  const micDropdownRef = useRef<HTMLDivElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const topLanguageDropdownRef = useRef<HTMLDivElement>(null);

  // Metrics
  const [metrics, setMetrics] = useState({
    wordsTranscribed: 0,
    timeSavedStr: "0m",
    sessionsCount: 0,
    wpm: 0,
  });

  useEffect(() => {
    loadData();
    const unlisten = api.onStateChange(({ state }) => {
      setProcState(state);
      if (state === "Success" || state === "Idle" || state === "Error") {
        loadData();
        if (state === "Idle" || state === "Success") {
          setLiveSpokenText("");
        }
      }
    });

    const unlistenLive = api.onLiveTranscript((payload) => {
      setLiveSpokenText(payload.text);
    });

    // Close dropdowns on outside click
    const handleOutsideClick = (e: MouseEvent) => {
      if (formatDropdownRef.current && !formatDropdownRef.current.contains(e.target as Node)) {
        setShowFormatDropdown(false);
      }
      if (timeframeDropdownRef.current && !timeframeDropdownRef.current.contains(e.target as Node)) {
        setShowTimeframeDropdown(false);
      }
      if (micDropdownRef.current && !micDropdownRef.current.contains(e.target as Node)) {
        setShowMicDropdown(false);
      }
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
        setShowModeDropdown(false);
      }
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target as Node)) {
        setShowLanguageDropdown(false);
      }
      if (topLanguageDropdownRef.current && !topLanguageDropdownRef.current.contains(e.target as Node)) {
        setShowTopLanguageDropdown(false);
      }
      setActiveMenuId(null);
    };

    window.addEventListener("click", handleOutsideClick);

    return () => {
      unlisten.then((fn) => fn());
      unlistenLive.then((fn) => fn());
      window.removeEventListener("click", handleOutsideClick);
    };
  }, []);

  // Recalculate metrics whenever allHistoryRecords or timeframe changes
  useEffect(() => {
    if (allHistoryRecords.length === 0) {
      setMetrics({
        wordsTranscribed: 0,
        timeSavedStr: "0m",
        sessionsCount: 0,
        wpm: 0,
      });
      return;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    const filtered = allHistoryRecords.filter((r) => {
      const t = new Date(r.created_at).getTime();
      if (timeframe === "Today") return t >= startOfToday;
      if (timeframe === "Week") return t >= sevenDaysAgo;
      return true;
    });

    const totalDuration = filtered.reduce((acc, r) => acc + (r.duration_ms || 0), 0);
    const totalWords = filtered.reduce((acc, r) => {
      const words = (r.final_text || "").trim().split(/\s+/).filter(Boolean).length;
      return acc + words;
    }, 0);

    const totalAudioMinutes = totalDuration / 1000 / 60;
    const rawWpm = totalAudioMinutes > 0 ? Math.round(totalWords / totalAudioMinutes) : (totalWords > 0 ? 148 : 0);
    const effectiveWpm = rawWpm > 0 && rawWpm < 300 ? rawWpm : (totalWords > 0 ? 148 : 0);

    const savedMinutes = Math.round(totalWords * 0.0183);
    const savedStr = savedMinutes >= 60
      ? `${(savedMinutes / 60).toFixed(1)}h`
      : `${savedMinutes}m`;

    setMetrics({
      wordsTranscribed: totalWords,
      timeSavedStr: savedStr,
      sessionsCount: filtered.length,
      wpm: effectiveWpm,
    });
  }, [allHistoryRecords, timeframe]);

  const loadData = async () => {
    try {
      const [s, allHistory, st, devices] = await Promise.all([
        api.getSettings(),
        api.listHistory(100),
        api.getProcessingState(),
        api.getAudioDevices().catch(() => [] as AudioDeviceInfo[]),
      ]);

      setSettings(s);
      setAllHistoryRecords(allHistory);
      setHistory(allHistory.slice(0, 5));
      setProcState(st);
      setAudioDevices(devices);
    } catch (e) {
      console.error("Error loading dashboard data:", e);
    }
  };

  const isRecording = procState === "Listening";
  const isProcessing = [
    "Stopping",
    "Transcribing",
    "Cleaning",
    "Structuring",
    "Verifying",
    "Inserting",
  ].includes(procState);

  // Live recording timer
  useEffect(() => {
    if (procState !== "Listening") {
      setDurationSecs(0);
      return;
    }
    const interval = setInterval(() => setDurationSecs((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [procState]);

  // Audio level polling for live soundwave & VU meter
  useEffect(() => {
    if (procState !== "Listening") {
      setAudioLevel(0);
      return;
    }
    const interval = setInterval(async () => {
      try {
        const rms = await api.getMicLevel();
        const level = Math.min(1.0, Math.max(0.05, rms * 8.0));
        setAudioLevel(level);
      } catch {
        // ignore
      }
    }, 40);
    return () => clearInterval(interval);
  }, [procState]);

  const toggleRecording = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isProcessing) return;

    try {
      if (isRecording) {
        setProcState("Stopping");
        await api.stopRecording();
      } else {
        setProcState("Listening");
        await api.startRecording();
      }
    } catch (err) {
      console.error("Recording toggle error:", err);
      try {
        const current = await api.getProcessingState();
        setProcState(current);
      } catch {
        setProcState("Idle");
      }
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const copyLiveDictation = (text: string) => {
    navigator.clipboard.writeText(text);
    setDictationCopied(true);
    setTimeout(() => setDictationCopied(false), 1500);
  };

  const deleteHistoryRecord = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteHistoryItem(id);
      loadData();
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  const handleUpdateMode = async (mode: FormattingMode) => {
    if (!settings) return;
    const updated = { ...settings, formatting_mode: mode };
    try {
      await api.updateSettings(updated);
      setSettings(updated);
      setShowModeDropdown(false);
    } catch (err) {
      console.error("Failed to update mode:", err);
    }
  };

  const handleUpdateProvider = async (provider: string) => {
    if (!settings) return;
    const defaultModel =
      provider === "local-whisper"
        ? (settings.model.startsWith("whisper-") ? "base" : settings.model)
        : (settings.model === "base" || settings.model === "tiny" ? "whisper-large-v3-turbo" : settings.model);

    const updated = { ...settings, provider, model: defaultModel };
    try {
      await api.updateSettings(updated);
      setSettings(updated);
    } catch (err) {
      console.error("Failed to update provider:", err);
    }
  };

  const handleSelectMicrophone = async (micName: string | null) => {
    if (!settings) return;
    const updated = { ...settings, microphone: micName };
    try {
      await api.updateSettings(updated);
      setSettings(updated);
      setShowMicDropdown(false);
    } catch (err) {
      console.error("Failed to update microphone:", err);
    }
  };

  const handleSelectLanguage = async (code: string) => {
    if (!settings) return;
    const updated = { ...settings, language: code };
    try {
      await api.updateSettings(updated);
      setSettings(updated);
      setShowLanguageDropdown(false);
    } catch (err) {
      console.error("Failed to update language:", err);
    }
  };

  const getSelectedLanguageDisplay = () => {
    const code = settings?.language || "auto";
    const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    if (!found || code === "auto") {
      return { flag: "🌐", name: "Auto-Detect", code: "auto" };
    }
    return found;
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const formatModelDisplayName = (modelStr?: string, provider?: string) => {
    if (!modelStr) return provider === "local-whisper" ? "base" : "v3-turbo";
    const clean = modelStr.toLowerCase().replace(/^ggml-/, "").replace(/\.bin$/, "");
    if (clean === "whisper-large-v3-turbo") return "v3-turbo";
    if (clean === "whisper-large-v3") return "large-v3";
    return clean;
  };

  const readableHotkey = (settings?.hotkey || "Control+Space")
    .split("+")
    .map(formatKeyForDisplay)
    .join(" + ");

  // Latest dictation sample text or live buffer
  const latestDictationText =
    (isRecording || isProcessing) && liveSpokenText
      ? liveSpokenText
      : history[0]?.final_text ||
        (isRecording ? "Listening to speech & typing in real-time..." : `Ready to dictate. Press ${readableHotkey} to speak.`);

  const parseSavedTime = (str: string) => {
    const clean = str.replace("~", "").trim();
    const match = clean.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
    if (match) {
      return { value: match[1], unit: match[2] };
    }
    return { value: clean || "0", unit: "m" };
  };
  const savedTime = parseSavedTime(metrics.timeSavedStr);

  // Equalizer bars for balanced card width
  const equalizerMultipliers = [
    0.15, 0.25, 0.35, 0.5, 0.65, 0.8, 0.95, 1.0,
    0.9, 0.75, 0.6, 0.5, 0.45, 0.6, 0.8, 1.0,
    0.9, 0.75, 0.6, 0.45, 0.35, 0.5, 0.7, 0.85,
    0.7, 0.5, 0.35, 0.2,
  ];

  return (
    <div className="space-y-4 animate-fadeIn font-sans max-w-[1200px] mx-auto select-none">
      {/* 1. TOP ACTION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] font-sans">
        {/* Left Side: Status & Active Engine Pill */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Status Indicator Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[var(--surface-primary)] border border-[var(--border)] text-[13px]">
            <span
              className={`w-2 h-2 rounded-full ${
                isRecording ? "bg-[var(--accent)] animate-pulse" : "bg-[var(--accent)]"
              }`}
            />
            <span className="font-medium text-[var(--text-primary)]">
              {isRecording ? `Recording (${formatTime(durationSecs)})` : "Ready"}
            </span>
          </div>

          {/* Engine Pill */}
          <button
            type="button"
            onClick={() => onNavigate(settings?.provider === "local-whisper" ? "models" : "settings")}
            title="Active Speech Engine & Model (Click to configure)"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[var(--surface-primary)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] text-[13px] cursor-pointer transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-[var(--warning)] shrink-0" />
            <span className="font-medium text-[var(--text-primary)]">
              {settings?.provider === "local-whisper" ? "Local Whisper" : "Groq Cloud"}
            </span>
            <span className="px-1.5 py-0.2 rounded-[4px] bg-[var(--surface-elevated)] text-[11px] font-mono text-[var(--text-muted)] border border-[var(--border)]">
              {formatModelDisplayName(settings?.model, settings?.provider)}
            </span>
          </button>

          {/* Quick Language Switcher Dropdown */}
          <div className="relative" ref={topLanguageDropdownRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowTopLanguageDropdown(!showTopLanguageDropdown);
              }}
              title="Active Speech Recognition Language (Click to quickly change language)"
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] border text-[13px] cursor-pointer transition-all ${
                showTopLanguageDropdown
                  ? "bg-[var(--surface-elevated)] border-[var(--accent)] ring-1 ring-[var(--accent)]"
                  : "bg-[var(--surface-primary)] hover:bg-[var(--surface-elevated)] border-[var(--border)]"
              }`}
            >
              <span className="text-[13px] leading-none">{getSelectedLanguageDisplay().flag}</span>
              <span className="font-medium text-[var(--text-primary)]">
                {getSelectedLanguageDisplay().name}
              </span>
              {(!settings?.language || settings.language === "en") ? (
                <span className="px-1.5 py-0.2 rounded-[4px] bg-[var(--accent-subtle)] text-[11px] font-mono text-[var(--accent)] border border-[var(--accent-border)] font-semibold">
                  EN (Locked)
                </span>
              ) : settings?.language !== "auto" ? (
                <span className="px-1.5 py-0.2 rounded-[4px] bg-[var(--accent-subtle)] text-[11px] font-mono text-[var(--accent)] border border-[var(--accent-border)] font-semibold uppercase">
                  {settings.language}
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded-[4px] bg-[var(--surface-elevated)] text-[11px] font-mono text-[var(--text-muted)] border border-[var(--border)]">
                  Auto
                </span>
              )}
              <ChevronDown className={`w-3 h-3 text-[var(--text-muted)] shrink-0 transition-transform ${showTopLanguageDropdown ? "rotate-180" : ""}`} />
            </button>

            {showTopLanguageDropdown && (
              <div className="absolute left-0 mt-1.5 w-64 max-h-72 overflow-y-auto py-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[8px] shadow-xl z-40 font-sans text-[12px] animate-fadeIn">
                <div className="px-3 py-1 text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                  Speech Language
                </div>

                {/* English First / Primary Option */}
                <button
                  type="button"
                  onClick={() => {
                    handleSelectLanguage("en");
                    setShowTopLanguageDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-between ${
                    (!settings?.language || settings.language === "en") ? "bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold" : "text-[var(--text-primary)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[14px]">🇺🇸</span>
                    <span>English (Recommended)</span>
                  </span>
                  {(!settings?.language || settings.language === "en") && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
                </button>

                <div className="border-t border-[var(--border-subtle)] my-1" />

                {[
                  { code: "auto", name: "Auto-Detect All", flag: "🌐" },
                  { code: "ur", name: "Urdu (اردو)", flag: "🇵🇰" },
                  { code: "hi", name: "Hindi (हिन्दी)", flag: "🇮🇳" },
                  { code: "ar", name: "Arabic (العربية)", flag: "🇸🇦" },
                  { code: "es", name: "Spanish", flag: "🇪🇸" },
                  { code: "fr", name: "French", flag: "🇫🇷" },
                  { code: "de", name: "German", flag: "🇩🇪" },
                  { code: "zh", name: "Chinese (中文)", flag: "🇨🇳" },
                  { code: "ja", name: "Japanese (日本語)", flag: "🇯🇵" },
                ].map((lang) => {
                  const isSelected = settings?.language === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        handleSelectLanguage(lang.code);
                        setShowTopLanguageDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-between ${
                        isSelected ? "text-[var(--accent)] font-semibold" : "text-[var(--text-primary)]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-[13px]">{lang.flag}</span>
                        <span className="truncate">{lang.name}</span>
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
                    </button>
                  );
                })}

                <div className="border-t border-[var(--border-subtle)] my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setShowTopLanguageDropdown(false);
                    onNavigate("settings");
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)] text-[var(--accent)] font-medium transition-colors flex items-center justify-between"
                >
                  <span>More Languages & Settings &rarr;</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Keycaps, Dictate Button & Settings */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Shortcut Keycaps */}
          <div
            onClick={() => onNavigate("settings")}
            title="Configured Global Hotkey (Click to change in Settings)"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[var(--surface-primary)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] text-[12px] font-mono text-[var(--text-muted)] cursor-pointer transition-colors"
          >
            {(settings?.hotkey || "Control+Space").split("+").map((keyPart, idx, arr) => (
              <React.Fragment key={idx}>
                <span className="font-medium text-[var(--text-primary)]">
                  {formatKeyForDisplay(keyPart)}
                </span>
                {idx < arr.length - 1 && (
                  <span className="text-[10px] text-[var(--text-muted)] font-bold">+</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Primary Dictate Button */}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isProcessing}
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-[6px] font-medium text-[13px] transition-all duration-150 select-none cursor-pointer shadow-xs ${
              isProcessing
                ? "bg-[var(--surface-elevated)] text-[var(--text-disabled)] cursor-not-allowed border border-[var(--border)]"
                : isRecording
                ? "bg-[var(--error)] text-white hover:opacity-95"
                : "bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] font-semibold"
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : isRecording ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop & Paste</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Dictate</span>
              </>
            )}
          </button>

          {/* Settings Icon Button */}
          <button
            type="button"
            onClick={() => onNavigate("settings")}
            className="p-1.5 rounded-[6px] bg-[var(--surface-primary)] hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors cursor-pointer"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. HERO SPLIT: DICTATION CARD & FORGE WORDS STATS CARD (Balanced 50/50 Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT: DICTATION CARD */}
        <div className="forge-card p-4 sm:p-5 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--border)] flex flex-col justify-between space-y-3 min-h-[160px]">
          {/* Card Top: Section Title & Live Transcription Metadata */}
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-[var(--accent)] font-semibold uppercase tracking-widest block">
              DICTATION
            </span>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)] font-sans">
                <span className="flex items-center gap-1.5 text-[var(--accent)] font-medium">
                  <span className={`w-2 h-2 rounded-full bg-[var(--accent)] ${isRecording ? "animate-pulse" : ""}`} />
                  LIVE TRANSCRIPTION
                </span>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="text-[var(--text-muted)] font-mono">
                  {isRecording
                    ? `${durationSecs.toFixed(1)}s duration`
                    : history[0]
                    ? `${((history[0].duration_ms || 0) / 1000).toFixed(1)}s duration`
                    : "0.0s duration"}
                </span>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="text-[var(--text-muted)] font-mono">{metrics.wpm} WPM</span>
              </div>

              {/* Action Buttons: Copy & Format Dropdown */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyLiveDictation(latestDictationText)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[12px] text-[var(--text-primary)] font-medium transition-colors cursor-pointer"
                >
                  {dictationCopied ? (
                    <>
                      <Check className="w-3 h-3 text-[var(--success)]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-[var(--text-muted)]" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                {/* Format Dropdown */}
                <div className="relative" ref={formatDropdownRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFormatDropdown(!showFormatDropdown);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[12px] text-[var(--text-primary)] font-medium transition-colors cursor-pointer"
                  >
                    <span>Format</span>
                    <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                  </button>

                  {showFormatDropdown && (
                    <div className="absolute right-0 mt-1 w-36 py-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[6px] shadow-lg z-30 font-sans text-[12px]">
                      {(["Smart", "Clean", "Structured", "Raw"] as FormattingMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => handleUpdateMode(mode)}
                          className={`w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-between ${
                            settings?.formatting_mode === mode ? "text-[var(--accent)] font-medium" : "text-[var(--text-primary)]"
                          }`}
                        >
                          <span>{mode}</span>
                          {settings?.formatting_mode === mode && <Check className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Dictation Text Body with Blinking Cursor */}
          <div className="py-2 min-h-[56px]">
            <p className="text-[14px] sm:text-[15px] font-sans font-normal text-[var(--text-primary)] leading-relaxed">
              {latestDictationText}
              <span className="inline-block w-[2px] h-[16px] bg-[var(--accent)] ml-1 translate-y-[2px] animate-pulse" />
            </p>
          </div>

          {/* Bottom Equalizer Soundwave Bar */}
          <div className="pt-2 flex items-center justify-between gap-[3px] h-[20px] w-full overflow-hidden">
            {equalizerMultipliers.map((mult, i) => {
              const minH = 3;
              const maxH = 16;
              const dynamicHeight = isRecording
                ? Math.max(minH, Math.min(maxH, Math.round(minH + (audioLevel * mult + 0.15) * (maxH - minH))))
                : minH;

              return (
                <div
                  key={i}
                  className={`w-[3px] rounded-full transition-all duration-75 ease-out ${
                    dynamicHeight > 5 ? "bg-[var(--accent)]" : "bg-[var(--accent)] opacity-35"
                  }`}
                  style={{
                    height: `${dynamicHeight}px`,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* RIGHT: FORGE WORDS STATS CARD */}
        <div className="forge-card p-4 sm:p-5 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--border)] flex flex-col justify-between space-y-3 min-h-[160px]">
          {/* Header with Title and Today Dropdown */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[var(--accent)] font-semibold uppercase tracking-widest">
              FORGE WORDS
            </span>

            <div className="relative" ref={timeframeDropdownRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTimeframeDropdown(!showTimeframeDropdown);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors cursor-pointer"
              >
                <span>{timeframe === "Today" ? "Today" : timeframe === "Week" ? "This Week" : "All Time"}</span>
                <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
              </button>

              {showTimeframeDropdown && (
                <div className="absolute right-0 mt-1 w-28 py-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[6px] shadow-lg z-30 font-sans text-[12px]">
                  {(["Today", "Week", "All"] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => {
                        setTimeframe(tf);
                        setShowTimeframeDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)] transition-colors ${
                        timeframe === tf ? "text-[var(--accent)] font-medium" : "text-[var(--text-primary)]"
                      }`}
                    >
                      {tf === "Today" ? "Today" : tf === "Week" ? "This Week" : "All Time"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3 Metric Columns with Balanced Proportions */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 my-auto py-2 text-center items-center">
            {/* Col 1: Words transcribed */}
            <div className="flex flex-col items-center space-y-1">
              <div className="text-[32px] sm:text-[36px] font-bold font-sans text-[var(--text-primary)] tracking-tight leading-none tabular-nums">
                {metrics.wordsTranscribed}
              </div>
              <div className="text-[12px] font-medium text-[var(--text-secondary)] font-sans leading-tight">
                Words<br />transcribed
              </div>
            </div>

            {/* Col 2: Time saved */}
            <div className="flex flex-col items-center space-y-1">
              <div className="flex items-baseline justify-center text-[32px] sm:text-[36px] font-bold font-sans text-[var(--text-primary)] tracking-tight leading-none tabular-nums">
                <span>{savedTime.value}</span>
                <span className="text-[18px] sm:text-[20px] font-semibold text-[var(--text-muted)] ml-0.5">
                  {savedTime.unit}
                </span>
              </div>
              <div className="text-[12px] font-medium text-[var(--text-secondary)] font-sans leading-tight">
                Time<br />saved
              </div>
            </div>

            {/* Col 3: Sessions */}
            <div className="flex flex-col items-center space-y-1">
              <div className="text-[32px] sm:text-[36px] font-bold font-sans text-[var(--text-primary)] tracking-tight leading-none tabular-nums">
                {metrics.sessionsCount}
              </div>
              <div className="text-[12px] font-medium text-[var(--text-secondary)] font-sans leading-tight">
                Sessions
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CURRENT SETUP TOOLBAR */}
      <div className="forge-card p-3.5 sm:p-4 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--border)] space-y-2">
        <span className="text-[11px] font-mono text-[var(--accent)] font-semibold uppercase tracking-widest block">
          CURRENT SETUP
        </span>

        <div className="flex flex-wrap items-center justify-between gap-4 text-[12px] font-sans">
          {/* Controls: Engine, Mode, Microphone */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {/* 1. Engine Segmented Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] font-medium">Engine</span>
              <div className="inline-flex items-center p-0.5 rounded-[6px] bg-[var(--surface-elevated)] border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => handleUpdateProvider("groq")}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] font-medium transition-all cursor-pointer ${
                    settings?.provider !== "local-whisper"
                      ? "bg-[var(--surface-primary)] border border-[var(--accent)] text-[var(--text-primary)] shadow-2xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-[var(--warning)]" />
                  <span>Groq Cloud</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateProvider("local-whisper")}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] font-medium transition-all cursor-pointer ${
                    settings?.provider === "local-whisper"
                      ? "bg-[var(--surface-primary)] border border-[var(--accent)] text-[var(--text-primary)] shadow-2xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span>Local Whisper</span>
                </button>
              </div>
            </div>

            {/* 2. Mode Dropdown (Compact Size) */}
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] font-medium">Mode</span>
              <div className="relative" ref={modeDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowModeDropdown(!showModeDropdown);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[12px] text-[var(--text-primary)] font-medium transition-colors cursor-pointer"
                >
                  <span>{settings?.formatting_mode === "Smart" ? "Smart Cleanup" : settings?.formatting_mode || "Smart Cleanup"}</span>
                  <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                </button>

                {showModeDropdown && (
                  <div className="absolute left-0 mt-1 w-36 py-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[6px] shadow-lg z-30 font-sans text-[12px]">
                    {(["Smart", "Clean", "Structured", "Raw"] as FormattingMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => handleUpdateMode(mode)}
                        className={`w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)] transition-colors ${
                          settings?.formatting_mode === mode ? "text-[var(--accent)] font-medium" : "text-[var(--text-primary)]"
                        }`}
                      >
                        {mode === "Smart" ? "Smart Cleanup" : mode}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Microphone Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] font-medium">Microphone</span>
              <div className="relative" ref={micDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMicDropdown(!showMicDropdown);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[12px] text-[var(--text-primary)] font-medium transition-colors cursor-pointer max-w-[280px]"
                >
                  <Mic className="w-3 h-3 text-[var(--accent)] shrink-0" />
                  <span className="truncate">
                    {settings?.microphone || "Default Microphone"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                </button>

                {showMicDropdown && (
                  <div className="absolute left-0 mt-1 w-64 max-h-48 overflow-y-auto py-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[6px] shadow-lg z-30 font-sans text-[12px]">
                    <button
                      onClick={() => handleSelectMicrophone(null)}
                      className={`w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)] transition-colors truncate ${
                        !settings?.microphone ? "text-[var(--accent)] font-medium" : "text-[var(--text-primary)]"
                      }`}
                    >
                      System Default Microphone
                    </button>
                    {audioDevices.map((dev) => (
                      <button
                        key={dev.name}
                        onClick={() => handleSelectMicrophone(dev.name)}
                        className={`w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)] transition-colors truncate ${
                          settings?.microphone === dev.name ? "text-[var(--accent)] font-medium" : "text-[var(--text-primary)]"
                        }`}
                      >
                        {dev.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Language Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] font-medium">Language</span>
              <div className="relative" ref={languageDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowLanguageDropdown(!showLanguageDropdown);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[12px] text-[var(--text-primary)] font-medium transition-colors cursor-pointer max-w-[200px]"
                >
                  <span className="text-[12px]">{getSelectedLanguageDisplay().flag}</span>
                  <span className="truncate">
                    {getSelectedLanguageDisplay().name}
                  </span>
                  <ChevronDown className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                </button>

                {showLanguageDropdown && (
                  <div className="absolute left-0 mt-1 w-56 max-h-52 overflow-y-auto py-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[6px] shadow-lg z-30 font-sans text-[12px]">
                    <button
                      onClick={() => handleSelectLanguage("auto")}
                      className={`w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-between ${
                        (!settings?.language || settings.language === "auto") ? "text-[var(--accent)] font-medium" : "text-[var(--text-primary)]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>🌐</span>
                        <span>Auto-Detect</span>
                      </span>
                      {(!settings?.language || settings.language === "auto") && <Check className="w-3 h-3 text-[var(--accent)]" />}
                    </button>

                    <div className="border-t border-[var(--border-subtle)] my-1" />

                    {[
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
                    ].map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleSelectLanguage(lang.code)}
                        className={`w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-between ${
                          settings?.language === lang.code ? "text-[var(--accent)] font-medium" : "text-[var(--text-primary)]"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          <span className="truncate">{lang.name}</span>
                        </span>
                        {settings?.language === lang.code && <Check className="w-3 h-3 text-[var(--accent)]" />}
                      </button>
                    ))}

                    <div className="border-t border-[var(--border-subtle)] my-1" />

                    <button
                      onClick={() => {
                        setShowLanguageDropdown(false);
                        onNavigate("settings");
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)] text-[var(--accent)] font-medium transition-colors text-[11px] flex items-center justify-between"
                    >
                      <span>More in Settings (99+)...</span>
                      <span>→</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Far Right: Segmented LED Audio VU Meter */}
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] font-medium text-[11px] uppercase tracking-wider">Level</span>
            <div className="flex items-center gap-[2px] h-3.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((step) => {
                const threshold = step / 12;
                const isActive = isRecording && audioLevel >= threshold;
                const isAmber = step >= 8;

                return (
                  <div
                    key={step}
                    className={`w-[2.5px] h-full rounded-[1px] transition-colors duration-75 ${
                      isActive
                        ? isAmber
                          ? "bg-[var(--warning)]"
                          : "bg-[var(--accent)]"
                        : "bg-[var(--border)] opacity-30"
                    }`}
                  />
                );
              })}
            </div>
            <span className="font-mono text-[12px] font-medium text-[var(--text-secondary)]">
              {isRecording ? `${Math.round(audioLevel * 100)}%` : "0%"}
            </span>
          </div>
        </div>
      </div>

      {/* 4. RECENT DICTATIONS SECTION */}
      <div className="forge-card p-4 sm:p-5 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--border)] space-y-3">
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-[var(--accent)] font-semibold uppercase tracking-widest">
            RECENT DICTATIONS
          </span>
          <button
            onClick={() => onNavigate("history")}
            className="text-[12px] font-sans text-[var(--accent)] hover:underline font-medium cursor-pointer"
          >
            View all history →
          </button>
        </div>

        {/* Dictation List Rows */}
        {history.length === 0 ? (
          <div className="p-6 text-center text-[var(--text-muted)] text-[13px] font-sans rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)]">
            No dictations recorded yet. Press {readableHotkey} and start speaking.
          </div>
        ) : (
          <div className="space-y-1.5">
            {history.map((item) => {
              const isFast = (item.duration_ms || 740) < 1000;
              const isMedium = (item.duration_ms || 740) >= 1000 && (item.duration_ms || 740) < 3000;

              return (
                <div
                  key={item.id}
                  className="px-3 py-2.5 rounded-[6px] hover:bg-[var(--surface-elevated)] transition-colors flex flex-wrap items-center justify-between gap-3 group border border-transparent hover:border-[var(--border)]"
                >
                  {/* Left: Document Icon & Transcription Text */}
                  <div className="flex items-center gap-3 flex-1 min-w-[260px]">
                    <div className="w-6 h-6 rounded-[4px] bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-[13px] sm:text-[14px] font-normal text-[var(--text-primary)] font-sans line-clamp-1 leading-normal">
                      "{item.final_text}"
                    </p>
                  </div>

                  {/* Middle & Right: Metadata & Actions */}
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap justify-end">
                    {/* Timestamp & Provider Metadata */}
                    <div className="flex items-center gap-2 text-[12px] font-sans text-[var(--text-muted)]">
                      <span>
                        {new Date(item.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span>·</span>
                      <span className="capitalize">
                        {item.provider_id === "local-whisper" ? "Local" : "Groq"}
                      </span>
                      <span>·</span>
                      {/* Latency Pill Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-[4px] font-mono text-[11px] font-medium ${
                          isFast
                            ? "bg-[rgba(16,185,129,0.12)] text-[#10b981] border border-[rgba(16,185,129,0.3)]"
                            : isMedium
                            ? "bg-[rgba(245,158,11,0.12)] text-[#f59e0b] border border-[rgba(245,158,11,0.3)]"
                            : "bg-[rgba(239,68,68,0.12)] text-[#ef4444] border border-[rgba(239,68,68,0.3)]"
                        }`}
                      >
                        <Zap className="w-2.5 h-2.5 fill-current" />
                        <span>{item.duration_ms || 740}ms</span>
                      </span>
                    </div>

                    {/* Action: Copy */}
                    <button
                      onClick={() => copyText(item.final_text, item.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] text-[12px] font-medium transition-colors cursor-pointer"
                      title="Copy to clipboard"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3 h-3 text-[var(--success)]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[var(--text-muted)]" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    {/* Action: More Menu */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === item.id ? null : item.id);
                        }}
                        className="p-1 rounded-[4px] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                        title="More options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {activeMenuId === item.id && (
                        <div className="absolute right-0 mt-1 w-32 py-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[6px] shadow-lg z-30 font-sans text-[12px]">
                          <button
                            onClick={(e) => deleteHistoryRecord(item.id, e)}
                            className="w-full text-left px-3 py-1.5 hover:bg-[var(--error-bg)] text-[var(--error)] transition-colors flex items-center gap-2"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
