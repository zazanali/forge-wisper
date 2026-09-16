import React, { useEffect, useState } from "react";
import { Dashboard } from "./views/Dashboard";
import { HistoryView } from "./views/HistoryView";
import { SettingsView } from "./views/SettingsView";
import { ModelManagerView } from "./views/ModelManagerView";
import { DictionaryView } from "./views/DictionaryView";
import { FloatingRecorder } from "./views/FloatingRecorder";
import { ForgeLogo } from "./components/ForgeLogo";
import { UpdateBanner } from "./components/UpdateBanner";
import { UpdateModal } from "./components/UpdateModal";
import { api } from "./lib/tauri";
import type { AppSettings, UpdateInfo } from "./types";
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
  Menu,
  X,
} from "lucide-react";

type Tab = "dashboard" | "history" | "models" | "dictionary" | "settings";

export const App: React.FC = () => {
  const [isRecorderWindow] = useState(() => {
    if (typeof window !== "undefined") {
      return window.location.hash.includes("recorder") || window.location.pathname.includes("recorder");
    }
    return false;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<Tab>("dashboard");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<UpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isUpdateBannerDismissed, setIsUpdateBannerDismissed] = useState(false);

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
    if (isRecorderWindow) {
      return;
    }

    api.getSettings().then((s) => {
      setSettings(s);
      applyTheme(s.theme);
      if (s.auto_check_updates !== false) {
        api.checkForUpdates(false).then((info) => {
          if (info.has_update) {
            setAvailableUpdate(info);
          }
        }).catch(() => {});
      }
    }).catch(console.error);

    const unlistenToast = api.onToast((msg) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3000);
    });

    const unlistenUpdate = api.onUpdateAvailable((info) => {
      if (info.has_update) {
        setAvailableUpdate(info);
      }
    });

    return () => {
      unlistenToast.then((fn) => fn());
      unlistenUpdate.then((fn) => fn());
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

  const navItems = [
    { id: "dashboard" as Tab, label: "Dashboard", icon: LayoutDashboard },
    { id: "history" as Tab, label: "History", icon: HistoryIcon },
    { id: "models" as Tab, label: "Local Models", icon: Cpu },
    { id: "dictionary" as Tab, label: "Dictionary & Snippets", icon: BookA },
    { id: "settings" as Tab, label: "Settings", icon: Settings2 },
  ];

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] select-none overflow-hidden font-sans relative">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-xs transition-opacity animate-fadeIn"
        />
      )}

      {/* Mobile Slide-Out Drawer Menu */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 p-4 bg-[var(--surface-primary)] border-r border-[var(--border)] flex flex-col justify-between transform transition-transform duration-200 ease-in-out shadow-2xl ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-5">
          {/* Brand Header with Close Button */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <ForgeLogo size={28} />
              <div>
                <h1 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">
                  Forge Wisper
                </h1>
                <span className="text-[11px] font-medium text-[var(--accent)] block">
                  Speech Engine
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-1 rounded-[6px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-colors cursor-pointer"
              title="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[7px] text-[13px] font-medium transition-all relative cursor-pointer ${
                    isActive
                      ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2.1 : 1.8} />
                  <span>{item.label}</span>
                  {item.id === "settings" && availableUpdate?.has_update && (
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse shrink-0 ml-auto" title="New update available" />
                  )}
                  {isActive && (
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[var(--accent)] rounded-l-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Mobile Drawer Bottom Info */}
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
      </aside>

      {/* Desktop Collapsible Left Sidebar (Hidden on mobile <md) */}
      <aside
        className={`hidden md:flex ${
          isSidebarOpen ? "w-60 p-4" : "w-16 p-2.5"
        } bg-[var(--surface-primary)] border-r border-[var(--border)] flex-col justify-between shrink-0 z-20 transition-all duration-200 ease-in-out`}
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
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  title={item.label}
                  className={`w-full flex items-center ${
                    isSidebarOpen ? "gap-2.5 px-3" : "justify-center px-0"
                  } py-2 rounded-[7px] text-[13px] font-medium transition-all relative cursor-pointer ${
                    isActive
                      ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2.1 : 1.8} />
                  {isSidebarOpen && <span>{item.label}</span>}
                  {item.id === "settings" && availableUpdate?.has_update && (
                    isSidebarOpen ? (
                      <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse shrink-0 ml-auto" title="New update available" />
                    ) : (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface-primary)] animate-pulse" title="New update available" />
                    )
                  )}
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
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Mobile / Small Screen Top Navigation Bar (Hidden on md+) */}
        <header className="md:hidden flex items-center justify-between px-3 sm:px-4 py-2.5 bg-[var(--surface-primary)] border-b border-[var(--border)] shrink-0 z-30">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-[6px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-colors cursor-pointer"
              title="Open Menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <ForgeLogo size={22} />
              <span className="font-semibold text-[13px] text-[var(--text-primary)] tracking-tight">
                Forge Wisper
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-[4px] bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-secondary)] capitalize">
              {currentTab}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
              className="p-1.5 rounded-[6px] bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-[var(--warning)]" /> : <Moon className="w-3.5 h-3.5 text-[var(--accent)]" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden h-full bg-[var(--bg-app)]">
          {/* Responsive Page Viewport Container */}
          <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 md:px-8 py-3.5 sm:py-6 md:py-8 transition-all duration-200">
            {currentTab === "dashboard" && <Dashboard onNavigate={setCurrentTab} />}
            {currentTab === "history" && <HistoryView />}
            {currentTab === "models" && <ModelManagerView />}
            {currentTab === "dictionary" && <DictionaryView />}
            {currentTab === "settings" && <SettingsView onNavigate={setCurrentTab} />}
          </div>
        </main>
      </div>

      {/* Global Top-Centered Floating Toast */}
      {toastMessage && (
        <div className="forge-toast flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Antigravity-Style Floating Update Banner */}
      {availableUpdate?.has_update && !isUpdateBannerDismissed && (
        <UpdateBanner
          updateInfo={availableUpdate}
          onOpenModal={() => setIsUpdateModalOpen(true)}
          onDismiss={() => setIsUpdateBannerDismissed(true)}
        />
      )}

      {/* "What's New" & Live Progress Update Modal */}
      {availableUpdate && (
        <UpdateModal
          updateInfo={availableUpdate}
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
        />
      )}
    </div>
  );
};
