import React, { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import type { AppSettings, HistoryRecord, ProcessingState } from "../types";
import { ForgeLogo } from "../components/ForgeLogo";
import {
  Mic,
  Square,
  Sparkles,
  Cpu,
  Zap,
  Copy,
  Check,
  Clock,
  Settings as SettingsIcon,
} from "lucide-react";

interface DashboardProps {
  onNavigate: (tab: "dashboard" | "history" | "models" | "dictionary" | "settings") => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [procState, setProcState] = useState<ProcessingState>("Idle");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const unlisten = api.onStateChange(({ state }) => {
      setProcState(state);
      if (state === "Success" || state === "Idle") {
        loadData();
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const loadData = async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
      const h = await api.listHistory(5);
      setHistory(h);
      const st = await api.getProcessingState();
      setProcState(st);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleRecording = async () => {
    if (procState === "Listening") {
      await api.stopRecording();
    } else {
      await api.startRecording();
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const [audioLevel, setAudioLevel] = useState(0);
  const [durationSecs, setDurationSecs] = useState(0);

  // Duration timer
  useEffect(() => {
    if (procState !== "Listening") {
      setDurationSecs(0);
      return;
    }
    const interval = setInterval(() => setDurationSecs((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [procState]);

  // Audio level polling
  useEffect(() => {
    if (procState !== "Listening") {
      setAudioLevel(0);
      return;
    }
    const interval = setInterval(async () => {
      try {
        const rms = await api.getMicLevel();
        setAudioLevel(Math.min(1.0, rms * 5.0));
      } catch {
        // ignore
      }
    }, 70);
    return () => clearInterval(interval);
  }, [procState]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const isRecording = procState === "Listening";

  return (
    <div className="space-y-6 animate-fadeIn font-sans">

      {/* Main Ready to Dictate Hero Card */}
      <div
        className={`forge-card p-6 bg-[var(--panel)] relative overflow-hidden border rounded-2xl transition-all duration-300 ${
          isRecording
            ? "border-[#FF4D5E] shadow-xl shadow-[#FF4D5E]/15"
            : "border-[var(--border)]"
        }`}
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#FF4D5E]/8 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-2.5 text-center sm:text-left flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF4D5E]/12 border border-[#FF4D5E]/25 text-xs font-mono text-[#FF4D5E]">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRecording ? "bg-[#FF4D5E] animate-ping" : "bg-[#FF4D5E] animate-pulse"
                }`}
              />
              HOTKEY: {(settings?.hotkey || "Control+Space").replace("Control", "Ctrl").replace("+", " + ")}
            </div>
            <h2 className="text-2xl font-display font-bold text-[var(--text-1)] tracking-tight flex items-center justify-center sm:justify-start gap-3">
              <ForgeLogo size={28} glow={false} />
              <span>{isRecording ? "Recording Speech..." : "Ready to Dictate"}</span>
              {isRecording && (
                <span className="text-sm font-mono text-[#FF4D5E] font-bold px-2 py-0.5 rounded-lg bg-[#FF4D5E]/15 border border-[#FF4D5E]/30">
                  {formatTime(durationSecs)}
                </span>
              )}
            </h2>
            <p className="text-sm text-[var(--text-2)] max-w-xl">
              {settings?.is_toggle_mode
                ? `Press ${(settings?.hotkey || "Control+Space").replace("Control", "Ctrl").replace("+", " + ")} to start dictation, speak, and press again to paste.`
                : `Hold ${(settings?.hotkey || "Control+Space").replace("Control", "Ctrl").replace("+", " + ")} in any active window, speak naturally, and release.`}
            </p>

            {/* Live Audio Reactive Visualizer */}
            {isRecording && (
              <div className="flex items-center justify-center sm:justify-start gap-1.5 pt-2">
                <span className="text-xs text-[var(--text-2)]">Input:</span>
                {[0.4, 0.8, 1.0, 0.7, 0.9, 0.5, 0.3].map((mult, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-gradient-to-t from-[#FF4D5E] to-[#FBBF24] rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(
                        6,
                        Math.min(24, Math.round((audioLevel * mult + 0.2) * 24))
                      )}px`,
                    }}
                  />
                ))}
                <span className="text-[11px] text-teal-600 dark:text-[#3FE3C4] font-mono ml-2">
                  Live Waveform
                </span>
              </div>
            )}
          </div>

          <button
            onClick={toggleRecording}
            className={`w-full sm:w-auto flex items-center justify-center gap-3 px-7 py-4 rounded-xl font-semibold transition-all duration-200 shadow-xl shrink-0 ${
              isRecording
                ? "bg-[#E8404F] hover:bg-[#FF4D5E] text-white animate-pulse shadow-lg shadow-[#FF4D5E]/30"
                : "btn-blade text-white"
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-5 h-5 fill-current" />
                <span>Stop & Paste</span>
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                <span>Start Dictation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Engine & Configuration Quick Overview (Always in 1 Clean Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Active Engine */}
        <div className="forge-card p-3.5 flex items-start gap-3 bg-[var(--panel)] border border-[var(--border)] rounded-xl">
          <div className="p-2 rounded-xl bg-[var(--raised)] text-[#FF4D5E] shrink-0">
            {settings?.provider === "local-whisper" ? (
              <Cpu className="w-4 h-4 text-teal-600 dark:text-[#3FE3C4]" />
            ) : (
              <Zap className="w-4 h-4 text-amber-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-mono">Active Engine</div>
            <div className="text-xs font-semibold text-[var(--text-1)] capitalize truncate mt-0.5">
              {settings?.provider === "local-whisper" ? "Local Whisper" : "Groq Whisper"}
            </div>
            <div className="text-[11px] text-[var(--text-2)] truncate mt-0.5 font-mono">
              Model: {settings?.model}
            </div>
          </div>
        </div>

        {/* Formatting Mode */}
        <div className="forge-card p-3.5 flex items-start gap-3 bg-[var(--panel)] border border-[var(--border)] rounded-xl">
          <div className="p-2 rounded-xl bg-[var(--raised)] text-teal-600 dark:text-[#3FE3C4] shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-mono">Formatting Mode</div>
            <div className="text-xs font-semibold text-[var(--text-1)] capitalize truncate mt-0.5">
              {settings?.formatting_mode} Mode
            </div>
            <div className="text-[11px] text-[var(--text-2)] truncate mt-0.5">
              Rule-based cleanup active
            </div>
          </div>
        </div>

        {/* Microphone */}
        <div className="forge-card p-3.5 flex items-start gap-3 bg-[var(--panel)] border border-[var(--border)] rounded-xl">
          <div className="p-2 rounded-xl bg-[var(--raised)] text-[#FF4D5E] shrink-0">
            <Mic className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-mono">Input Device</div>
            <div className="text-xs font-semibold text-[var(--text-1)] truncate mt-0.5">
              {settings?.microphone || "System Default"}
            </div>
            <button
              onClick={() => onNavigate("settings")}
              className="text-[11px] text-[#FF4D5E] hover:underline mt-0.5 inline-flex items-center gap-1 font-medium"
            >
              <SettingsIcon className="w-3 h-3" /> Change in Settings
            </button>
          </div>
        </div>
      </div>

      {/* Wispr Flow Voice Commands Guide Card */}
      <div className="forge-card p-5 bg-[var(--panel)] border border-[var(--border)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#FF4D5E]" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-1)] font-display">
              Wispr Flow Verbal Commands & Formatting
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold text-teal-600 dark:text-[#3FE3C4] bg-teal-500/10 px-2 py-0.5 rounded-lg border border-teal-500/20">
            Active in Smart & Structured Modes
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-[var(--raised)] border border-[var(--border)] space-y-1">
            <div className="font-semibold text-[#FF4D5E]">Paragraphs & Lines</div>
            <div className="text-[var(--text-2)] font-mono text-[11px]">&quot;new paragraph&quot; → ↵↵</div>
            <div className="text-[var(--text-2)] font-mono text-[11px]">&quot;new line&quot; → ↵</div>
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--raised)] border border-[var(--border)] space-y-1">
            <div className="font-semibold text-amber-600 dark:text-amber-400">Self-Corrections</div>
            <div className="text-[var(--text-2)] font-mono text-[11px]">&quot;Tuesday, actually Thursday&quot;</div>
            <div className="text-[var(--text-2)] font-mono text-[11px]">&quot;scratch that...&quot;</div>
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--raised)] border border-[var(--border)] space-y-1">
            <div className="font-semibold text-teal-600 dark:text-[#3FE3C4]">Lists & Bullets</div>
            <div className="text-[var(--text-2)] font-mono text-[11px]">&quot;bullet point ...&quot; → •</div>
            <div className="text-[var(--text-2)] font-mono text-[11px]">&quot;checkbox ...&quot; → ☐</div>
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--raised)] border border-[var(--border)] space-y-1">
            <div className="font-semibold text-blue-600 dark:text-cyan-400">Headings & Steps</div>
            <div className="text-[var(--text-2)] font-mono text-[11px]">&quot;Title: / Heading:&quot; → ###</div>
            <div className="text-[var(--text-2)] font-mono text-[11px]">&quot;first ..., then ..., finally&quot;</div>
          </div>
        </div>
      </div>

      {/* Recent Dictations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-display font-semibold text-[var(--text-1)]">
            Recent Dictation
          </h3>
          <button
            onClick={() => onNavigate("history")}
            className="text-xs text-[#FF4D5E] hover:underline font-semibold"
          >
            View all history →
          </button>
        </div>

        {history.length === 0 ? (
          <div className="forge-card p-8 text-center text-[var(--text-3)] text-sm rounded-xl border border-[var(--border)] bg-[var(--panel)]">
            No dictations recorded yet. Press the hotkey and start speaking!
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="forge-card p-4 flex items-start justify-between gap-4 group transition-all bg-[var(--panel)] border border-[var(--border)] hover:border-[#FF4D5E]/30"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-1)] line-clamp-2">
                    {item.final_text}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-2)] font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[var(--text-3)]" />
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>•</span>
                    <span className="capitalize">{item.provider_id}</span>
                    <span>•</span>
                    <span>{item.duration_ms}ms</span>
                    <span>•</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        item.verification_status === "Pass"
                          ? "bg-teal-500/15 text-teal-700 dark:text-[#3FE3C4] border border-teal-500/30"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {item.verification_status}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => copyText(item.final_text, item.id)}
                  className="p-2 rounded-lg bg-[var(--raised)] hover:bg-[var(--raised-hover)] text-[var(--text-2)] hover:text-[var(--text-1)] border border-[var(--border)] transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedId === item.id ? (
                    <Check className="w-4 h-4 text-teal-600 dark:text-[#3FE3C4]" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
