import React, { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import type {
  HardwareRecommendation,
  LocalModelInfo,
  AppSettings,
} from "../types";
import {
  Download,
  Trash2,
  Loader2,
  HardDrive,
  Cpu,
  AlertCircle,
} from "lucide-react";

export const ModelManagerView: React.FC = () => {
  const [models, setModels] = useState<LocalModelInfo[]>([]);
  const [rec, setRec] = useState<HardwareRecommendation | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const m = await api.listModels();
      setModels(m);
      const r = await api.getHardwareRecommendation();
      setRec(r);
      const s = await api.getSettings();
      setSettings(s);
    } catch (e) {
      console.error(e);
    }
  };

  const downloadModel = async (id: string) => {
    try {
      setDownloadingId(id);
      setErrorMsg(null);
      await api.downloadModel(id);
      await loadModels();
    } catch (e) {
      setErrorMsg(`Download failed: ${e}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const deleteModel = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this downloaded model?")) {
      try {
        await api.deleteModel(id);
        await loadModels();
      } catch (e) {
        setErrorMsg(`Delete failed: ${e}`);
      }
    }
  };

  const setActiveModel = async (modelId: string) => {
    if (!settings) return;
    try {
      const updated = {
        ...settings,
        provider: "local-whisper",
        model: modelId,
      };
      await api.updateSettings(updated);
      setSettings(updated);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h2 className="text-xl font-display font-bold text-forge-text">
          Local Whisper Models (§85)
        </h2>
        <p className="text-xs text-forge-muted">
          Download and manage GGML/GGUF model binaries for 100% offline transcription.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-950/80 border border-red-800/40 rounded-md text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Hardware Detection Recommendation (§17) */}
      {rec && (
        <div className="forge-card p-4 bg-gradient-to-r from-emerald-950/20 to-transparent border border-emerald-800/30 flex items-start gap-4">
          <div className="p-2 rounded-md bg-emerald-900/40 text-emerald-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
                Hardware Detected
              </span>
              <span className="text-xs text-forge-muted font-mono">
                ({rec.logical_cores} Cores • ~{rec.estimated_ram_gb} GB RAM)
              </span>
            </div>
            <p className="text-xs text-forge-text">{rec.reason}</p>
            <div className="pt-1">
              <span className="text-xs text-forge-muted">
                Recommended model:{" "}
              </span>
              <span className="text-xs font-semibold text-forge-accent font-mono uppercase">
                Whisper {rec.recommended_model_id}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Models Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map((model) => {
          const isActive =
            settings?.provider === "local-whisper" &&
            settings?.model === model.id;

          return (
            <div
              key={model.id}
              className={`forge-card p-4 space-y-3 transition-colors ${
                isActive
                  ? "border-emerald-500/50 bg-emerald-950/10"
                  : "border-white/5"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm text-forge-text">
                      {model.name}
                    </h4>
                    {model.is_default && (
                      <span className="px-1.5 py-0.2 rounded bg-white/10 text-[10px] text-forge-muted">
                        Default
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-forge-muted font-mono">
                    {model.filename}
                  </span>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono ${
                      model.is_installed
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                        : "bg-white/5 text-forge-muted"
                    }`}
                  >
                    {model.is_installed ? "INSTALLED" : "NOT DOWNLOADED"}
                  </span>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs text-forge-muted font-mono bg-black/30 p-2 rounded border border-white/5">
                <div className="flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>{model.size_mb} MB</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>~{model.ram_estimate_mb} MB RAM</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                {model.is_installed ? (
                  <div className="flex items-center gap-2 w-full justify-between">
                    <button
                      onClick={() => setActiveModel(model.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-emerald-600 text-white"
                          : "bg-white/5 hover:bg-white/10 text-forge-text"
                      }`}
                    >
                      {isActive ? "Active Model" : "Select Model"}
                    </button>

                    <button
                      onClick={() => deleteModel(model.id)}
                      className="p-1.5 rounded hover:bg-forge-error/20 text-forge-muted hover:text-forge-error transition-colors"
                      title="Delete local file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => downloadModel(model.id)}
                    disabled={downloadingId === model.id}
                    className="w-full py-2 bg-forge-strong hover:bg-forge-strong/90 rounded-md text-xs font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2 shadow-glow"
                  >
                    {downloadingId === model.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Downloading (~{model.size_mb} MB)...
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        Download ({model.size_mb} MB)
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
