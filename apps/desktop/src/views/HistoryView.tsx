import React, { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import type { HistoryRecord, FormattingMode } from "../types";
import {
  Search,
  Trash2,
  Copy,
  Check,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

export const HistoryView: React.FC = () => {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => {
    loadHistory();
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  const loadHistory = async () => {
    try {
      const data = await api.listHistory(100, searchQuery.trim() || undefined);
      setRecords(data);
    } catch (e) {
      console.error(e);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const deleteItem = async (id: string) => {
    try {
      await api.deleteHistoryItem(id);
      loadHistory();
    } catch (e) {
      console.error(e);
    }
  };

  const clearAll = async () => {
    if (window.confirm("Are you sure you want to clear all dictation history?")) {
      try {
        await api.clearHistory();
        loadHistory();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const reprocess = async (id: string, mode: FormattingMode) => {
    try {
      setReprocessingId(id);
      const newText = await api.reprocessHistoryItem(id, mode);
      navigator.clipboard.writeText(newText);
      alert(`Reprocessed as ${mode} and copied to clipboard:\n\n${newText}`);
    } catch (e) {
      alert(`Reprocess error: ${e}`);
    } finally {
      setReprocessingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(records.length / itemsPerPage));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const currentRecords = records.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-5 animate-fadeIn font-sans w-full pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-medium text-[var(--text-primary)] tracking-tight">
            Dictation History
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Search, copy raw/final text, or reprocess previous dictations.
          </p>
        </div>

        {records.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[var(--surface-elevated)] hover:bg-[var(--error-bg)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--error)] border border-[var(--border)] hover:border-[var(--error-border)] transition-colors font-medium cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search transcripts by keyword..."
          className="w-full pl-10 pr-4 py-2 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[7px] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* Records Table / Cards */}
      {records.length === 0 ? (
        <div className="forge-card p-10 text-center text-[var(--text-muted)] text-[13px] rounded-[8px] border border-[var(--border)] bg-[var(--surface-primary)]">
          No history items match your search.
        </div>
      ) : (
        <div className="space-y-2.5">
          {currentRecords.map((item) => (
            <div
              key={item.id}
              className="forge-card p-3.5 space-y-2.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface-primary)] transition-all"
            >
              {/* Top metadata row */}
              <div className="flex items-center justify-between text-[12px] text-[var(--text-secondary)] font-sans">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>
                    {new Date(item.created_at).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>·</span>
                  <span className="capitalize">{item.provider_id === "local-whisper" ? "Local" : "Groq"}</span>
                  <span>·</span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">{item.model_name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium font-sans ${
                      item.verification_status === "Pass"
                        ? "bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success-border)]"
                        : "bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning-border)]"
                    }`}
                  >
                    {item.verification_status}
                  </span>
                </div>
              </div>

              {/* Text content */}
              <div className="space-y-2">
                <div className="text-[15px] sm:text-[16px] font-sans font-normal text-[var(--text-primary)] leading-relaxed">
                  {item.final_text}
                </div>
                {item.raw_text !== item.final_text && (
                  <div className="text-[12px] text-[var(--text-secondary)] font-sans bg-[var(--surface-elevated)] p-2 rounded-[6px] border border-[var(--border-subtle)]">
                    <span className="text-[var(--accent)] font-medium font-mono">RAW: </span>
                    {item.raw_text}
                  </div>
                )}
              </div>

              {/* Actions row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-[12px] gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[var(--text-muted)]">Reprocess:</span>
                  {(["Clean", "Structured", "Smart", "Raw"] as FormattingMode[]).map(
                    (m) => (
                      <button
                        key={m}
                        disabled={reprocessingId === item.id}
                        onClick={() => reprocess(item.id, m)}
                        className="px-2 py-0.5 rounded-[5px] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors disabled:opacity-50 font-medium cursor-pointer"
                      >
                        {m}
                      </button>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyText(item.raw_text, `raw-${item.id}`)}
                    className="px-2.5 py-1 rounded-[6px] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors inline-flex items-center gap-1 font-medium cursor-pointer"
                    title="Copy Raw Transcript"
                  >
                    {copiedId === `raw-${item.id}` ? (
                      <Check className="w-3.5 h-3.5 text-[var(--success)]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Raw
                  </button>

                  <button
                    onClick={() => copyText(item.final_text, `final-${item.id}`)}
                    className="px-2.5 py-1 rounded-[6px] bg-[var(--accent-subtle)] hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)] text-[var(--accent)] border border-[var(--accent-border)] transition-colors inline-flex items-center gap-1 font-medium cursor-pointer"
                    title="Copy Final Text"
                  >
                    {copiedId === `final-${item.id}` ? (
                      <Check className="w-3.5 h-3.5 text-[var(--success)]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Final
                  </button>

                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1 rounded-[5px] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors cursor-pointer"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination Controls */}
          {records.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] font-mono">
              <div className="flex items-center gap-3">
                <span>
                  Showing <strong className="text-[var(--text-primary)]">{records.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + itemsPerPage, records.length)}</strong> of <strong className="text-[var(--text-primary)]">{records.length}</strong>
                </span>
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-[var(--text-muted)] text-[11px]">Per page:</span>
                  {[5, 10, 20].map((size) => (
                    <button
                      key={size}
                      onClick={() => setItemsPerPage(size)}
                      className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium transition-colors cursor-pointer ${
                        itemsPerPage === size
                          ? "bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] font-semibold"
                          : "bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={validCurrentPage === 1}
                  className="p-1.5 rounded-[6px] bg-[var(--surface-primary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="First Page"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={validCurrentPage === 1}
                  className="p-1.5 rounded-[6px] bg-[var(--surface-primary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {/* Page number buttons */}
                <div className="flex items-center gap-1 mx-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - validCurrentPage) <= 1)
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="text-[var(--text-muted)] px-1">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`min-w-[26px] h-6 px-1.5 rounded-[5px] text-[11px] font-medium transition-all cursor-pointer ${
                            validCurrentPage === p
                              ? "bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] font-semibold"
                              : "bg-[var(--surface-primary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    ))}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage === totalPages}
                  className="p-1.5 rounded-[6px] bg-[var(--surface-primary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={validCurrentPage === totalPages}
                  className="p-1.5 rounded-[6px] bg-[var(--surface-primary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Last Page"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

