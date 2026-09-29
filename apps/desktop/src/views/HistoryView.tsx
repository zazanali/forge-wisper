import React, { useEffect, useState, useRef } from "react";
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
  Loader2,
} from "lucide-react";
import { Card, Badge } from "../components/ui";

export const HistoryView: React.FC = () => {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  // Cancellation / out-of-order response prevention sequence counter
  const searchSeqRef = useRef(0);

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch page from backend when page, itemsPerPage, or debouncedSearch changes
  useEffect(() => {
    loadPage();
  }, [currentPage, itemsPerPage, debouncedSearch]);

  const loadPage = async () => {
    const seq = ++searchSeqRef.current;
    setIsLoading(true);

    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const page = await api.getHistoryPage(
        itemsPerPage,
        offset,
        debouncedSearch || undefined
      );

      // Discard stale out-of-order responses
      if (seq === searchSeqRef.current) {
        setRecords(page.records);
        setTotalCount(page.total_count);
      }
    } catch (e) {
      if (seq === searchSeqRef.current) {
        console.error("Failed to load history page:", e);
      }
    } finally {
      if (seq === searchSeqRef.current) {
        setIsLoading(false);
      }
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
      loadPage();
    } catch (e) {
      console.error("Delete history item error:", e);
    }
  };

  const clearAll = async () => {
    if (window.confirm("Are you sure you want to clear all dictation history?")) {
      try {
        await api.clearHistory();
        setCurrentPage(1);
        loadPage();
      } catch (e) {
        console.error("Clear all history error:", e);
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

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalCount);

  return (
    <div className="space-y-5 animate-fadeIn font-sans w-full pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-medium text-[var(--text-primary)] tracking-tight">
            Dictation History
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Search, copy raw/final text, or reprocess previous dictations with server-side pagination.
          </p>
        </div>

        {totalCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] hover:bg-[var(--error-bg)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--error)] border border-[var(--border)] hover:border-[var(--error-border)] transition-colors font-medium cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </button>
        )}
      </div>

      {/* Search Input with Debouncing and Loading Indicator */}
      <div className="relative">
        <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search transcripts by keyword..."
          className="w-full pl-10 pr-10 py-2 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[var(--radius-control)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
        />
        {isLoading && (
          <Loader2 className="w-4 h-4 text-[var(--accent)] absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" />
        )}
      </div>

      {/* Records Table / Cards */}
      {records.length === 0 && !isLoading ? (
        <Card variant="default" padding="lg" className="text-center text-[var(--text-muted)] text-[13px]">
          {debouncedSearch
            ? `No history items matching "${debouncedSearch}".`
            : "No dictations recorded yet."}
        </Card>
      ) : (
        <div className="space-y-2.5">
          {records.map((item) => (
            <Card
              key={item.id}
              variant="default"
              padding="sm"
              className="space-y-2.5 transition-all"
            >
              {/* Top metadata row */}
              <div className="flex flex-wrap items-center justify-between text-[12px] text-[var(--text-secondary)] font-sans gap-2">
                <div className="flex items-center gap-2 flex-wrap">
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
                  <span className="capitalize">
                    {item.provider_id === "local-whisper" ? "Local" : "Groq"}
                  </span>
                  <span>·</span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    {item.model_name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={item.verification_status === "Pass" ? "success" : "warning"}
                    size="sm"
                  >
                    {item.verification_status}
                  </Badge>
                </div>
              </div>

              {/* Text content */}
              <div className="space-y-2">
                <div className="text-[14px] sm:text-[15px] font-sans font-normal text-[var(--text-primary)] leading-relaxed">
                  {item.final_text}
                </div>
                {item.raw_text !== item.final_text && (
                  <div className="text-[12px] text-[var(--text-secondary)] font-sans bg-[var(--surface-elevated)] p-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)]">
                    <span className="text-[var(--accent)] font-medium font-mono">RAW: </span>
                    {item.raw_text}
                  </div>
                )}
              </div>

              {/* Actions row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-[12px] gap-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[var(--text-muted)]">Reprocess:</span>
                  {(["Clean", "Structured", "Smart", "Raw"] as FormattingMode[]).map(
                    (m) => (
                      <button
                        key={m}
                        disabled={reprocessingId === item.id}
                        onClick={() => reprocess(item.id, m)}
                        className="px-2 py-0.5 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors disabled:opacity-50 font-medium cursor-pointer"
                      >
                        {m}
                      </button>
                    )
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => copyText(item.raw_text, `raw-${item.id}`)}
                    className="px-2.5 py-1 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors inline-flex items-center gap-1 font-medium cursor-pointer"
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
                    className="px-2.5 py-1 rounded-[var(--radius-control)] bg-[var(--accent-subtle)] hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)] text-[var(--accent)] border border-[var(--accent-border)] transition-colors inline-flex items-center gap-1 font-medium cursor-pointer"
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
                    className="p-1 rounded-[var(--radius-control)] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors cursor-pointer"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}

          {/* Database-Backed Server Pagination Controls */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] font-mono">
              <div className="flex items-center gap-3">
                <span>
                  Showing{" "}
                  <strong className="text-[var(--text-primary)]">
                    {startIndex + 1}–{endIndex}
                  </strong>{" "}
                  of <strong className="text-[var(--text-primary)]">{totalCount}</strong>
                </span>
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-[var(--text-muted)] text-[11px]">Per page:</span>
                  {[5, 10, 20, 50].map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setItemsPerPage(size);
                        setCurrentPage(1);
                      }}
                      className={`px-2 py-0.5 rounded-[var(--radius-control)] text-[11px] font-medium transition-colors cursor-pointer ${
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

              {/* Page Nav Buttons */}
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => setCurrentPage(1)}
                  className="p-1.5 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  title="First Page"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <span className="px-3 py-1 text-[11px] font-medium text-[var(--text-primary)]">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  disabled={currentPage >= totalPages || isLoading}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={currentPage >= totalPages || isLoading}
                  onClick={() => setCurrentPage(totalPages)}
                  className="p-1.5 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
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
