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

  const isRecording = procState === "Listening";

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Hero Dictation Card */}
      <div className="forge-card p-6 bg-gradient-to-b from-[#1C1B1B] to-[#141414] relative overflow-hidden border border-white/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-forge-strong/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forge-strong/10 border border-forge-strong/20 text-xs font-mono text-forge-accent">
              <span className="w-2 h-2 rounded-full bg-forge-strong animate-pulse" />
              HOTKEY: {settings?.hotkey || "Control+Space"}
            </div>
            <h2 className="text-2xl font-display font-bold text-forge-text tracking-tight">
              Ready to Dictate
            </h2>
            <p className="text-sm text-forge-muted max-w-md">
              {settings?.is_toggle_mode
                ? `Press ${settings.hotkey} to start, and press again when finished.`
                : `Hold ${settings?.hotkey || "Ctrl+Space"} in any app, speak naturally, and release.`}
            </p>
          </div>

          <button
            onClick={toggleRecording}
            className={`flex items-center gap-3 px-6 py-3.5 rounded-lg font-medium transition-all duration-200 shadow-lg ${
              isRecording
                ? "bg-forge-error hover:bg-forge-error/90 text-white animate-pulse"
                : "bg-forge-strong hover:bg-forge-strong/90 text-white shadow-glow"
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-5 h-5 fill-current" />
                <span>Stop Recording</span>
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
