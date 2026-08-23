import React, { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import type { ProcessingState, AppSettings } from "../types";
import { ForgeLogo } from "../components/ForgeLogo";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Square,
  X,
} from "lucide-react";

export const FloatingRecorder: React.FC = () => {
  const [state, setState] = useState<ProcessingState>("Idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [durationSecs, setDurationSecs] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

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
    api.getProcessingState().then(setState).catch(console.error);
    api.getSettings().then((s) => {
      setSettings(s);
      applyTheme(s.theme);
    }).catch(console.error);

    const unlistenState = api.onStateChange(({ state: newState, error }) => {
      setState(newState);
      setErrorMsg(error || null);
      if (newState === "Listening") {
        setDurationSecs(0);
      }
    });

    return () => {
      unlistenState.then((fn) => fn());
    };
  }, []);

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

  // Duration timer when recording
  useEffect(() => {
    if (state !== "Listening") return;
    const interval = setInterval(() => {
      setDurationSecs((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [state]);

  // Live microphone level polling for real soundwave reaction
  useEffect(() => {
    if (state !== "Listening") {
      setAudioLevel(0);
      return;
    }
    const interval = setInterval(async () => {
      try {
        const rms = await api.getMicLevel();
        const level = Math.min(1.0, rms * 5.0);
        setAudioLevel(level);
      } catch {
        // ignore
      }
    }, 60);
    return () => clearInterval(interval);
  }, [state]);

  const stopAndPaste = async () => {
    try {
      await api.stopRecording();
    } catch (e) {
      console.error(e);
    }
  };

  const cancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.cancelRecording();
    } catch (e) {
      console.error(e);
    }
  };

  const isLocal = settings?.provider === "local-whisper";

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // 7 soundwave bar heights dynamically computed from audio level
  const barMultipliers = [0.35, 0.75, 1.0, 0.85, 0.95, 0.6, 0.4];

  return (
    <div className="w-full h-full flex items-center justify-center p-1 select-none font-sans">
      <div
        onClick={state === "Listening" ? stopAndPaste : undefined}
        className={`w-full h-14 bg-[var(--panel)] backdrop-blur-2xl border rounded-2xl shadow-2xl px-3.5 flex items-center justify-between text-[var(--text-1)] transition-all duration-300 ${
          state === "Listening"
            ? "border-[#FF4D5E] shadow-xl shadow-[#FF4D5E]/20 cursor-pointer hover:border-[#FF4D5E]/80"
            : state === "Success"
            ? "border-teal-500 shadow-xl shadow-teal-500/20"
            : "border-[var(--border)]"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Animated Status Icon */}
          {state === "Listening" && (
            <div className="relative flex items-center justify-center shrink-0">
              <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-[#FF4D5E] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF4D5E]"></span>
            </div>
          )}

          {(state === "Stopping" ||
            state === "Transcribing" ||
            state === "Cleaning" ||
            state === "Structuring" ||
            state === "Verifying" ||
            state === "Inserting") && (
            <Loader2 className="w-4 h-4 text-[#FF4D5E] animate-spin shrink-0" />
          )}

          {state === "Success" && (
            <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-[#3FE3C4] animate-bounce shrink-0" />
          )}

          {state === "Error" && (
            <AlertCircle className="w-4 h-4 text-[#FF4D5E] shrink-0" />
          )}

          {state === "Idle" && <ForgeLogo size={20} glow={false} />}

          {/* Status Text & Dynamic Reactive Waveform */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wide font-display text-[var(--text-1)] truncate">
                {state === "Listening" && "Listening..."}
                {state === "Stopping" && "Stopping..."}
                {state === "Transcribing" && "Transcribing..."}
                {state === "Cleaning" && "Forging text..."}
                {state === "Structuring" && "Structuring..."}
                {state === "Verifying" && "Verifying..."}
                {state === "Inserting" && "Pasting..."}
                {state === "Success" && "✓ Inserted"}
                {state === "Error" && (errorMsg || "No Speech Detected")}
                {state === "Idle" && "Forge Wisper Ready"}
                {state === "Cancelled" && "Cancelled"}
              </span>

              {state === "Listening" && (
                <span className="text-[11px] font-mono text-[#FF4D5E] font-bold shrink-0">
                  {formatTime(durationSecs)}
                </span>
              )}
            </div>

            {state === "Listening" && (
              <div className="flex items-center gap-1 mt-1 h-2.5">
                {barMultipliers.map((mult, i) => {
                  const dynamicHeight = Math.max(
                    20,
                    Math.round((audioLevel * mult + 0.15) * 100)
                  );
                  return (
                    <div
                      key={i}
                      className="w-1 bg-gradient-to-t from-[#FF4D5E] to-amber-400 rounded-full transition-all duration-75"
                      style={{
                        height: `${Math.min(100, dynamicHeight)}%`,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {state === "Listening" ? (
            <>
              <button
                type="button"
                onClick={stopAndPaste}
                className="px-2 py-1 bg-[#FF4D5E] hover:bg-[#E8404F] text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                title="Stop & Paste"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Done</span>
              </button>
              <button
                type="button"
                onClick={cancel}
                className="p-1 hover:bg-[var(--raised-hover)] text-[var(--text-3)] hover:text-[#FF4D5E] rounded-md transition-colors"
                title="Cancel recording"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--raised)] border border-[var(--border)] text-[9px] font-mono text-[var(--text-2)]">
              <ForgeLogo size={12} glow={false} />
              {isLocal ? (
                <span className="text-teal-600 dark:text-[#3FE3C4] font-bold">LOCAL</span>
              ) : (
                <span className="text-amber-500 font-bold">GROQ</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
