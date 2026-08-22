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
    <div className="space-y-6 animate-fadeIn font-sans">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-[#E8ECF2]">
            Dictation History
          </h2>
          <p className="text-xs text-[#9BA3B5]">
            Search, copy raw/final text, or reprocess previous dictations.
          </p>
        </div>

        {records.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C2028] hover:bg-[#FF4D5E]/20 text-xs text-[#9BA3B5] hover:text-[#FF4D5E] border border-[#2A2E38] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#5C6478] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search transcripts by keyword..."
          className="w-full pl-10 pr-4 py-2.5 bg-[#151820] border border-[#2A2E38] rounded-xl text-sm text-[#E8ECF2] placeholder:text-[#5C6478] focus:outline-none focus:border-[#FF4D5E] transition-colors"
        />
      </div>

      {/* Records Table / Cards */}
      {records.length === 0 ? (
        <div className="forge-card p-12 text-center text-[#5C6478] text-sm rounded-xl">
          No history items match your search.
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((item) => (
            <div
              key={item.id}
              className="forge-card p-4 space-y-3 rounded-xl border border-[#2A2E38] hover:border-[#FF4D5E]/30 transition-all"
            >
              {/* Top metadata row */}
              <div className="flex items-center justify-between text-xs text-[#9BA3B5] font-mono">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#5C6478]" />
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
                      <Cpu className="w-3 h-3 text-[#3FE3C4]" />
                    )}
                    {item.provider_id} / {item.model_name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold font-mono ${
                      item.verification_status === "Pass"
                        ? "bg-[#3FE3C4]/15 text-[#3FE3C4] border border-[#3FE3C4]/30"
                        : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {item.verification_status}
                  </span>
                </div>
              </div>

              {/* Text content */}
              <div className="space-y-1 text-sm">
                <div className="text-[#E8ECF2] leading-relaxed">
                  {item.final_text}
                </div>
                {item.raw_text !== item.final_text && (
                  <div className="text-xs text-[#9BA3B5] font-mono bg-[#0C0E14] p-2.5 rounded-xl border border-[#2A2E38]">
                    <span className="text-[#FF4D5E] font-semibold">RAW: </span>
                    {item.raw_text}
                  </div>
                )}
              </div>

              {/* Actions row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-2 border-t border-[#2A2E38] text-xs gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[#5C6478]">Reprocess as:</span>
                  {(["Clean", "Structured", "Smart", "Raw"] as FormattingMode[]).map(
                    (m) => (
                      <button
                        key={m}
                        disabled={reprocessingId === item.id}
                        onClick={() => reprocess(item.id, m)}
                        className="px-2 py-0.5 rounded-lg bg-[#1C2028] hover:bg-[#252A34] text-[#9BA3B5] hover:text-[#FF4D5E] transition-colors disabled:opacity-50 font-medium"
                      >
                        {m}
                      </button>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyText(item.raw_text, `raw-${item.id}`)}
                    className="px-2.5 py-1 rounded-lg bg-[#1C2028] hover:bg-[#252A34] text-[#9BA3B5] hover:text-[#E8ECF2] transition-colors inline-flex items-center gap-1 font-medium"
                    title="Copy Raw Transcript"
                  >
                    {copiedId === `raw-${item.id}` ? (
                      <Check className="w-3.5 h-3.5 text-[#3FE3C4]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Raw
                  </button>

                  <button
                    onClick={() => copyText(item.final_text, `final-${item.id}`)}
                    className="px-2.5 py-1 rounded-lg bg-[#FF4D5E]/15 hover:bg-[#FF4D5E]/25 text-[#FF4D5E] border border-[#FF4D5E]/30 transition-colors inline-flex items-center gap-1 font-bold"
                    title="Copy Final Text"
                  >
                    {copiedId === `final-${item.id}` ? (
                      <Check className="w-3.5 h-3.5 text-[#3FE3C4]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Final
                  </button>

                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1 rounded-lg hover:bg-[#FF4D5E]/20 text-[#5C6478] hover:text-[#FF4D5E] transition-colors"
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
