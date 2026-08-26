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
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] select-none overflow-hidden font-sans">
      {/* Collapsible Left Sidebar */}
      <aside
        className={`${isSidebarOpen ? "w-60 p-4" : "w-16 p-2.5"
          } bg-[var(--surface-primary)] border-r border-[var(--border)] flex flex-col justify-between shrink-0 z-20 transition-all duration-200 ease-in-out`}
      >
        {/* Top Header & Navigation */}
        <div className="space-y-5">
          {/* Brand Header with Logo Toggle */}
          {isSidebarOpen ? (
            <div className="flex items-center justify-between px-1">
              <button
                onClick={() => setIsSidebarOpen(false)}
                title="Collapse sidebar"
                className="flex items-center gap-2.5 text-left group min-w-0 transition-opacity hover:opacity-90 cursor-pointer"
              >
                <ForgeLogo size={28} />
                <div className="min-w-0">
                  <h1 className="text-[14px] font-medium text-[var(--text-primary)] tracking-tight">
                    Forge Wisper
                  </h1>
                  <span className="text-[11px] font-medium text-[var(--accent)] block truncate">
                    Speech Engine
                  </span>
                </div>
              </button>

              <button
                onClick={() => setIsSidebarOpen(false)}
                title="Collapse sidebar menu"
                className="p-1 rounded-[6px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--border)] transition-all ml-1 shrink-0 cursor-pointer"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <button
                onClick={() => setIsSidebarOpen(true)}
                title="Click logo to open menu"
                className="hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              >
                <ForgeLogo size={28} />
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1">
            {[
              { id: "dashboard" as Tab, label: "Dashboard", icon: LayoutDashboard },
              { id: "history" as Tab, label: "History", icon: HistoryIcon },
              { id: "models" as Tab, label: "Local Models", icon: Cpu },
              { id: "dictionary" as Tab, label: "Dictionary & Snippets", icon: BookA },
              { id: "settings" as Tab, label: "Settings", icon: Settings2 },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  title={item.label}
                  className={`w-full flex items-center ${isSidebarOpen ? "gap-2.5 px-3" : "justify-center px-0"
                    } py-2 rounded-[7px] text-[13px] font-medium transition-all relative cursor-pointer ${isActive
                      ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                    }`}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2.1 : 1.8} />
                  {isSidebarOpen && <span>{item.label}</span>}
                  {isActive && (
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[var(--accent)] rounded-l-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Engine Privacy Status Badge & Quick Theme Toggle */}
        {isSidebarOpen ? (
          <div className="space-y-2">
            <div className="p-3 bg-[var(--surface-elevated)] rounded-[8px] border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--text-muted)] font-mono text-[10px] uppercase tracking-wider">Engine</span>
                <span className="font-mono text-[11px] text-[var(--text-primary)]">
                  {isLocal ? "Local Whisper" : "Groq Whisper"}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]">
                <div className="flex items-center gap-1.5 text-[12px] font-mono">
                  {isLocal ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                      <span className="text-[var(--accent)]">Offline</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-[var(--warning)] shrink-0" />
                      <span className="text-[var(--warning)]">Cloud LPU</span>
                    </>
                  )}
                </div>

                {/* 1-Click Theme Switcher */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
                  className="p-1.5 rounded-[6px] bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  {isDark ? <Sun className="w-3.5 h-3.5 text-[var(--warning)]" /> : <Moon className="w-3.5 h-3.5 text-[var(--accent)]" />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 flex flex-col items-center">
            <div
              className="p-1.5 bg-[var(--surface-elevated)] rounded-[6px] border border-[var(--border)] flex items-center justify-center"
              title={isLocal ? "100% Offline Local" : "Groq Cloud STT"}
            >
              {isLocal ? (
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-[var(--warning)]" />
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
              className="p-1.5 rounded-[6px] bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-[var(--warning)]" /> : <Moon className="w-3.5 h-3.5 text-[var(--accent)]" />}
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden h-full bg-[var(--bg-app)]">
        {/* Responsive Page Viewport Container */}
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 transition-all duration-200">
          {currentTab === "dashboard" && <Dashboard onNavigate={setCurrentTab} />}
          {currentTab === "history" && <HistoryView />}
          {currentTab === "models" && <ModelManagerView />}
          {currentTab === "dictionary" && <DictionaryView />}
          {currentTab === "settings" && <SettingsView onNavigate={setCurrentTab} />}
        </div>
      </main>

      {/* Global Top-Centered Floating Toast */}
      {toastMessage && (
        <div className="forge-toast flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
