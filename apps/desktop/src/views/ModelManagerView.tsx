import React, { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import { useAppStore, appStore } from "../state/appStore";
import type {
  HardwareRecommendation,
  LocalModelInfo,
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
import { Card, Badge } from "../components/ui";

export const ModelManagerView: React.FC = () => {
  const { settings, backendStatus } = useAppStore();
  const [models, setModels] = useState<LocalModelInfo[]>([]);
  const [rec, setRec] = useState<HardwareRecommendation | null>(null);
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
      const [m, r] = await Promise.all([
        api.listModels(),
        api.getHardwareRecommendation(),
      ]);
      setModels(m);
      setRec(r);

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
      if (settings?.provider === "local-whisper") {
        const activeInstalled = m.find((item) => item.id === settings.model && item.is_installed);
        if (!activeInstalled) {
          const firstInstalled = m.find((item) => item.is_installed);
          if (firstInstalled) {
            await appStore.patchSettings({ model: firstInstalled.id });
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
      await appStore.patchSettings({
        provider: "local-whisper",
        model: id,
      });
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
    try {
      await appStore.patchSettings({
        provider: "local-whisper",
        model: modelId,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const getModelBadge = (model: LocalModelInfo) => {
    if (model.tier_tag) {
      return {
        label: model.tier_tag,
        color: "text-[var(--accent)] bg-[var(--accent-subtle)] border-[var(--accent-border)] font-semibold",
      };
    }
    switch (model.id) {
      case "parakeet-v3-int8":
        return {
          label: "Fast Local",
          color: "text-[var(--accent)] bg-[var(--accent-subtle)] border-[var(--accent-border)] font-semibold",
        };
      case "tiny":
        return {
          label: "Ultra Fast",
          color: "text-[var(--text-secondary)] bg-[var(--surface-elevated)] border-[var(--border)]",
        };
      case "base":
        return {
          label: "Everyday Dictation",
          color: "text-[var(--accent)] bg-[var(--accent-subtle)] border-[var(--accent-border)]",
        };
      case "small":
        return {
          label: "Optimal Balance",
          color: "text-[var(--accent)] bg-[var(--accent-subtle)] border-[var(--accent-border)]",
        };
      case "medium":
        return {
          label: "High Precision",
          color: "text-[var(--warning)] bg-[var(--warning-bg)] border-[var(--warning-border)]",
        };
      case "large-v3-turbo":
        return {
          label: "Turbo + Max Accuracy",
          color: "text-[var(--accent)] bg-[var(--accent-subtle)] border-[var(--accent-border)]",
        };
      case "large-v3":
        return {
          label: "Studio Precision",
          color: "text-[var(--text-primary)] bg-[var(--surface-elevated)] border-[var(--border)]",
        };
      default:
        return {
          label: "General",
          color: "text-[var(--text-secondary)] bg-[var(--surface-elevated)] border-[var(--border)]",
        };
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn font-sans w-full pb-12">
      {/* Header with Privacy Badge and GPU Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-medium text-[var(--text-primary)] tracking-tight">
            Local Speech Models
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Download and manage offline models (Whisper GGML & Fast Parakeet ONNX) for 100% private transcription.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {backendStatus?.is_vulkan_available ? (
            <Badge variant="accent" size="sm" hasDot>
              Vulkan GPU Enabled
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm">
              CPU Mode
            </Badge>
          )}
          <Badge variant="success" size="sm" hasDot>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>100% Offline & Private</span>
          </Badge>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-[var(--error-bg)] border border-[var(--error-border)] rounded-[var(--radius-control)] text-[13px] text-[var(--error)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Hardware Detection Recommendation Banner */}
      {rec && (
        <Card variant="default" padding="md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] text-[var(--accent)] shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-mono font-medium text-[var(--text-primary)]">
                    Hardware Detected:
                  </span>
                  <Badge variant="default" size="sm">
                    {rec.logical_cores} Cores • {rec.estimated_ram_gb} GB RAM
                  </Badge>
                  {rec.recommended_family && (
                    <Badge variant="accent" size="sm">
                      Family: {rec.recommended_family === "parakeet" ? "Fast Parakeet" : "Whisper GGML"}
                    </Badge>
                  )}
                </div>
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                  {rec.reason}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center shrink-0 pl-9 md:pl-0">
              <span className="text-[12px] text-[var(--text-muted)]">Recommended:</span>
              <Badge variant="accent" size="md">
                {rec.recommended_model_name || rec.recommended_model_id}
              </Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Models Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {models.map((model) => {
          const isActive =
            settings?.provider === "local-whisper" &&
            settings?.model === model.id;
          const isRecommended = rec?.recommended_model_id === model.id;

          return (
            <Card
              key={model.id}
              variant={isActive ? "accent" : "default"}
              padding="md"
              className="space-y-3.5 flex flex-col justify-between"
            >
              {/* Card Top Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] text-[var(--accent)] shrink-0 mt-0.5">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-[14px] text-[var(--text-primary)] tracking-tight">
                        {model.name}
                      </h4>
                      {isRecommended && (
                        <Badge variant="accent" size="sm">
                          <Sparkles className="w-2.5 h-2.5" />
                          Recommended
                        </Badge>
                      )}
                      {model.is_default && !isRecommended && (
                        <Badge variant="default" size="sm">
                          Default
                        </Badge>
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
                    <Badge variant="success" size="sm" hasDot>
                      INSTALLED
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      NOT DOWNLOADED
                    </Badge>
                  )}
                </div>
              </div>

              {/* Badges & Spec Chips */}
              <div className="flex items-center gap-2 flex-wrap text-[12px] font-mono">
                {(() => {
                  const badge = getModelBadge(model);
                  return (
                    <span
                      className={`px-2 py-0.5 rounded-[var(--radius-control)] border text-[11px] font-mono font-medium ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  );
                })()}

                <div className="flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border)] text-[11px]">
                  <HardDrive className="w-3 h-3 text-[var(--text-muted)]" />
                  <span>{model.size_mb} MB</span>
                </div>

                <div className="flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border)] text-[11px]">
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
                        Downloading Model...
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
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-control)] bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-[var(--accent)] text-[12px] font-medium font-mono">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Active Engine</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveModel(model.id)}
                        className="px-3 py-1.5 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] text-[12px] font-medium transition-all cursor-pointer"
                      >
                        Use This Model
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => deleteModel(model.id)}
                      className="p-1.5 rounded-[var(--radius-control)] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--error)] transition-all cursor-pointer"
                      title="Delete model to free disk space"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => downloadModel(model.id)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] font-semibold text-[13px] transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Model ({model.size_mb} MB)</span>
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
