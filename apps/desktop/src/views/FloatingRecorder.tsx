import React, { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import type { ProcessingState } from "../types";
import { Check, AlertCircle } from "lucide-react";

export const FloatingRecorder: React.FC = () => {
  const [state, setState] = useState<ProcessingState>("Idle");
  const [audioLevel, setAudioLevel] = useState(0);

  const resolveEffectiveTheme = (themePreference?: string) => {
    if (themePreference === "system") {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return themePreference || "dark";
  };

  const applyTheme = (themePreference?: string) => {
    const effective = resolveEffectiveTheme(themePreference);
    document.documentElement.setAttribute("data-theme", effective);
  };

  useEffect(() => {
    document.documentElement.classList.add("recorder-window");
    document.body.classList.add("recorder-window");
    document.documentElement.style.setProperty("background", "transparent", "important");
    document.documentElement.style.setProperty("background-color", "transparent", "important");
    document.body.style.setProperty("background", "transparent", "important");
    document.body.style.setProperty("background-color", "transparent", "important");

    api.getProcessingState().then(setState).catch(console.error);
    api.getSettings().then((s) => {
      applyTheme(s.theme);
    }).catch(console.error);

    const unlistenState = api.onStateChange(({ state: newState }) => {
      setState(newState);
    });

    return () => {
      unlistenState.then((fn) => fn());
      document.documentElement.classList.remove("recorder-window");
      document.body.classList.remove("recorder-window");
    };
  }, []);

  // Live microphone level polling for real soundwave reaction
  useEffect(() => {
    if (state !== "Listening") {
      setAudioLevel(0);
      return;
    }
    const interval = setInterval(async () => {
      try {
        const rms = await api.getMicLevel();
        // Scale microphone level for real-time visual voice reaction
        const level = Math.min(1.0, Math.max(0, rms * 7.5));
        setAudioLevel(level);
      } catch {
        // ignore
      }
    }, 30);
    return () => clearInterval(interval);
  }, [state]);

  const stopAndPaste = async () => {
    try {
      await api.stopRecording();
    } catch (e) {
      console.error(e);
    }
  };

  // 9 soundwave bars with symmetrical bell-curve multipliers
  const barMultipliers = [0.25, 0.45, 0.7, 0.95, 1.0, 0.95, 0.7, 0.45, 0.25];

  const isProcessing = [
    "Stopping",
    "Transcribing",
    "Cleaning",
    "Structuring",
    "Verifying",
    "Inserting",
  ].includes(state);

  const isSuccess = state === "Success";
  const isError = state === "Error";

  return (
    <div className="w-full h-full flex items-center justify-center p-0.5 select-none overflow-hidden bg-transparent font-sans">
      <div
        onClick={state === "Listening" ? stopAndPaste : undefined}
        title={state === "Listening" ? "Listening & Typing Live... Click to Stop & Finalize" : undefined}
        className={`w-full h-[30px] bg-[var(--surface-primary)] border rounded-full px-3 flex items-center justify-center transition-all duration-150 cursor-pointer shadow-md ${
          state === "Listening"
            ? "border-[var(--accent)] shadow-[0_0_12px_rgba(69,184,166,0.35)]"
            : isProcessing
            ? "border-[var(--warning)] shadow-[0_0_10px_rgba(216,168,78,0.25)]"
            : isSuccess
            ? "border-[var(--success)] shadow-[0_0_10px_rgba(105,194,139,0.25)]"
            : isError
            ? "border-[var(--error)] shadow-[0_0_10px_rgba(217,107,107,0.25)]"
            : "border-[var(--border)]"
        }`}
      >
        {/* Dynamic Voice Reacting Soundwave Bars */}
        <div className="flex items-center justify-center gap-[2.5px] h-[18px]">
          {isSuccess ? (
            <Check className="w-3.5 h-3.5 text-[var(--success)] stroke-[2.5]" />
          ) : isError ? (
            <AlertCircle className="w-3.5 h-3.5 text-[var(--error)] stroke-[2.5]" />
          ) : (
            barMultipliers.map((mult, i) => {
              const minHeight = 3;
              const maxHeight = 16;
              const dynamicHeight = state === "Listening"
                ? Math.max(minHeight, Math.min(maxHeight, Math.round(minHeight + (audioLevel * mult + 0.12) * (maxHeight - minHeight))))
                : isProcessing
                ? Math.round(minHeight + ((Math.sin((Date.now() / 140) + i) + 1) / 2) * (maxHeight - minHeight))
                : minHeight;

              return (
                <div
                  key={i}
                  className={`w-[2.5px] rounded-full transition-all duration-75 ease-out ${
                    state === "Listening"
                      ? "bg-[var(--accent)] shadow-[0_0_3px_var(--accent)]"
                      : isProcessing
                      ? "bg-[var(--warning)] opacity-90"
                      : "bg-[var(--text-muted)] opacity-40"
                  }`}
                  style={{
                    height: `${dynamicHeight}px`,
                  }}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};


