import React, { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import type { HistoryRecord, FormattingMode } from "../types";
import {
  Search,
  Trash2,
  Copy,
  Check,
  Clock,
  Cpu,
  Zap,
} from "lucide-react";

export const HistoryView: React.FC = () => {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [searchQuery]);

  const loadHistory = async () => {
    try {
      const data = await api.listHistory(50, searchQuery.trim() || undefined);
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
      // Copy reprocessed text to clipboard
      navigator.clipboard.writeText(newText);
      alert(`Reprocessed as ${mode} and copied to clipboard:\n\n${newText}`);
    } catch (e) {
      alert(`Reprocess error: ${e}`);
    } finally {
      setReprocessingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-forge-text">
            Dictation History
          </h2>
          <p className="text-xs text-forge-muted">
            Search, copy raw/final text, or reprocess previous dictations (§52).
          </p>
        </div>

        {records.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 hover:bg-forge-error/20 text-xs text-forge-muted hover:text-forge-error transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-forge-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search transcripts by keyword..."
          className="w-full pl-10 pr-4 py-2.5 bg-forge-surface border border-white/10 rounded-md text-sm text-forge-text placeholder:text-forge-muted focus:outline-none focus:border-forge-accent/40 transition-colors"
        />
      </div>

      {/* Records Table / Cards */}
      {records.length === 0 ? (
        <div className="forge-card p-12 text-center text-forge-muted text-sm">
          No history items match your search.
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((item) => (
            <div
              key={item.id}
              className="forge-card p-4 space-y-3 border border-white/5 hover:border-white/10 transition-colors"
            >
              {/* Top metadata row */}
              <div className="flex items-center justify-between text-xs text-forge-muted font-mono">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {new Date(item.created_at).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    {item.provider_id === "groq" ? (
                      <Zap className="w-3 h-3 text-amber-400" />
                    ) : (
                      <Cpu className="w-3 h-3 text-emerald-400" />
                    )}
                    {item.provider_id} / {item.model_name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                      item.verification_status === "Pass"
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/40"
                        : "bg-amber-950/80 text-amber-400 border border-amber-800/40"
                    }`}
                  >
                    {item.verification_status}
                  </span>
                </div>
              </div>

              {/* Text content */}
              <div className="space-y-1 text-sm">
                <div className="text-forge-text leading-relaxed">
                  {item.final_text}
                </div>
                {item.raw_text !== item.final_text && (
                  <div className="text-xs text-forge-muted font-mono bg-black/30 p-2 rounded border border-white/5">
                    <span className="text-forge-accent/70">RAW: </span>
                    {item.raw_text}
                  </div>
                )}
              </div>

              {/* Actions row */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-forge-muted">Reprocess as:</span>
                  {(["Clean", "Structured", "Smart", "Raw"] as FormattingMode[]).map(
                    (m) => (
                      <button
                        key={m}
                        disabled={reprocessingId === item.id}
                        onClick={() => reprocess(item.id, m)}
                        className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-forge-muted hover:text-forge-accent transition-colors disabled:opacity-50"
                      >
                        {m}
                      </button>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyText(item.raw_text, `raw-${item.id}`)}
                    className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-forge-muted hover:text-forge-text transition-colors inline-flex items-center gap-1"
                    title="Copy Raw Transcript"
                  >
                    {copiedId === `raw-${item.id}` ? (
                      <Check className="w-3.5 h-3.5 text-forge-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Raw
                  </button>

                  <button
                    onClick={() => copyText(item.final_text, `final-${item.id}`)}
                    className="px-2.5 py-1 rounded bg-forge-strong/20 hover:bg-forge-strong/30 text-forge-accent transition-colors inline-flex items-center gap-1"
                    title="Copy Final Text"
                  >
                    {copiedId === `final-${item.id}` ? (
                      <Check className="w-3.5 h-3.5 text-forge-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Final
                  </button>

                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1 rounded hover:bg-forge-error/20 text-forge-muted hover:text-forge-error transition-colors"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
