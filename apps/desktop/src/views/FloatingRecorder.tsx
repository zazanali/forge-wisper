import React, { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import type { ProcessingState, AppSettings } from "../types";
import { Mic, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

export const FloatingRecorder: React.FC = () => {
  const [state, setState] = useState<ProcessingState>("Idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    api.getProcessingState().then(setState).catch(console.error);
    api.getSettings().then(setSettings).catch(console.error);

    const unlistenState = api.onStateChange(({ state: newState, error }) => {
      setState(newState);
      setErrorMsg(error || null);
    });

    return () => {
      unlistenState.then((fn) => fn());
    };
  }, []);

  const isGroq = settings?.provider === "groq";
  const isLocal = settings?.provider === "local-whisper";

  return (
    <div className="w-full h-full flex items-center justify-center p-1 select-none">
      <div className="w-full h-14 bg-[#1C1B1B]/95 backdrop-blur-xl border border-white/10 rounded-surface shadow-2xl px-4 flex items-center justify-between text-forge-text transition-all duration-300">
        <div className="flex items-center gap-3">
          {/* Animated Status Icon */}
          {state === "Listening" && (
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-forge-strong opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-forge-strong"></span>
            </div>
          )}

          {(state === "Stopping" ||
            state === "Transcribing" ||
            state === "Cleaning" ||
            state === "Structuring" ||
            state === "Verifying" ||
            state === "Inserting") && (
            <Loader2 className="w-4 h-4 text-forge-accent animate-spin" />
          )}

          {state === "Success" && (
            <CheckCircle2 className="w-4 h-4 text-forge-success" />
          )}

          {state === "Error" && (
            <AlertCircle className="w-4 h-4 text-forge-error" />
          )}

          {state === "Idle" && <Mic className="w-4 h-4 text-forge-muted" />}

          {/* Status Text & Dynamic Waveform */}
          <div className="flex flex-col">
            <span className="text-xs font-medium tracking-wide">
              {state === "Listening" && "Listening..."}
              {state === "Stopping" && "Stopping..."}
              {state === "Transcribing" && "Transcribing..."}
              {state === "Cleaning" && "Forging text..."}
              {state === "Structuring" && "Structuring..."}
              {state === "Verifying" && "Verifying..."}
              {state === "Inserting" && "Pasting..."}
              {state === "Success" && "✓ Inserted"}
              {state === "Error" && (errorMsg || "Processing Failed")}
              {state === "Idle" && "Ready"}
              {state === "Cancelled" && "Cancelled"}
            </span>

            {state === "Listening" && (
              <div className="flex items-center gap-0.5 mt-1 h-2">
                {[40, 70, 100, 60, 90, 50, 80].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-forge-accent rounded-full animate-wave"
                    style={{
                      height: `${h}%`,
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Engine Privacy Badge (§60) */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/40 border border-white/5 text-[10px] font-mono text-forge-muted">
          {isGroq && (
            <>
              <span className="text-amber-400">⚡</span>
              <span>GROQ</span>
            </>
          )}
          {isLocal && (
            <>
              <span className="text-emerald-400">●</span>
              <span>LOCAL</span>
            </>
          )}
          {!isGroq && !isLocal && (
            <>
              <Sparkles className="w-2.5 h-2.5 text-forge-accent" />
              <span>MOCK</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
