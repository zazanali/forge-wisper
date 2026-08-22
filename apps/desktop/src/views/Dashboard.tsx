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
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Currently using Mock Engine:</strong> Transcribing with pre-set sample text. Switch to <strong>Groq Whisper</strong> or <strong>Local Whisper</strong> to transcribe your real voice.
            </span>
          </div>
          <button
            onClick={() => onNavigate("settings")}
            className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg font-semibold transition-colors shrink-0"
          >
            Configure Engine →
          </button>
        </div>
      )}

      {/* Main Ready to Dictate Hero Card */}
      <div
        className={`forge-card p-6 bg-gradient-to-b from-[#151820] to-[#0C0E14] relative overflow-hidden border rounded-2xl transition-all duration-300 ${
          isRecording
            ? "border-[#FF4D5E] shadow-xl shadow-[#FF4D5E]/15"
            : "border-[#2A2E38]"
        }`}
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#FF4D5E]/8 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-2.5 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF4D5E]/12 border border-[#FF4D5E]/25 text-xs font-mono text-[#FF4D5E]">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRecording ? "bg-[#FF4D5E] animate-ping" : "bg-[#FF4D5E] animate-pulse"
                }`}
              />
              HOTKEY: {settings?.hotkey || "Control+Space"}
            </div>
            <h2 className="text-2xl font-display font-bold text-[#E8ECF2] tracking-tight flex items-center gap-3">
              {isRecording ? "Recording Speech..." : "Ready to Dictate"}
              {isRecording && (
                <span className="text-sm font-mono text-[#FF4D5E] font-bold px-2 py-0.5 rounded-lg bg-[#FF4D5E]/15 border border-[#FF4D5E]/30">
                  {formatTime(durationSecs)}
                </span>
              )}
            </h2>
            <p className="text-sm text-[#9BA3B5] max-w-md">
              {settings?.is_toggle_mode
                ? `Press ${settings.hotkey} to start dictation, speak, and press again to paste.`
                : `Hold ${settings?.hotkey || "Ctrl+Space"} in any active window, speak naturally, and release.`}
            </p>

            {/* Live Audio Reactive Visualizer */}
            {isRecording && (
              <div className="flex items-center gap-1.5 pt-2">
                <span className="text-xs text-[#9BA3B5]">Input:</span>
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
                <span className="text-[11px] text-[#3FE3C4] font-mono ml-2">
                  Live Waveform
                </span>
              </div>
            )}
          </div>

          <button
            onClick={toggleRecording}
            className={`flex items-center gap-3 px-7 py-4 rounded-xl font-semibold transition-all duration-200 shadow-xl ${
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

      {/* Engine & Configuration Quick Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Engine */}
        <div className="forge-card p-4 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-[#1C2028] text-[#FF4D5E]">
            {settings?.provider === "groq" ? (
              <Zap className="w-5 h-5 text-amber-400" />
            ) : settings?.provider === "local-whisper" ? (
              <Cpu className="w-5 h-5 text-[#3FE3C4]" />
            ) : (
              <Sparkles className="w-5 h-5 text-[#FF4D5E]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-[#5C6478] uppercase tracking-wider font-mono">Active Engine</div>
            <div className="text-sm font-semibold text-[#E8ECF2] capitalize truncate mt-0.5">
              {settings?.provider === "local-whisper"
                ? "Local Whisper"
                : settings?.provider === "groq"
                ? "Groq Whisper"
                : "Mock Engine"}
            </div>
            <div className="text-xs text-[#9BA3B5] truncate mt-0.5 font-mono">
              Model: {settings?.model}
            </div>
          </div>
        </div>

        {/* Formatting Mode */}
        <div className="forge-card p-4 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-[#1C2028] text-[#3FE3C4]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-[#5C6478] uppercase tracking-wider font-mono">Formatting Mode</div>
            <div className="text-sm font-semibold text-[#E8ECF2] capitalize mt-0.5">
              {settings?.formatting_mode} Mode
            </div>
            <div className="text-xs text-[#9BA3B5] mt-0.5">
              Rule-based cleanup active
            </div>
          </div>
        </div>

        {/* Microphone */}
        <div className="forge-card p-4 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-[#1C2028] text-[#FF4D5E]">
            <Mic className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-[#5C6478] uppercase tracking-wider font-mono">Input Device</div>
            <div className="text-sm font-semibold text-[#E8ECF2] truncate mt-0.5">
              {settings?.microphone || "System Default"}
            </div>
            <button
              onClick={() => onNavigate("settings")}
              className="text-xs text-[#FF4D5E] hover:underline mt-0.5 inline-flex items-center gap-1 font-medium"
            >
              <SettingsIcon className="w-3 h-3" /> Change in Settings
            </button>
          </div>
        </div>
      </div>

      {/* Wispr Flow Voice Commands Guide Card */}
      <div className="forge-card p-4 bg-gradient-to-r from-[#151820] to-[#11141A]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#FF4D5E]" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#E8ECF2] font-display">
              Wispr Flow Verbal Commands & Formatting
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#3FE3C4] bg-[#3FE3C4]/10 px-2 py-0.5 rounded-lg border border-[#3FE3C4]/20">
            Active in Smart & Structured Modes
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-[#0C0E14] border border-[#2A2E38] space-y-1">
            <div className="font-semibold text-[#FF4D5E]">Paragraphs & Lines</div>
            <div className="text-[#9BA3B5] font-mono text-[11px]">"new paragraph" → ↵↵</div>
            <div className="text-[#9BA3B5] font-mono text-[11px]">"new line" → ↵</div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0C0E14] border border-[#2A2E38] space-y-1">
            <div className="font-semibold text-amber-400">Self-Corrections</div>
            <div className="text-[#9BA3B5] font-mono text-[11px]">"Tuesday, actually Thursday"</div>
            <div className="text-[#9BA3B5] font-mono text-[11px]">"scratch that..."</div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0C0E14] border border-[#2A2E38] space-y-1">
            <div className="font-semibold text-[#3FE3C4]">Lists & Bullets</div>
            <div className="text-[#9BA3B5] font-mono text-[11px]">"bullet point ..." → •</div>
            <div className="text-[#9BA3B5] font-mono text-[11px]">"checkbox ..." → ☐</div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0C0E14] border border-[#2A2E38] space-y-1">
            <div className="font-semibold text-cyan-400">Headings & Steps</div>
            <div className="text-[#9BA3B5] font-mono text-[11px]">"Title: / Heading:" → ###</div>
            <div className="text-[#9BA3B5] font-mono text-[11px]">"first ..., then ..., finally"</div>
          </div>
        </div>
      </div>

      {/* Recent Dictations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-display font-semibold text-[#E8ECF2]">
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
          <div className="forge-card p-8 text-center text-[#5C6478] text-sm rounded-xl">
            No dictations recorded yet. Press the hotkey and start speaking!
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="forge-card p-4 flex items-start justify-between gap-4 group transition-all"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="text-sm text-[#E8ECF2] line-clamp-2">
                    {item.final_text}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-[#9BA3B5] font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#5C6478]" />
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
                          ? "bg-[#3FE3C4]/15 text-[#3FE3C4] border border-[#3FE3C4]/30"
                          : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {item.verification_status}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => copyText(item.final_text, item.id)}
                  className="p-2 rounded-lg bg-[#1C2028] hover:bg-[#252A34] text-[#9BA3B5] hover:text-[#E8ECF2] transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedId === item.id ? (
                    <Check className="w-4 h-4 text-[#3FE3C4]" />
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
