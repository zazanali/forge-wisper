import React, { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import type { ProcessingState, AppSettings } from "../types";
import { Mic, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

export const FloatingRecorder: React.FC = () => {
  const [state, setState] = useState<ProcessingState>("Idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [durationSecs, setDurationSecs] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  useEffect(() => {
    api.getProcessingState().then(setState).catch(console.error);
    api.getSettings().then(setSettings).catch(console.error);

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

  const isGroq = settings?.provider === "groq";
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
        className={`w-full h-14 bg-[#151820]/95 backdrop-blur-2xl border rounded-2xl shadow-2xl px-4 flex items-center justify-between text-[#E8ECF2] transition-all duration-300 ${
          state === "Listening"
            ? "border-[#FF4D5E] shadow-xl shadow-[#FF4D5E]/20"
            : state === "Success"
            ? "border-[#3FE3C4] shadow-xl shadow-[#3FE3C4]/20"
            : "border-[#2A2E38]"
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Animated Status Icon */}
          {state === "Listening" && (
            <div className="relative flex items-center justify-center">
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
            <Loader2 className="w-4 h-4 text-[#FF4D5E] animate-spin" />
          )}

          {state === "Success" && (
            <CheckCircle2 className="w-4 h-4 text-[#3FE3C4] animate-bounce" />
          )}

          {state === "Error" && (
            <AlertCircle className="w-4 h-4 text-[#FF4D5E]" />
          )}

          {state === "Idle" && <Mic className="w-4 h-4 text-[#5C6478]" />}

          {/* Status Text & Dynamic Reactive Waveform */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wide font-display text-[#E8ECF2]">
                {state === "Listening" && "Listening..."}
                {state === "Stopping" && "Stopping..."}
                {state === "Transcribing" && "Transcribing..."}
                {state === "Cleaning" && "Forging text..."}
                {state === "Structuring" && "Structuring..."}
                {state === "Verifying" && "Verifying..."}
                {state === "Inserting" && "Pasting..."}
                {state === "Success" && "✓ Inserted"}
                {state === "Error" && (errorMsg || "No Speech Detected")}
                {state === "Idle" && "Ready"}
                {state === "Cancelled" && "Cancelled"}
              </span>

              {state === "Listening" && (
                <span className="text-[11px] font-mono text-[#FF4D5E] font-bold">
                  {formatTime(durationSecs)}
                </span>
              )}
            </div>

            {state === "Listening" && (
              <div className="flex items-center gap-1 mt-1 h-3">
                {barMultipliers.map((mult, i) => {
                  const dynamicHeight = Math.max(
                    15,
                    Math.round((audioLevel * mult + 0.15) * 100)
                  );
                  return (
                    <div
                      key={i}
                      className="w-1 bg-gradient-to-t from-[#FF4D5E] to-[#FBBF24] rounded-full transition-all duration-75"
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

        {/* Engine Privacy Badge (§60) */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0C0E14] border border-[#2A2E38] text-[10px] font-mono text-[#9BA3B5]">
          {isGroq && (
            <>
              <span className="text-amber-400">⚡</span>
              <span>GROQ</span>
            </>
          )}
          {isLocal && (
            <>
              <span className="text-[#3FE3C4]">●</span>
              <span className="text-[#3FE3C4]">LOCAL</span>
            </>
          )}
          {!isGroq && !isLocal && (
            <>
              <Sparkles className="w-2.5 h-2.5 text-[#FF4D5E]" />
              <span>MOCK</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
