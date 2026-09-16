import React from "react";
import type { UpdateInfo } from "../types";
import { Sparkles, ArrowRight, X } from "lucide-react";

interface UpdateBannerProps {
  updateInfo: UpdateInfo;
  onOpenModal: () => void;
  onDismiss: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  updateInfo,
  onOpenModal,
  onDismiss,
}) => {
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[95vw] sm:max-w-xl w-full px-2 animate-fadeIn">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--accent)]/50 shadow-2xl backdrop-blur-md text-[13px] font-sans">
        {/* Left: Glowing Icon & Update Tag */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent)] shrink-0 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--text-primary)] text-[12px] sm:text-[13px] truncate">
                Update Available
              </span>
              <span className="px-1.5 py-0.2 rounded-[4px] bg-[var(--accent-subtle)] text-[var(--accent)] font-mono text-[10px] font-bold border border-[var(--accent-border)]">
                {updateInfo.latest_version}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] truncate hidden sm:block">
              {updateInfo.release_title || "New features and performance optimizations ready."}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenModal}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] font-semibold text-[11px] sm:text-[12px] transition-all cursor-pointer shadow-xs"
          >
            <span>Update Now</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-[5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
            title="Dismiss update banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
