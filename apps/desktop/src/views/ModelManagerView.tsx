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
  Check,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

export const ModelManagerView: React.FC = () => {
  const [models, setModels] = useState<LocalModelInfo[]>([]);
  const [rec, setRec] = useState<HardwareRecommendation | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<
    Record<string, { downloaded: number; total: number; percentage: number }>
  >({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadModels();

    const unlisten = api.onModelDownloadProgress((payload) => {
      setDownloadProgress((prev) => ({
        ...prev,
        [payload.model_id]: {
          downloaded: payload.downloaded_bytes,
          total: payload.total_bytes,
          percentage: payload.percentage,
        },
      }));

      // When download finishes, remove from progress tracker and refresh models list
      if (payload.percentage >= 100) {
        setTimeout(() => {
          setDownloadProgress((prev) => {
            const copy = { ...prev };
            delete copy[payload.model_id];
            return copy;
          });
          loadModels();
        }, 500);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const loadModels = async () => {
    try {
      const m = await api.listModels();
      setModels(m);
      const r = await api.getHardwareRecommendation();
      setRec(r);
      const s = await api.getSettings();
      setSettings(s);

      // Check active backend downloads to restore progress if user navigated away and returned
      const activeDownloads = await api.getActiveModelDownloads();
      if (activeDownloads && Object.keys(activeDownloads).length > 0) {
        setDownloadProgress((prev) => {
          const updated = { ...prev };
          for (const [mid, info] of Object.entries(activeDownloads)) {
            updated[mid] = {
              downloaded: info.downloaded_bytes,
              total: info.total_bytes,
              percentage: info.percentage,
            };
          }
          return updated;
        });
      }

      // Auto-pick: If user is using local-whisper and active model is not downloaded, auto-select installed model
      if (s.provider === "local-whisper") {
        const activeInstalled = m.find((item) => item.id === s.model && item.is_installed);
        if (!activeInstalled) {
          const firstInstalled = m.find((item) => item.is_installed);
          if (firstInstalled) {
            const updated = { ...s, model: firstInstalled.id };
            await api.updateSettings(updated);
            setSettings(updated);
          }
        }
      }
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

      // Automatically activate the newly downloaded model for immediate use
      if (settings) {
        const updated: AppSettings = {
          ...settings,
          provider: "local-whisper",
          model: id,
        };
        await api.updateSettings(updated);
        setSettings(updated);
      }
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

  const getModelBadge = (id: string) => {
    switch (id) {
      case "tiny":
        return { label: "Ultra Fast", color: "text-[var(--text-secondary)] bg-[var(--surface-elevated)] border-[var(--border)]" };
      case "base":
        return { label: "Everyday Dictation", color: "text-[var(--accent)] bg-[var(--accent-subtle)] border-[var(--accent-border)]" };
      case "small":
        return { label: "Optimal Balance", color: "text-[var(--accent)] bg-[var(--accent-subtle)] border-[var(--accent-border)]" };
      case "medium":
        return { label: "High Precision", color: "text-[var(--warning)] bg-[var(--warning-bg)] border-[var(--warning-border)]" };
      case "large-v3-turbo":
        return { label: "Turbo + Max Accuracy", color: "text-[var(--accent)] bg-[var(--accent-subtle)] border-[var(--accent-border)]" };
      case "large-v3":
        return { label: "Studio Precision", color: "text-[var(--text-primary)] bg-[var(--surface-elevated)] border-[var(--border)]" };
      default:
        return { label: "General", color: "text-[var(--text-secondary)] bg-[var(--surface-elevated)] border-[var(--border)]" };
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn font-sans w-full pb-12">
      {/* Header with Privacy Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-medium text-[var(--text-primary)] tracking-tight">
            Local Whisper Models
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Download and manage GGML model binaries for 100% offline transcription.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[var(--surface-elevated)] border border-[var(--border)] text-[12px] text-[var(--accent)] font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>100% Offline & Private</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-[var(--error-bg)] border border-[var(--error-border)] rounded-[7px] text-[13px] text-[var(--error)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Hardware Detection Recommendation Banner */}
      {rec && (
        <div className="forge-card p-4 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[8px]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-[6px] bg-[var(--surface-elevated)] text-[var(--accent)] shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-mono font-medium text-[var(--text-primary)]">
                    Hardware Detected:
                  </span>
                  <span className="px-1.5 py-0.5 rounded-[4px] bg-[var(--surface-elevated)] text-[11px] text-[var(--text-secondary)] font-mono border border-[var(--border)]">
                    {rec.logical_cores} Cores • {rec.estimated_ram_gb} GB RAM
                  </span>
                </div>
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                  {rec.reason}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center shrink-0 pl-9 md:pl-0">
              <span className="text-[12px] text-[var(--text-muted)]">Recommended:</span>
              <span className="px-2.5 py-1 rounded-[6px] bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] text-[12px] font-mono font-medium">
                Whisper {rec.recommended_model_id}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Models Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {models.map((model) => {
          const isActive =
            settings?.provider === "local-whisper" &&
            settings?.model === model.id;
          const isRecommended = rec?.recommended_model_id === model.id;

          return (
            <div
              key={model.id}
              className={`forge-card p-4 space-y-3.5 rounded-[8px] transition-all bg-[var(--surface-primary)] border flex flex-col justify-between ${
                isActive
                  ? "border-[var(--accent)]"
                  : "border-[var(--border)] hover:border-[var(--border-subtle)]"
              }`}
            >
              {/* Card Top Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-[6px] bg-[var(--surface-elevated)] text-[var(--accent)] shrink-0 mt-0.5">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-[14px] text-[var(--text-primary)] tracking-tight">
                        {model.name}
                      </h4>
                      {isRecommended && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] text-[10px] font-mono font-medium">
                          <Sparkles className="w-2.5 h-2.5" />
                          Recommended
                        </span>
                      )}
                      {model.is_default && !isRecommended && (
                        <span className="px-1.5 py-0.5 rounded-[4px] bg-[var(--surface-elevated)] text-[10px] text-[var(--text-secondary)] font-mono border border-[var(--border)]">
                          Default
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono block truncate">
                      {model.filename}
                    </span>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="shrink-0">
                  {model.is_installed ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-medium bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success-border)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                      INSTALLED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-elevated)] border border-[var(--border)]">
                      NOT DOWNLOADED
                    </span>
                  )}
                </div>
              </div>

              {/* Badges & Spec Chips */}
              <div className="flex items-center gap-2 flex-wrap text-[12px] font-mono">
                {(() => {
                  const badge = getModelBadge(model.id);
                  return (
                    <span className={`px-2 py-0.5 rounded-[4px] border text-[11px] font-mono font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                  );
                })()}

                <div className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border)] text-[11px]">
                  <HardDrive className="w-3 h-3 text-[var(--text-muted)]" />
                  <span>{model.size_mb} MB</span>
                </div>

                <div className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border)] text-[11px]">
                  <Cpu className="w-3 h-3 text-[var(--text-muted)]" />
                  <span>~{model.ram_estimate_mb} MB RAM</span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
                {Boolean(downloadProgress[model.id] || downloadingId === model.id) ? (
                  <div className="w-full space-y-2 py-1">
                    <div className="flex items-center justify-between text-[12px] font-mono">
                      <span className="flex items-center gap-1.5 text-[var(--accent)] font-medium">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        Downloading Binary...
                      </span>
                      <span className="text-[var(--text-secondary)]">
                        {downloadProgress[model.id] && downloadProgress[model.id].total > 0
                          ? `${(downloadProgress[model.id].downloaded / 1024 / 1024).toFixed(1)} / ${(downloadProgress[model.id].total / 1024 / 1024).toFixed(1)} MB (${downloadProgress[model.id].percentage}%)`
                          : `Connecting (~${model.size_mb} MB)...`}
                      </span>
                    </div>

                    <div className="w-full h-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-all duration-150 ease-out"
                        style={{
                          width: `${Math.max(downloadProgress[model.id]?.percentage || 0, 5)}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : model.is_installed ? (
                  <div className="flex items-center justify-between gap-2 w-full">
                    {isActive ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-[var(--accent)] text-[12px] font-medium font-mono">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Active Engine</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveModel(model.id)}
                        className="px-3 py-1.5 rounded-[6px] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] text-[12px] font-medium transition-all cursor-pointer"
                      >
                        Use This Model
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => deleteModel(model.id)}
                      className="p-1.5 rounded-[6px] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--error)] transition-all cursor-pointer"
                      title="Delete model binary to free disk space"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => downloadModel(model.id)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 btn-primary text-[13px] font-medium transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Binary ({model.size_mb} MB)</span>
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

