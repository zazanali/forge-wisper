import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/tauri";
import { useAppStore, appStore } from "../state/appStore";
import type {
  AudioDeviceInfo,
  FormattingMode,
  HistoryRecord,
  HistoryStats,
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
  Search,
  Cpu,
} from "lucide-react";
import { formatKeyForDisplay } from "./SettingsView";
import { Card, Badge } from "../components/ui";

interface DashboardProps {
  onNavigate: (view: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const {
    settings,
    processingState: procState,
    liveTranscript,
    backendStatus,
  } = useAppStore();

  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [audioDevices, setAudioDevices] = useState<AudioDeviceInfo[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dictationCopied, setDictationCopied] = useState(false);

  const [timeframe, setTimeframe] = useState<"Today" | "Week" | "All">(() => {
    const saved = localStorage.getItem("forge_kpi_timeframe");
    if (saved === "Today" || saved === "Week" || saved === "All") return saved;
    return "Today";
  });
  const [timeframeStats, setTimeframeStats] = useState<HistoryStats | null>(null);

  const [showTopLanguageDropdown, setShowTopLanguageDropdown] = useState(false);
  const [topLanguageSearch, setTopLanguageSearch] = useState("");
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showMicDropdown, setShowMicDropdown] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Audio level and live timer
  const [audioLevel, setAudioLevel] = useState(0.25);
  const [durationSecs, setDurationSecs] = useState(0);

  const topLanguageDropdownRef = useRef<HTMLDivElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const micDropdownRef = useRef<HTMLDivElement>(null);

  const isRecording = procState === "Listening";
  const isProcessing = [
    "Stopping",
    "Transcribing",
    "Cleaning",
    "Structuring",
    "Verifying",
    "Inserting",
  ].includes(procState);

  // Load initial data and devices
  useEffect(() => {
    loadRecentHistory();
    loadAudioDevices();
    fetchTimeframeStats(timeframe);

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        topLanguageDropdownRef.current &&
        !topLanguageDropdownRef.current.contains(e.target as Node)
      ) {
        setShowTopLanguageDropdown(false);
      }
      if (
        modeDropdownRef.current &&
        !modeDropdownRef.current.contains(e.target as Node)
      ) {
        setShowModeDropdown(false);
      }
      if (
        micDropdownRef.current &&
        !micDropdownRef.current.contains(e.target as Node)
      ) {
        setShowMicDropdown(false);
      }
      setActiveMenuId(null);
    };

    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // When state changes to Success or Idle, refresh recent history & stats
  useEffect(() => {
    if (procState === "Success" || procState === "Idle") {
      loadRecentHistory();
      fetchTimeframeStats(timeframe);
    }
  }, [procState]);

  // Recalculate stats when timeframe changes
  useEffect(() => {
    fetchTimeframeStats(timeframe);
    localStorage.setItem("forge_kpi_timeframe", timeframe);
  }, [timeframe]);

  const fetchTimeframeStats = async (tf: "Today" | "Week" | "All") => {
    let since: string | undefined;
    const now = new Date();
    if (tf === "Today") {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (tf === "Week") {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
    try {
      const stats = await api.getHistoryStats(since);
      setTimeframeStats(stats);
    } catch (e) {
      console.error("Failed to load timeframe stats:", e);
    }
  };

  const loadRecentHistory = async () => {
    try {
      const page = await api.getHistoryPage(5, 0);
      setHistory(page.records);
    } catch (e) {
      console.error("Error loading recent history:", e);
    }
  };

  const loadAudioDevices = async () => {
    try {
      const devices = await api.getAudioDevices();
      setAudioDevices(devices || []);
    } catch (e) {
      console.error("Audio devices fetch warning:", e);
    }
  };

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
        await api.stopRecording();
      } else {
        await api.startRecording();
      }
    } catch (err) {
      console.error("Recording toggle error:", err);
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
      loadRecentHistory();
      fetchTimeframeStats(timeframe);
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  const handleUpdateMode = (mode: FormattingMode) => {
    appStore.patchSettings({ formatting_mode: mode });
    setShowModeDropdown(false);
  };

  const handleUpdateProvider = (provider: string) => {
    if (!settings) return;
    const defaultModel =
      provider === "local-whisper"
        ? (settings.model.startsWith("whisper-") ? "base" : settings.model)
        : (settings.model === "base" || settings.model === "tiny" ? "whisper-large-v3-turbo" : settings.model);

    appStore.patchSettings({ provider, model: defaultModel });
  };

  const handleSelectMicrophone = (micName: string | null) => {
    appStore.patchSettings({ microphone: micName });
    setShowMicDropdown(false);
  };

  const handleSelectLanguage = (code: string) => {
    appStore.patchSettings({ language: code });
    setShowTopLanguageDropdown(false);
    setTopLanguageSearch("");
  };

  const getSelectedLanguageDisplay = () => {
    const code = settings?.language || "auto";
    if (code === "auto") {
      return { flag: "🌐", name: "Auto-Detect", code: "auto" };
    }
    const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    if (!found) {
      return { flag: "🌐", name: code.toUpperCase(), code };
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
    if (clean === "parakeet-v3-int8") return "parakeet-v3";
    return clean;
  };

  const readableHotkey = (settings?.hotkey || "Control+Space")
    .split("+")
    .map(formatKeyForDisplay)
    .join(" + ");

  // Latest dictation sample text or live buffer
  const latestDictationText =
    (isRecording || isProcessing) && liveTranscript?.text
      ? liveTranscript.text
      : history[0]?.final_text ||
        (isRecording
          ? "Listening to speech & typing in real-time..."
          : `Ready to dictate. Press ${readableHotkey} to speak.`);

  // Calculate metrics from database aggregates
  const totalWords = timeframeStats?.total_words ?? 0;
  const totalDurationMs = timeframeStats?.total_duration_ms ?? 0;
  const sessionsCount = timeframeStats?.total_records ?? 0;

  const totalAudioMinutes = totalDurationMs / 1000 / 60;
  let effectiveWpm = 0;
  if (totalAudioMinutes > 0.02 && totalWords > 0) {
    const calculated = Math.round(totalWords / totalAudioMinutes);
    effectiveWpm = Math.min(260, Math.max(70, calculated));
  } else if (totalWords > 0) {
    effectiveWpm = 145;
  }

  const savedMinutes = Math.max(totalWords > 0 ? 1 : 0, Math.round(totalWords * 0.02));
  const savedTime = {
    value: totalWords === 0 ? "0" : savedMinutes >= 60 ? (savedMinutes / 60).toFixed(1) : String(savedMinutes),
    unit: savedMinutes >= 60 ? "h" : "m",
  };

  // Equalizer bars for balanced card width
  const equalizerMultipliers = [
    0.15, 0.25, 0.35, 0.5, 0.65, 0.8, 0.95, 1.0,
    0.9, 0.75, 0.6, 0.5, 0.45, 0.6, 0.8, 1.0,
    0.9, 0.75, 0.6, 0.45, 0.35, 0.5, 0.7, 0.85,
    0.7, 0.5, 0.35, 0.2,
  ];

  return (
    <div className="space-y-4 animate-fadeIn font-sans max-w-[1240px] mx-auto select-none">
      {/* 1. TOP ACTION BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-[13px] font-sans">
        {/* Left Side: Status & Active Engine Pill */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap min-w-0">
          {/* Status Indicator Badge */}
          <Badge variant={isRecording ? "accent" : "default"} size="md" hasDot className="shrink-0">
            {isRecording ? `Recording (${formatTime(durationSecs)})` : "Ready"}
          </Badge>

          {/* Engine Pill */}
          <button
            type="button"
            onClick={() => onNavigate(settings?.provider === "local-whisper" ? "models" : "settings")}
            title="Active Speech Engine & Model (Click to configure)"
            className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-[var(--radius-control)] bg-[var(--surface-primary)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] text-[12px] sm:text-[13px] cursor-pointer transition-colors max-w-[200px] sm:max-w-none"
          >
            <Zap className="w-3.5 h-3.5 text-[var(--warning)] shrink-0" />
            <span className="font-medium text-[var(--text-primary)] truncate">
              {settings?.provider === "local-whisper" ? "Local Whisper" : "Groq Cloud"}
            </span>
            <span className="px-1.5 py-0.5 rounded-[4px] bg-[var(--surface-elevated)] text-[10px] sm:text-[11px] font-mono text-[var(--text-muted)] border border-[var(--border)] shrink-0">
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
                setTopLanguageSearch("");
              }}
              title="Active Speech Recognition Language"
              className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-[var(--radius-control)] border text-[12px] sm:text-[13px] cursor-pointer transition-all max-w-[170px] sm:max-w-none ${
                showTopLanguageDropdown
                  ? "bg-[var(--surface-elevated)] border-[var(--accent)] ring-1 ring-[var(--accent)]"
                  : "bg-[var(--surface-primary)] hover:bg-[var(--surface-elevated)] border-[var(--border)]"
              }`}
            >
              <span className="text-[13px] leading-none shrink-0">{getSelectedLanguageDisplay().flag}</span>
              <span className="font-medium text-[var(--text-primary)] truncate">
                {getSelectedLanguageDisplay().name}
              </span>
              {(!settings?.language || settings.language === "auto") ? (
                <span className="px-1.5 py-0.5 rounded-[4px] bg-[var(--surface-elevated)] text-[10px] sm:text-[11px] font-mono text-[var(--text-muted)] border border-[var(--border)] shrink-0">
                  Auto
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-[4px] bg-[var(--accent-subtle)] text-[10px] sm:text-[11px] font-mono text-[var(--accent)] border border-[var(--accent-border)] font-semibold uppercase shrink-0">
                  {settings.language}
                </span>
              )}
              <ChevronDown
                className={`w-3 h-3 text-[var(--text-muted)] shrink-0 transition-transform ${
                  showTopLanguageDropdown ? "rotate-180" : ""
                }`}
              />
            </button>

            {showTopLanguageDropdown && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 mt-1.5 w-72 max-w-[calc(100vw-2.5rem)] py-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-card)] shadow-2xl z-40 font-sans text-[12px] animate-fadeIn"
              >
                {/* Search Bar */}
                <div className="px-2.5 pb-2 border-b border-[var(--border-subtle)]">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={topLanguageSearch}
                      onChange={(e) => setTopLanguageSearch(e.target.value)}
                      placeholder="Search language or country..."
                      className="w-full pl-8 pr-2.5 py-1.5 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[var(--radius-control)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto custom-scrollbar py-1">
                  {!topLanguageSearch.trim() && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSelectLanguage("auto")}
                        className={`w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-between cursor-pointer ${
                          (!settings?.language || settings.language === "auto")
                            ? "bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold"
                            : "text-[var(--text-primary)]"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-[14px]">🌐</span>
                          <span>Auto-Detect Language</span>
                        </span>
                        {(!settings?.language || settings.language === "auto") && (
                          <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
                        )}
                      </button>

                      <div className="border-t border-[var(--border-subtle)] my-1" />

                      <div className="px-3 py-1 text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                        Recommended & Popular
                      </div>
                    </>
                  )}

                  {SUPPORTED_LANGUAGES.filter((lang) => {
                    if (lang.code === "auto" && !topLanguageSearch.trim()) return false;
                    const q = topLanguageSearch.toLowerCase().trim();
                    if (!q) {
                      return [
                        "en",
                        "es",
                        "ur",
                        "hi",
                        "ar",
                        "fr",
                        "de",
                        "zh",
                        "ja",
                        "pt",
                        "ru",
                        "it",
                      ].includes(lang.code);
                    }
                    return (
                      lang.name.toLowerCase().includes(q) ||
                      (lang.nativeName && lang.nativeName.toLowerCase().includes(q)) ||
                      lang.code.toLowerCase().includes(q)
                    );
                  }).map((lang) => {
                    const isSelected = settings?.language === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleSelectLanguage(lang.code)}
                        className={`w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold"
                            : "text-[var(--text-primary)]"
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className="text-[13px]">{lang.flag}</span>
                          <span className="truncate">{lang.name}</span>
                          {lang.nativeName && lang.nativeName !== lang.name && (
                            <span className="text-[11px] text-[var(--text-muted)] font-normal truncate">
                              ({lang.nativeName})
                            </span>
                          )}
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-[var(--border-subtle)] pt-1 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTopLanguageDropdown(false);
                      onNavigate("settings");
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-[4px] hover:bg-[var(--surface-hover)] text-[var(--accent)] font-medium transition-colors flex items-center justify-between text-[11px] cursor-pointer"
                  >
                    <span>All 99+ Languages in Settings</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Keycaps, Dictate Button & Settings */}
        <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto justify-between sm:justify-end shrink-0">
          {/* Shortcut Keycaps */}
          <div
            onClick={() => onNavigate("settings")}
            title="Configured Global Hotkey (Click to change in Settings)"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-control)] bg-[var(--surface-primary)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] text-[12px] font-mono text-[var(--text-muted)] cursor-pointer transition-colors"
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
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-[var(--radius-control)] font-medium text-[13px] transition-all duration-150 select-none cursor-pointer shadow-xs flex-1 sm:flex-initial min-w-[105px] ${
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
            className="p-1.5 rounded-[var(--radius-control)] bg-[var(--surface-primary)] hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors cursor-pointer shrink-0"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. BENTO HERO GRID: DICTATION CARD (7 cols) + FORGE WORDS KPI CARD (5 cols) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
        {/* LEFT: DICTATION CARD (Bento 7 cols) */}
        <Card
          variant="default"
          padding="md"
          className="md:col-span-7 flex flex-col justify-between space-y-3 min-h-[175px] w-full"
        >
          {/* Card Top: Section Title & Live Transcription Metadata */}
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-[var(--accent)] font-semibold uppercase tracking-widest block">
              DICTATION
            </span>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)] font-sans flex-wrap">
                <span className="flex items-center gap-1.5 text-[var(--accent)] font-medium">
                  <span
                    className={`w-2 h-2 rounded-full bg-[var(--accent)] ${
                      isRecording ? "animate-pulse" : ""
                    }`}
                  />
                  LIVE TRANSCRIPTION
                </span>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="text-[var(--text-muted)] font-mono">
                  {isRecording
                    ? `${durationSecs.toFixed(1)}s duration`
                    : history[0]
                    ? `${(
                        (history[0].duration_ms && history[0].duration_ms > 400
                          ? history[0].duration_ms
                          : Math.max(
                              1200,
                              (history[0].final_text || "").split(/\s+/).filter(Boolean).length *
                                400
                            )) / 1000
                       ).toFixed(1)}s duration`
                    : "0.0s duration"}
                </span>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="text-[var(--text-muted)] font-mono">{effectiveWpm} WPM</span>
              </div>

              {/* Action Buttons: Copy */}
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
              </div>
            </div>
          </div>

          {/* Dictation Text Body Wrapped in an Ergonomically Bounded Scroll Area */}
          <div className="py-1 min-h-[56px] max-h-48 overflow-y-auto custom-scrollbar pr-1">
            <p className="text-[14px] sm:text-[15px] font-sans font-normal text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-words">
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
                ? Math.max(
                    minH,
                    Math.min(maxH, Math.round(minH + (audioLevel * mult + 0.15) * (maxH - minH)))
                  )
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
        </Card>

        {/* RIGHT: FORGE WORDS STATS CARD (Bento 5 cols, Balanced Across All Screen Widths) */}
        <Card
          variant="default"
          padding="md"
          className="md:col-span-5 w-full flex flex-col justify-between space-y-3 min-h-[175px]"
        >
          {/* Header with Title and Timeframe Selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-[var(--accent)] font-semibold uppercase tracking-widest">
                FORGE WORDS
              </span>
              {timeframe === "Today" && sessionsCount === 0 && (
                <button
                  type="button"
                  onClick={() => setTimeframe("All")}
                  className="text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer transition-colors"
                  title="Click to view all-time database metrics"
                >
                  · <span className="underline">View All Time</span>
                </button>
              )}
            </div>

            {/* Segmented Timeframe Switcher */}
            <div className="inline-flex items-center p-0.5 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] border border-[var(--border)] text-[11px] font-medium">
              {(["Today", "Week", "All"] as const).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-0.5 rounded-[4px] transition-colors cursor-pointer ${
                    timeframe === tf
                      ? "bg-[var(--surface-primary)] text-[var(--accent)] font-semibold shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {tf === "Today" ? "Today" : tf === "Week" ? "Week" : "All"}
                </button>
              ))}
            </div>
          </div>

          {/* 3 Metric Columns with Balanced Proportions & Responsive Typography */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 my-auto py-2 text-center items-center">
            {/* Col 1: Words transcribed */}
            <div className="flex flex-col items-center space-y-1 min-w-0">
              <div className="text-[22px] sm:text-[28px] md:text-[30px] lg:text-[34px] font-bold font-sans text-[var(--text-primary)] tracking-tight leading-none tabular-nums truncate max-w-full">
                {totalWords.toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-[11px] md:text-[12px] font-medium text-[var(--text-secondary)] font-sans leading-tight text-center">
                Words<br />transcribed
              </div>
            </div>

            {/* Col 2: Time saved */}
            <div className="flex flex-col items-center space-y-1 min-w-0">
              <div className="flex items-baseline justify-center text-[22px] sm:text-[28px] md:text-[30px] lg:text-[34px] font-bold font-sans text-[var(--text-primary)] tracking-tight leading-none tabular-nums truncate max-w-full">
                <span>{savedTime.value}</span>
                <span className="text-[13px] sm:text-[16px] md:text-[18px] font-semibold text-[var(--text-muted)] ml-0.5">
                  {savedTime.unit}
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] md:text-[12px] font-medium text-[var(--text-secondary)] font-sans leading-tight text-center">
                Time<br />saved
              </div>
            </div>

            {/* Col 3: Sessions */}
            <div className="flex flex-col items-center space-y-1 min-w-0">
              <div className="text-[22px] sm:text-[28px] md:text-[30px] lg:text-[34px] font-bold font-sans text-[var(--text-primary)] tracking-tight leading-none tabular-nums truncate max-w-full">
                {sessionsCount.toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-[11px] md:text-[12px] font-medium text-[var(--text-secondary)] font-sans leading-tight text-center">
                Sessions<br />logged
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 3. CURRENT SETUP BENTO TOOLBAR */}
      <Card variant="default" padding="sm" className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] font-mono text-[var(--accent)] font-semibold uppercase tracking-widest block">
            CURRENT SETUP & HARDWARE
          </span>
          {settings?.provider === "local-whisper" ? (
            backendStatus?.is_vulkan_available ? (
              <Badge variant="accent" size="sm" hasDot>
                Vulkan GPU {backendStatus.active_device_name ? `(${backendStatus.active_device_name})` : "Active"}
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                CPU Mode
              </Badge>
            )
          ) : (
            <Badge variant="accent" size="sm" hasDot>
              Groq Cloud LPU
            </Badge>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-[12px] font-sans">
          {/* Controls: Engine, Mode, Microphone */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 flex-1">
            {/* 1. Engine Segmented Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] font-medium shrink-0">Engine</span>
              <div className="inline-flex items-center p-0.5 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => handleUpdateProvider("groq")}
                  className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-[4px] font-medium transition-all cursor-pointer text-[11px] sm:text-[12px] ${
                    settings?.provider !== "local-whisper"
                      ? "bg-[var(--surface-primary)] border border-[var(--accent)] text-[var(--text-primary)] shadow-2xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-[var(--warning)] shrink-0" />
                  <span>Groq Cloud</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateProvider("local-whisper")}
                  className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-[4px] font-medium transition-all cursor-pointer text-[11px] sm:text-[12px] ${
                    settings?.provider === "local-whisper"
                      ? "bg-[var(--surface-primary)] border border-[var(--accent)] text-[var(--text-primary)] shadow-2xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                  <span>Local Whisper</span>
                </button>
              </div>
            </div>

            {/* 2. Mode Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] font-medium shrink-0">Mode</span>
              <div className="relative" ref={modeDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowModeDropdown(!showModeDropdown);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[12px] text-[var(--text-primary)] font-medium transition-colors cursor-pointer"
                >
                  <span>
                    {settings?.formatting_mode === "Smart"
                      ? "Smart Cleanup"
                      : settings?.formatting_mode || "Smart Cleanup"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                </button>

                {showModeDropdown && (
                  <div className="absolute left-0 mt-1 w-36 py-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-card)] shadow-lg z-30 font-sans text-[12px]">
                    {(["Smart", "Clean", "Structured", "Raw"] as FormattingMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => handleUpdateMode(mode)}
                        className={`w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)] transition-colors ${
                          settings?.formatting_mode === mode
                            ? "text-[var(--accent)] font-medium"
                            : "text-[var(--text-primary)]"
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
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[var(--text-muted)] font-medium shrink-0">Mic</span>
              <div className="relative min-w-0" ref={micDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !showMicDropdown;
                    setShowMicDropdown(next);
                    if (next) {
                      loadAudioDevices();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[12px] text-[var(--text-primary)] font-medium transition-colors cursor-pointer max-w-[200px] sm:max-w-[260px]"
                >
                  <Mic className="w-3 h-3 text-[var(--accent)] shrink-0" />
                  <span className="truncate">
                    {settings?.microphone || "Default Microphone"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                </button>

                {showMicDropdown && (
                  <div className="absolute left-0 mt-1 w-64 max-h-48 overflow-y-auto py-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-card)] shadow-lg z-30 font-sans text-[12px]">
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
                          settings?.microphone === dev.name
                            ? "text-[var(--accent)] font-medium"
                            : "text-[var(--text-primary)]"
                        }`}
                      >
                        {dev.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Far Right: Segmented LED Audio VU Meter */}
          <div className="flex items-center justify-between lg:justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--border-subtle)] shrink-0">
            <span className="text-[var(--text-muted)] font-medium text-[11px] uppercase tracking-wider">
              Level
            </span>
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
            <span className="font-mono text-[12px] font-medium text-[var(--text-secondary)] min-w-[32px] text-right">
              {isRecording ? `${Math.round(audioLevel * 100)}%` : "0%"}
            </span>
          </div>
        </div>
      </Card>

      {/* 4. RECENT DICTATIONS BENTO SECTION */}
      <Card variant="default" padding="md" className="space-y-3">
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
          <div className="p-6 text-center text-[var(--text-muted)] text-[13px] font-sans rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-elevated)]">
            No dictations recorded yet. Press {readableHotkey} and start speaking.
          </div>
        ) : (
          <div className="space-y-1.5">
            {history.map((item) => {
              const isFast = (item.duration_ms || 740) < 1000;
              const isMedium =
                (item.duration_ms || 740) >= 1000 && (item.duration_ms || 740) < 3000;

              return (
                <div
                  key={item.id}
                  className="px-3 py-2.5 rounded-[var(--radius-control)] hover:bg-[var(--surface-elevated)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 group border border-transparent hover:border-[var(--border)]"
                >
                  {/* Left: Document Icon & Transcription Text */}
                  <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                    <div className="w-6 h-6 rounded-[4px] bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-[13px] sm:text-[14px] font-normal text-[var(--text-primary)] font-sans truncate leading-normal">
                      "{item.final_text}"
                    </p>
                  </div>

                  {/* Middle & Right: Metadata & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 w-full sm:w-auto flex-wrap">
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
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] font-mono text-[11px] font-medium ${
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
                        <div className="absolute right-0 mt-1 w-32 py-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[var(--radius-control)] shadow-lg z-30 font-sans text-[12px]">
                          <button
                            onClick={(e) => deleteHistoryRecord(item.id, e)}
                            className="w-full text-left px-3 py-1.5 hover:bg-[var(--error-bg)] text-[var(--error)] transition-colors flex items-center gap-2 cursor-pointer"
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
      </Card>
    </div>
  );
};
