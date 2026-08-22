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
  PanelLeftClose,
} from "lucide-react";

type Tab = "dashboard" | "history" | "models" | "settings";

export const App: React.FC = () => {
  const [isRecorderWindow, setIsRecorderWindow] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
    <div className="flex h-screen bg-[#0C0E14] text-[#E8ECF2] select-none overflow-hidden font-sans">
      {/* Collapsible Left Sidebar (ForgeClip Design System) */}
      <aside
        className={`${
          isSidebarOpen ? "w-64 p-5" : "w-20 p-3"
        } bg-[#151820]/95 backdrop-blur-2xl border-r border-[#2A2E38] flex flex-col justify-between shrink-0 z-20 transition-all duration-300 ease-in-out`}
      >
        {/* Top Header & Navigation */}
        <div className="space-y-6">
          {/* Brand Header with Logo Toggle and Gemini-style Close Icon */}
          {isSidebarOpen ? (
            <div className="flex items-center justify-between px-1">
              <button
                onClick={() => setIsSidebarOpen(false)}
                title="Collapse sidebar (Click logo or header)"
                className="flex items-center gap-3 text-left group min-w-0 transition-opacity hover:opacity-90"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF4D5E] to-[#B91C1C] flex items-center justify-center shadow-lg shadow-[#FF4D5E]/25 shrink-0 group-hover:scale-105 transition-transform">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-display font-bold text-[#E8ECF2] tracking-tight">
                    Forge<span className="text-[#FF4D5E]">Wisper</span>
                  </h1>
                  <span className="text-[10px] font-bold text-[#3FE3C4] block tracking-wide truncate">
                    ● Local Voice Engine Secure
                  </span>
                </div>
              </button>

              {/* Close Sidebar Icon (Gemini App style) */}
              <button
                onClick={() => setIsSidebarOpen(false)}
                title="Collapse sidebar menu"
                className="p-1.5 rounded-xl text-[#9BA3B5] hover:text-[#FF4D5E] hover:bg-[#1C2028] border border-transparent hover:border-[#2A2E38] transition-all ml-1 shrink-0"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {/* Click Logo to Open Menu */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                title="Click logo to open menu"
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF4D5E] to-[#B91C1C] flex items-center justify-center shadow-lg shadow-[#FF4D5E]/25 hover:scale-110 active:scale-95 transition-all text-white group relative"
              >
                <Mic className="w-5 h-5" />
                {/* Glow ring */}
                <span className="absolute inset-0 rounded-xl bg-[#FF4D5E] opacity-0 group-hover:opacity-30 blur-sm transition-opacity" />
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setCurrentTab("dashboard")}
              title="Dashboard"
              className={`w-full flex items-center ${
                isSidebarOpen ? "gap-3 px-3.5" : "justify-center px-0"
              } py-2.5 rounded-xl text-xs font-semibold transition-all relative ${
                currentTab === "dashboard"
                  ? "bg-[#FF4D5E]/12 text-[#FF4D5E] font-bold"
                  : "text-[#9BA3B5] hover:text-[#E8ECF2] hover:bg-[#1C2028]"
              }`}
            >
              <Mic className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>Dashboard</span>}
              {currentTab === "dashboard" && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF4D5E] rounded-l-full" />
              )}
            </button>

            <button
              onClick={() => setCurrentTab("history")}
              title="History"
              className={`w-full flex items-center ${
                isSidebarOpen ? "gap-3 px-3.5" : "justify-center px-0"
              } py-2.5 rounded-xl text-xs font-semibold transition-all relative ${
                currentTab === "history"
                  ? "bg-[#FF4D5E]/12 text-[#FF4D5E] font-bold"
                  : "text-[#9BA3B5] hover:text-[#E8ECF2] hover:bg-[#1C2028]"
              }`}
            >
              <HistoryIcon className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>History</span>}
              {currentTab === "history" && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF4D5E] rounded-l-full" />
              )}
            </button>

            <button
              onClick={() => setCurrentTab("models")}
              title="Local Models"
              className={`w-full flex items-center ${
                isSidebarOpen ? "gap-3 px-3.5" : "justify-center px-0"
              } py-2.5 rounded-xl text-xs font-semibold transition-all relative ${
                currentTab === "models"
                  ? "bg-[#FF4D5E]/12 text-[#FF4D5E] font-bold"
                  : "text-[#9BA3B5] hover:text-[#E8ECF2] hover:bg-[#1C2028]"
              }`}
            >
              <Cpu className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>Local Models</span>}
              {currentTab === "models" && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF4D5E] rounded-l-full" />
              )}
            </button>

            <button
              onClick={() => setCurrentTab("settings")}
              title="Settings"
              className={`w-full flex items-center ${
                isSidebarOpen ? "gap-3 px-3.5" : "justify-center px-0"
              } py-2.5 rounded-xl text-xs font-semibold transition-all relative ${
                currentTab === "settings"
                  ? "bg-[#FF4D5E]/12 text-[#FF4D5E] font-bold"
                  : "text-[#9BA3B5] hover:text-[#E8ECF2] hover:bg-[#1C2028]"
              }`}
            >
              <SettingsIcon className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>Settings</span>}
              {currentTab === "settings" && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF4D5E] rounded-l-full" />
              )}
            </button>
          </nav>
        </div>

        {/* Bottom Engine Privacy Status Badge */}
        {isSidebarOpen ? (
          <div className="p-3.5 bg-[#0C0E14] rounded-xl border border-[#2A2E38] space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#5C6478] font-mono text-[10px] uppercase tracking-wider">ENGINE</span>
              <span className="font-bold text-[#E8ECF2] uppercase text-[10px] font-mono">
                {settings?.provider || "MOCK"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {isGroq && (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-amber-300 font-mono text-[11px]">
                    Groq Cloud STT
                  </span>
                </>
              )}
              {isLocal && (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#3FE3C4] shrink-0" />
                  <span className="text-[#3FE3C4] font-mono text-[11px]">
                    100% Offline Local
                  </span>
                </>
              )}
              {!isGroq && !isLocal && (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#FF4D5E] shrink-0" />
                  <span className="text-[#FF4D5E] font-mono text-[11px]">
                    Mock Testing
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div
            className="p-2 bg-[#0C0E14] rounded-xl border border-[#2A2E38] flex items-center justify-center"
            title={
              isGroq
                ? "Groq Cloud STT"
                : isLocal
                ? "100% Offline Local"
                : "Mock Testing"
            }
          >
            {isGroq && <Zap className="w-4 h-4 text-amber-400" />}
            {isLocal && <ShieldCheck className="w-4 h-4 text-[#3FE3C4]" />}
            {!isGroq && !isLocal && <Sparkles className="w-4 h-4 text-[#FF4D5E]" />}
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#0C0E14]">
        {/* Scrollable View Container */}
        <div className="flex-1 overflow-y-auto p-8 max-w-5xl w-full mx-auto">
          {currentTab === "dashboard" && <Dashboard onNavigate={setCurrentTab} />}
          {currentTab === "history" && <HistoryView />}
          {currentTab === "models" && <ModelManagerView />}
          {currentTab === "settings" && <SettingsView />}
        </div>
      </main>

      {/* Global ForgeClip Top-Centered Floating Toast */}
      {toastMessage && (
        <div className="forge-toast flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-[#FF4D5E]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
