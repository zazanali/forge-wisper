import React, { useState, useEffect } from "react";
import type { UpdateInfo, UpdateDownloadProgress } from "../types";
import { api } from "../lib/tauri";
import {
  Sparkles,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  RotateCcw,
  Loader2,
  Package,
} from "lucide-react";

interface UpdateModalProps {
  updateInfo: UpdateInfo;
  isOpen: boolean;
  onClose: () => void;
}

type UpdateStatus = "idle" | "downloading" | "ready" | "error";

export const UpdateModal: React.FC<UpdateModalProps> = ({
  updateInfo,
  isOpen,
  onClose,
}) => {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [progress, setProgress] = useState<UpdateDownloadProgress>({
    percentage: 0,
    downloaded_bytes: 0,
    total_bytes: 0,
  });
  const [installerPath, setInstallerPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const unlisten = api.onUpdateDownloadProgress((p) => {
      setProgress(p);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartDownload = async () => {
    setStatus("downloading");
    setErrorMessage(null);
    try {
      const path = await api.downloadAndApplyUpdate(
        updateInfo.download_url,
        updateInfo.asset_name
      );
      setInstallerPath(path);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to download update:", err);
      setErrorMessage(String(err));
      setStatus("error");
    }
  };

  const handleInstallAndRestart = async () => {
    if (!installerPath) return;
    try {
      await api.relaunchAndInstallUpdate(installerPath);
    } catch (err) {
      console.error("Failed to launch installer:", err);
      setErrorMessage(String(err));
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 MB";
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn select-none font-sans">
      <div
        className="w-full max-w-lg bg-[var(--surface-primary)] border border-[var(--border)] rounded-[12px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Brand Gradient & Close */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] bg-[var(--surface-elevated)] flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-[8px] bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-[var(--accent)] shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight">
                  New Version Available
                </h3>
                <span className="px-2 py-0.5 rounded-[4px] bg-[var(--accent-subtle)] text-[var(--accent)] font-mono text-[11px] font-bold border border-[var(--accent-border)]">
                  {updateInfo.latest_version}
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                Current: <span className="font-mono">{updateInfo.current_version}</span>
                {updateInfo.published_at && (
                  <> · Released {new Date(updateInfo.published_at).toLocaleDateString()}</>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--border)] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Changelog & Release Notes */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Release Title Banner */}
          <div className="p-3 rounded-[8px] bg-[var(--surface-elevated)] border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
              Release Highlight
            </span>
            <div className="text-[13px] font-medium text-[var(--text-primary)]">
              {updateInfo.release_title || `Forge Wisper ${updateInfo.latest_version}`}
            </div>
            {updateInfo.asset_size_bytes > 0 && (
              <div className="text-[11px] text-[var(--text-secondary)] font-mono flex items-center gap-1 pt-1">
                <Package className="w-3 h-3 text-[var(--text-muted)]" />
                <span>Installer Size: {formatBytes(updateInfo.asset_size_bytes)}</span>
              </div>
            )}
          </div>

          {/* Changelog Notes Box */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono text-[var(--accent)] font-semibold uppercase tracking-wider block">
              What's New in this Version
            </span>
            <div className="p-3.5 rounded-[8px] bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[12px] sm:text-[13px] text-[var(--text-primary)] font-sans max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {updateInfo.release_notes || "Performance enhancements, bug fixes, and reliability improvements."}
            </div>
          </div>

          {/* Progress Bar View (When Downloading) */}
          {status === "downloading" && (
            <div className="p-4 rounded-[8px] bg-[var(--surface-elevated)] border border-[var(--accent)]/30 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between text-[12px] font-mono">
                <span className="flex items-center gap-2 text-[var(--accent)] font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading Update...</span>
                </span>
                <span className="text-[var(--text-primary)] font-bold">
                  {progress.percentage}%
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full h-2 bg-[var(--surface-primary)] border border-[var(--border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-all duration-150 ease-out"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
                <span>{formatBytes(progress.downloaded_bytes)} of {formatBytes(progress.total_bytes || updateInfo.asset_size_bytes)}</span>
                <span>Streaming directly from GitHub</span>
              </div>
            </div>
          )}

          {/* Success Ready State */}
          {status === "ready" && (
            <div className="p-4 rounded-[8px] bg-[var(--success-bg)] border border-[var(--success-border)] space-y-2 text-center animate-fadeIn">
              <div className="flex items-center justify-center gap-2 text-[var(--success)] font-semibold text-[14px]">
                <CheckCircle2 className="w-5 h-5" />
                <span>Update Download Complete!</span>
              </div>
              <p className="text-[12px] text-[var(--text-primary)] leading-relaxed">
                Forge Wisper is ready to update. Clicking &quot;Restart &amp; Install&quot; will apply the update cleanly and reopen the app.
              </p>
            </div>
          )}

          {/* Error State */}
          {status === "error" && (
            <div className="p-3 rounded-[8px] bg-[var(--error-bg)] border border-[var(--error-border)] text-[12px] text-[var(--error)] flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Download error:</span>
                <span className="text-[11px] font-mono">{errorMessage || "Failed to download installer"}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => api.openUrl("https://github.com/zazanali/forge-wisper/releases/latest")}
            className="text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <span>View GitHub Release</span>
            <ExternalLink className="w-3 h-3" />
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {status !== "ready" && (
              <button
                type="button"
                onClick={onClose}
                disabled={status === "downloading"}
                className="px-3 py-1.5 rounded-[6px] text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-colors disabled:opacity-50 cursor-pointer w-full sm:w-auto"
              >
                Remind Me Later
              </button>
            )}

            {status === "idle" && (
              <button
                type="button"
                onClick={handleStartDownload}
                className="px-4 py-1.5 rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-[12px] font-semibold transition-all shadow-xs inline-flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download &amp; Install</span>
              </button>
            )}

            {status === "error" && (
              <button
                type="button"
                onClick={handleStartDownload}
                className="px-4 py-1.5 rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-[12px] font-semibold transition-all shadow-xs inline-flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Download</span>
              </button>
            )}

            {status === "ready" && (
              <button
                type="button"
                onClick={handleInstallAndRestart}
                className="px-4 py-1.5 rounded-[6px] bg-[var(--success)] hover:opacity-90 text-white text-[12px] font-semibold transition-all shadow-xs inline-flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart &amp; Install Now</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
