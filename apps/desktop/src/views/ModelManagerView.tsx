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
    <div className="space-y-6 animate-fadeIn font-sans">
      {/* Header */}
      <div>
        <h2 className="text-xl font-display font-bold text-[#E8ECF2]">
          Local Whisper Models
        </h2>
        <p className="text-xs text-[#9BA3B5]">
          Download and manage GGML/GGUF model binaries for 100% offline transcription.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-[#FF4D5E]/15 border border-[#FF4D5E]/30 rounded-xl text-xs text-[#FF4D5E] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Hardware Detection Recommendation */}
      {rec && (
        <div className="forge-card p-4 bg-gradient-to-r from-[#3FE3C4]/10 to-transparent border border-[#3FE3C4]/30 rounded-xl flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-[#3FE3C4]/15 text-[#3FE3C4]">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#3FE3C4] font-mono">
                Hardware Detected
              </span>
              <span className="text-xs text-[#9BA3B5] font-mono">
                ({rec.logical_cores} Cores • ~{rec.estimated_ram_gb} GB RAM)
              </span>
            </div>
            <p className="text-xs text-[#E8ECF2]">{rec.reason}</p>
            <div className="pt-1">
              <span className="text-xs text-[#9BA3B5]">
                Recommended model:{" "}
              </span>
              <span className="text-xs font-bold text-[#FF4D5E] font-mono uppercase">
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
              className={`forge-card p-4 space-y-3 rounded-xl transition-all ${
                isActive
                  ? "border-[#3FE3C4] bg-[#3FE3C4]/10 shadow-lg shadow-[#3FE3C4]/10"
                  : "border-[#2A2E38] hover:border-[#FF4D5E]/30"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm text-[#E8ECF2] font-display">
                      {model.name}
                    </h4>
                    {model.is_default && (
                      <span className="px-2 py-0.5 rounded-md bg-[#1C2028] text-[10px] text-[#9BA3B5] font-mono">
                        Default
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#5C6478] font-mono">
                    {model.filename}
                  </span>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                      model.is_installed
                        ? "bg-[#3FE3C4]/15 text-[#3FE3C4] border border-[#3FE3C4]/30"
                        : "bg-[#1C2028] text-[#5C6478]"
                    }`}
                  >
                    {model.is_installed ? "INSTALLED" : "NOT DOWNLOADED"}
                  </span>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs text-[#9BA3B5] font-mono bg-[#0C0E14] p-2.5 rounded-xl border border-[#2A2E38]">
                <div className="flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-[#5C6478]" />
                  <span>{model.size_mb} MB</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#5C6478]" />
                  <span>~{model.ram_estimate_mb} MB RAM</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                {model.is_installed ? (
                  <div className="flex items-center gap-2 w-full justify-between">
                    <button
                      onClick={() => setActiveModel(model.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        isActive
                          ? "bg-[#3FE3C4] text-[#0A0C10] shadow-md shadow-[#3FE3C4]/20"
                          : "btn-outline text-[#E8ECF2]"
                      }`}
                    >
                      {isActive ? "Active Model ✓" : "Select Model"}
                    </button>

                    <button
                      onClick={() => deleteModel(model.id)}
                      className="p-2 rounded-xl hover:bg-[#FF4D5E]/20 text-[#5C6478] hover:text-[#FF4D5E] transition-colors"
                      title="Delete local file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => downloadModel(model.id)}
                    disabled={downloadingId === model.id}
                    className="w-full py-2.5 btn-blade rounded-xl text-xs font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
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
