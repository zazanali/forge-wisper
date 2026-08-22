import React, { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import type { AppSettings, HistoryRecord, ProcessingState } from "../types";
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
  onNavigate: (tab: "dashboard" | "history" | "models" | "settings") => void;
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
    <div className="space-y-6 animate-fadeIn">
      {/* Mock Engine Notice */}
      {settings?.provider === "mock" && (
        <div className="p-3.5 bg-amber-950/40 border border-amber-500/30 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Currently using Mock Engine:</strong> Transcribing with pre-set sample text. Switch to <strong>Groq Whisper</strong> or <strong>Local Whisper</strong> to transcribe your real voice.
            </span>
          </div>
          <button
            onClick={() => onNavigate("settings")}
            className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-medium transition-colors shrink-0"
          >
            Configure Engine →
          </button>
        </div>
      )}

      {/* Main Ready to Dictate Hero Card */}
      <div className={`forge-card p-6 bg-gradient-to-b from-[#1C1B1B] to-[#141414] relative overflow-hidden border transition-all duration-300 ${
        isRecording ? "border-red-500/50 shadow-lg shadow-red-500/10" : "border-white/10"
      }`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-forge-strong/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forge-strong/10 border border-forge-strong/20 text-xs font-mono text-forge-accent">
              <span className={`w-2 h-2 rounded-full ${isRecording ? "bg-red-500 animate-ping" : "bg-forge-strong animate-pulse"}`} />
              HOTKEY: {settings?.hotkey || "Control+Space"}
            </div>
            <h2 className="text-2xl font-display font-bold text-forge-text tracking-tight flex items-center gap-3">
              {isRecording ? "Recording Speech..." : "Ready to Dictate"}
              {isRecording && (
                <span className="text-sm font-mono text-red-400 font-bold px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                  {formatTime(durationSecs)}
                </span>
              )}
            </h2>
            <p className="text-sm text-forge-muted max-w-md">
              {settings?.is_toggle_mode
                ? `Press ${settings.hotkey} to start dictation, speak, and press again to paste.`
                : `Hold ${settings?.hotkey || "Ctrl+Space"} in any active window, speak naturally, and release.`}
            </p>

            {/* Live Audio Reactive Visualizer */}
            {isRecording && (
              <div className="flex items-center gap-1.5 pt-2">
                <span className="text-xs text-forge-muted">Input:</span>
                {[0.4, 0.8, 1.0, 0.7, 0.9, 0.5, 0.3].map((mult, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-gradient-to-t from-red-500 to-amber-400 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(6, Math.min(24, Math.round((audioLevel * mult + 0.2) * 24)))}px`,
                    }}
                  />
                ))}
                <span className="text-[11px] text-emerald-400 font-mono ml-2">Live Waveform</span>
              </div>
            )}
          </div>

          <button
            onClick={toggleRecording}
            className={`flex items-center gap-3 px-7 py-4 rounded-xl font-medium transition-all duration-200 shadow-xl ${
              isRecording
                ? "bg-red-600 hover:bg-red-500 text-white animate-pulse shadow-red-600/30"
                : "bg-forge-strong hover:bg-forge-strong/90 text-white shadow-glow"
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-5 h-5 fill-current" />
                <span className="font-semibold">Stop & Paste</span>
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                <span className="font-semibold">Start Dictation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Engine & Configuration Quick Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Engine */}
        <div className="forge-card p-4 flex items-start gap-3">
          <div className="p-2 rounded-md bg-white/5 text-forge-accent">
            {settings?.provider === "groq" ? (
              <Zap className="w-5 h-5 text-amber-400" />
            ) : settings?.provider === "local-whisper" ? (
              <Cpu className="w-5 h-5 text-emerald-400" />
            ) : (
              <Sparkles className="w-5 h-5 text-forge-accent" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-forge-muted">Active Engine</div>
            <div className="text-sm font-semibold text-forge-text capitalize truncate">
              {settings?.provider === "local-whisper"
                ? "Local Whisper"
                : settings?.provider === "groq"
                ? "Groq Whisper"
                : "Mock Engine"}
            </div>
            <div className="text-xs text-forge-muted truncate mt-0.5">
              Model: {settings?.model}
            </div>
          </div>
        </div>

        {/* Formatting Mode */}
        <div className="forge-card p-4 flex items-start gap-3">
          <div className="p-2 rounded-md bg-white/5 text-forge-accent">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-forge-muted">Formatting Mode</div>
            <div className="text-sm font-semibold text-forge-text">
              {settings?.formatting_mode} Mode
            </div>
            <div className="text-xs text-forge-muted mt-0.5">
              Rule-based cleanup active
            </div>
          </div>
        </div>

        {/* Microphone */}
        <div className="forge-card p-4 flex items-start gap-3">
          <div className="p-2 rounded-md bg-white/5 text-forge-accent">
            <Mic className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-forge-muted">Input Device</div>
            <div className="text-sm font-semibold text-forge-text truncate">
              {settings?.microphone || "System Default"}
            </div>
            <button
              onClick={() => onNavigate("settings")}
              className="text-xs text-forge-accent hover:underline mt-0.5 inline-flex items-center gap-1"
            >
              <SettingsIcon className="w-3 h-3" /> Change in Settings
            </button>
          </div>
        </div>
      </div>

      {/* Wispr Flow Voice Commands Guide Card */}
      <div className="forge-card p-4 border border-white/10 bg-gradient-to-r from-[#18181B] to-[#121214]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-forge-text">
              Wispr Flow Verbal Commands & Formatting
            </h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/30">
            Active in Smart & Structured Modes
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
            <div className="font-semibold text-forge-accent">Paragraphs & Lines</div>
            <div className="text-forge-muted font-mono text-[11px]">"new paragraph" → ↵↵</div>
            <div className="text-forge-muted font-mono text-[11px]">"new line" → ↵</div>
          </div>

          <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
            <div className="font-semibold text-amber-400">Self-Corrections</div>
            <div className="text-forge-muted font-mono text-[11px]">"Tuesday, actually Thursday"</div>
            <div className="text-forge-muted font-mono text-[11px]">"scratch that..."</div>
          </div>

          <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
            <div className="font-semibold text-emerald-400">Lists & Bullets</div>
            <div className="text-forge-muted font-mono text-[11px]">"bullet point ..." → •</div>
            <div className="text-forge-muted font-mono text-[11px]">"checkbox ..." → ☐</div>
          </div>

          <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
            <div className="font-semibold text-cyan-400">Headings & Steps</div>
            <div className="text-forge-muted font-mono text-[11px]">"Title: / Heading:" → ###</div>
            <div className="text-forge-muted font-mono text-[11px]">"first ..., then ..., finally"</div>
          </div>
        </div>
      </div>

      {/* Recent Dictations (§83) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-display font-semibold text-forge-text">
            Recent Dictation
          </h3>
          <button
            onClick={() => onNavigate("history")}
            className="text-xs text-forge-accent hover:underline"
          >
            View all history →
          </button>
        </div>

        {history.length === 0 ? (
          <div className="forge-card p-8 text-center text-forge-muted text-sm">
            No dictations recorded yet. Press the hotkey and start speaking!
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="forge-card p-4 flex items-start justify-between gap-4 group transition-colors"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="text-sm text-forge-text line-clamp-2">
                    {item.final_text}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-forge-muted font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
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
                      className={`px-1.5 py-0.2 rounded text-[10px] ${
                        item.verification_status === "Pass"
                          ? "bg-emerald-950 text-emerald-400"
                          : "bg-amber-950 text-amber-400"
                      }`}
                    >
                      {item.verification_status}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => copyText(item.final_text, item.id)}
                  className="p-2 rounded-md bg-white/5 hover:bg-white/10 text-forge-muted hover:text-forge-text transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedId === item.id ? (
                    <Check className="w-4 h-4 text-forge-success" />
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
