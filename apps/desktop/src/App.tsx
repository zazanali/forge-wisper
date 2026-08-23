import React, { useEffect, useState } from "react";
import { Dashboard } from "./views/Dashboard";
import { HistoryView } from "./views/HistoryView";
import { SettingsView } from "./views/SettingsView";
import { ModelManagerView } from "./views/ModelManagerView";
import { DictionaryView } from "./views/DictionaryView";
import { FloatingRecorder } from "./views/FloatingRecorder";
import { ForgeLogo } from "./components/ForgeLogo";
import { api } from "./lib/tauri";
import type { AppSettings } from "./types";
import {
  LayoutDashboard,
  History as HistoryIcon,
  Cpu,
  Settings2,
  BookA,
  Sparkles,
  Zap,
  ShieldCheck,
  PanelLeftClose,
  Sun,
  Moon,
} from "lucide-react";

type Tab = "dashboard" | "history" | "models" | "dictionary" | "settings";

export const App: React.FC = () => {
  const [isRecorderWindow, setIsRecorderWindow] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<Tab>("dashboard");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const resolveEffectiveTheme = (themePreference?: string) => {
    if (themePreference === "system") {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return themePreference || "light";
  };

  const applyTheme = (themePreference?: string) => {
    const effective = resolveEffectiveTheme(themePreference);
    document.documentElement.setAttribute("data-theme", effective);
  };

  useEffect(() => {
    // Check if we are mounted inside the floating recorder window
    if (window.location.hash === "#recorder" || window.location.pathname.includes("recorder")) {
      setIsRecorderWindow(true);
      return;
    }

    api.getSettings().then((s) => {
      setSettings(s);
      applyTheme(s.theme);
    }).catch(console.error);

    const unlistenToast = api.onToast((msg) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3000);
    });

    const unlistenState = api.onStateChange(() => {
      api.getSettings().then((s) => {
        setSettings(s);
        applyTheme(s.theme);
      }).catch(console.error);
    });

    return () => {
      unlistenToast.then((fn) => fn());
      unlistenState.then((fn) => fn());
    };
  }, []);

  // Real-time system theme change listener for Windows/OS theme toggles
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (settings?.theme === "system") {
        applyTheme("system");
      }
    };
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [settings?.theme]);

  const toggleTheme = async () => {
    if (!settings) return;
    const currentEffective = resolveEffectiveTheme(settings.theme);
    const newTheme = currentEffective === "light" ? "dark" : "light";
    const updated = { ...settings, theme: newTheme as "dark" | "light" | "system" };
    try {
      await api.updateSettings(updated);
      setSettings(updated);
      applyTheme(newTheme);
    } catch (e) {
      console.error(e);
    }
  };

  if (isRecorderWindow) {
    return <FloatingRecorder />;
  }

  const isLocal = settings?.provider === "local-whisper";
  const isDark = resolveEffectiveTheme(settings?.theme) === "dark";

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text-1)] select-none overflow-hidden font-sans">
      {/* Collapsible Left Sidebar (ForgeClip Design System) */}
      <aside
        className={`${isSidebarOpen ? "w-64 p-5" : "w-20 p-3"
          } bg-[var(--panel)]/95 backdrop-blur-2xl border-r border-[var(--border)] flex flex-col justify-between shrink-0 z-20 transition-all duration-300 ease-in-out`}
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
                <ForgeLogo size={36} className="group-hover:scale-105 transition-transform" />
                <div className="min-w-0">
                  <h1 className="text-base font-display font-bold text-[var(--text-1)] tracking-tight">
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
                className="p-1.5 rounded-xl text-[var(--text-2)] hover:text-[#FF4D5E] hover:bg-[var(--raised)] border border-transparent hover:border-[var(--border)] transition-all ml-1 shrink-0"
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
                className="hover:scale-110 active:scale-95 transition-all group relative"
              >
                <ForgeLogo size={38} />
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setCurrentTab("dashboard")}
              title="Dashboard"
              className={`w-full flex items-center ${isSidebarOpen ? "gap-3 px-3.5" : "justify-center px-0"
                } py-2.5 rounded-xl text-xs font-semibold transition-all relative ${currentTab === "dashboard"
                  ? "bg-[#FF4D5E]/12 text-[#FF4D5E] font-bold"
                  : "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--raised)]"
                }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" strokeWidth={currentTab === "dashboard" ? 2.2 : 1.9} />
              {isSidebarOpen && <span>Dashboard</span>}
              {currentTab === "dashboard" && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF4D5E] rounded-l-full" />
              )}
            </button>

            <button
              onClick={() => setCurrentTab("history")}
              title="History"
              className={`w-full flex items-center ${isSidebarOpen ? "gap-3 px-3.5" : "justify-center px-0"
                } py-2.5 rounded-xl text-xs font-semibold transition-all relative ${currentTab === "history"
                  ? "bg-[#FF4D5E]/12 text-[#FF4D5E] font-bold"
                  : "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--raised)]"
                }`}
            >
              <HistoryIcon className="w-4 h-4 shrink-0" strokeWidth={currentTab === "history" ? 2.2 : 1.9} />
              {isSidebarOpen && <span>History</span>}
              {currentTab === "history" && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF4D5E] rounded-l-full" />
              )}
            </button>

            <button
              onClick={() => setCurrentTab("models")}
              title="Local Models"
              className={`w-full flex items-center ${isSidebarOpen ? "gap-3 px-3.5" : "justify-center px-0"
                } py-2.5 rounded-xl text-xs font-semibold transition-all relative ${currentTab === "models"
                  ? "bg-[#FF4D5E]/12 text-[#FF4D5E] font-bold"
                  : "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--raised)]"
                }`}
            >
              <Cpu className="w-4 h-4 shrink-0" strokeWidth={currentTab === "models" ? 2.2 : 1.9} />
              {isSidebarOpen && <span>Local Models</span>}
              {currentTab === "models" && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF4D5E] rounded-l-full" />
              )}
            </button>

            <button
              onClick={() => setCurrentTab("dictionary")}
              title="Dictionary & Snippets"
              className={`w-full flex items-center ${isSidebarOpen ? "gap-3 px-3.5" : "justify-center px-0"
                } py-2.5 rounded-xl text-xs font-semibold transition-all relative ${currentTab === "dictionary"
                  ? "bg-[#FF4D5E]/12 text-[#FF4D5E] font-bold"
                  : "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--raised)]"
                }`}
            >
              <BookA className="w-4 h-4 shrink-0" strokeWidth={currentTab === "dictionary" ? 2.2 : 1.9} />
              {isSidebarOpen && <span>Dictionary & Snippets</span>}
              {currentTab === "dictionary" && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF4D5E] rounded-l-full" />
              )}
            </button>

            <button
              onClick={() => setCurrentTab("settings")}
              title="Settings"
              className={`w-full flex items-center ${isSidebarOpen ? "gap-3 px-3.5" : "justify-center px-0"
                } py-2.5 rounded-xl text-xs font-semibold transition-all relative ${currentTab === "settings"
                  ? "bg-[#FF4D5E]/12 text-[#FF4D5E] font-bold"
                  : "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--raised)]"
                }`}
            >
              <Settings2 className="w-4 h-4 shrink-0" strokeWidth={currentTab === "settings" ? 2.2 : 1.9} />
              {isSidebarOpen && <span>Settings</span>}
              {currentTab === "settings" && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF4D5E] rounded-l-full" />
              )}
            </button>
          </nav>
        </div>

        {/* Bottom Engine Privacy Status Badge & Quick Theme Toggle */}
        {isSidebarOpen ? (
          <div className="space-y-2">
            <div className="p-3.5 bg-[var(--raised)] rounded-xl border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--text-3)] font-mono text-[10px] uppercase tracking-wider">ENGINE</span>
                <span className="font-bold text-[var(--text-1)] uppercase text-[10px] font-mono">
                  {isLocal ? "LOCAL" : "GROQ"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  {isLocal ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-[#3FE3C4] shrink-0" />
                      <span className="text-[#3FE3C4] font-mono text-[11px]">
                        Offline Local
                      </span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-amber-400 font-mono text-[11px]">
                        Groq Cloud
                      </span>
                    </>
                  )}
                </div>

                {/* 1-Click Theme Switcher */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
                  className="p-1.5 rounded-lg bg-[var(--panel)] hover:bg-[var(--raised-hover)] border border-[var(--border)] text-[var(--text-2)] hover:text-[#FF4D5E] transition-colors"
                >
                  {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-[#FF4D5E]" />}
                </button>
              </div>
              <div className="text-[10px] font-mono text-[var(--text-3)] text-center pt-1.5 opacity-70 hover:opacity-100 transition-opacity">
                by <strong className="text-[var(--text-2)]">Ali Zazan</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 flex flex-col items-center">
            <div
              className="p-2 bg-[var(--raised)] rounded-xl border border-[var(--border)] flex items-center justify-center"
              title={isLocal ? "100% Offline Local" : "Groq Cloud STT"}
            >
              {isLocal ? (
                <ShieldCheck className="w-4 h-4 text-[#3FE3C4]" />
              ) : (
                <Zap className="w-4 h-4 text-amber-400" />
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
              className="p-2 rounded-xl bg-[var(--panel)] hover:bg-[var(--raised-hover)] border border-[var(--border)] text-[var(--text-2)] hover:text-[#FF4D5E] transition-colors"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-[#FF4D5E]" />}
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden h-full bg-[var(--bg)] custom-scrollbar">
        {/* Responsive Page Viewport Container */}
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-6 md:py-8 transition-all duration-300">
          {currentTab === "dashboard" && <Dashboard onNavigate={setCurrentTab} />}
          {currentTab === "history" && <HistoryView />}
          {currentTab === "models" && <ModelManagerView />}
          {currentTab === "dictionary" && <DictionaryView />}
          {currentTab === "settings" && <SettingsView onNavigate={setCurrentTab} />}
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
