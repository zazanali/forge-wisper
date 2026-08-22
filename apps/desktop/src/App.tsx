import React, { useEffect, useState } from "react";
import { Dashboard } from "./views/Dashboard";
import { HistoryView } from "./views/HistoryView";
import { SettingsView } from "./views/SettingsView";
import { ModelManagerView } from "./views/ModelManagerView";
import { FloatingRecorder } from "./views/FloatingRecorder";
import { api } from "./lib/tauri";
import type { AppSettings } from "./types";
import {
  Mic,
  History as HistoryIcon,
  Cpu,
  Settings as SettingsIcon,
  Sparkles,
  Zap,
  ShieldCheck,
} from "lucide-react";

type Tab = "dashboard" | "history" | "models" | "settings";

export const App: React.FC = () => {
  const [isRecorderWindow, setIsRecorderWindow] = useState(false);
  const [currentTab, setCurrentTab] = useState<Tab>("dashboard");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check if we are mounted inside the floating recorder window
    if (window.location.hash === "#recorder" || window.location.pathname.includes("recorder")) {
      setIsRecorderWindow(true);
      return;
    }

    api.getSettings().then(setSettings).catch(console.error);

    const unlistenToast = api.onToast((msg) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3000);
    });

    const unlistenState = api.onStateChange(() => {
      api.getSettings().then(setSettings).catch(console.error);
    });

    return () => {
      unlistenToast.then((fn) => fn());
      unlistenState.then((fn) => fn());
    };
  }, []);

  if (isRecorderWindow) {
    return <FloatingRecorder />;
  }

  const isGroq = settings?.provider === "groq";
  const isLocal = settings?.provider === "local-whisper";

  return (
    <div className="flex h-screen bg-forge-bg text-forge-text select-none overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-60 bg-forge-surface border-r border-white/5 flex flex-col justify-between p-4 shrink-0">
        {/* Brand Header */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-forge-strong to-forge-dark-accent flex items-center justify-center shadow-glow">
              <Mic className="w-5 h-5 text-forge-accent" />
            </div>
            <div>
              <h1 className="text-base font-display font-bold text-forge-text tracking-wide">
                Forge Wisper
              </h1>
              <div className="text-[10px] font-mono text-forge-muted tracking-wider uppercase">
                v1.0 Core
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => setCurrentTab("dashboard")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors ${
                currentTab === "dashboard"
                  ? "bg-forge-strong/20 text-forge-accent font-semibold border-l-2 border-forge-strong"
                  : "text-forge-muted hover:text-forge-text hover:bg-white/5"
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setCurrentTab("history")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors ${
                currentTab === "history"
                  ? "bg-forge-strong/20 text-forge-accent font-semibold border-l-2 border-forge-strong"
                  : "text-forge-muted hover:text-forge-text hover:bg-white/5"
              }`}
            >
              <HistoryIcon className="w-4 h-4" />
              <span>History</span>
            </button>

            <button
              onClick={() => setCurrentTab("models")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors ${
                currentTab === "models"
                  ? "bg-forge-strong/20 text-forge-accent font-semibold border-l-2 border-forge-strong"
                  : "text-forge-muted hover:text-forge-text hover:bg-white/5"
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Local Models</span>
            </button>

            <button
              onClick={() => setCurrentTab("settings")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors ${
                currentTab === "settings"
                  ? "bg-forge-strong/20 text-forge-accent font-semibold border-l-2 border-forge-strong"
                  : "text-forge-muted hover:text-forge-text hover:bg-white/5"
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Bottom Engine Privacy Status Badge (§60) */}
        <div className="p-3 bg-black/40 rounded-lg border border-white/5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-forge-muted font-mono">ENGINE</span>
            <span className="font-semibold text-forge-text uppercase text-[10px]">
              {settings?.provider || "MOCK"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            {isGroq && (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300 font-mono text-[11px]">
                  Groq Cloud STT
                </span>
              </>
            )}
            {isLocal && (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-mono text-[11px]">
                  100% Offline Local
                </span>
              </>
            )}
            {!isGroq && !isLocal && (
              <>
                <Sparkles className="w-3.5 h-3.5 text-forge-accent" />
                <span className="text-forge-accent font-mono text-[11px]">
                  Mock Testing
                </span>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-forge-bg">
        {/* Scrollable View Container */}
        <div className="flex-1 overflow-y-auto p-8 max-w-5xl w-full mx-auto">
          {currentTab === "dashboard" && <Dashboard onNavigate={setCurrentTab} />}
          {currentTab === "history" && <HistoryView />}
          {currentTab === "models" && <ModelManagerView />}
          {currentTab === "settings" && <SettingsView />}
        </div>
      </main>

      {/* Global Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-forge-surface border border-forge-accent/40 text-forge-text px-4 py-2.5 rounded-lg shadow-2xl text-xs flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-forge-accent" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
