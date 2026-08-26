import React, { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import type { AppSettings } from "../types";
import {
  BookOpen,
  Plus,
  Trash2,
  Search,
  Sparkles,
  Check,
  Loader2,
  Copy,
  FileText,
  Type,
  Code2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

// Helper for smart sliding-window pagination with ellipsis
function getPaginationRange(currentPage: number, totalPages: number, siblingCount = 1): (number | string)[] {
  const totalPageNumbers = siblingCount * 2 + 5;

  if (totalPages <= totalPageNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const shouldShowLeftDots = leftSiblingIndex > 2;
  const shouldShowRightDots = rightSiblingIndex < totalPages - 2;

  const firstPageIndex = 1;
  const lastPageIndex = totalPages;

  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = 3 + 2 * siblingCount;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, "...", lastPageIndex];
  }

  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = 3 + 2 * siblingCount;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => totalPages - rightItemCount + i + 1
    );
    return [firstPageIndex, "...", ...rightRange];
  }

  if (shouldShowLeftDots && shouldShowRightDots) {
    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i
    );
    return [firstPageIndex, "...", ...middleRange, "...", lastPageIndex];
  }

  return Array.from({ length: totalPages }, (_, i) => i + 1);
}

export const DictionaryView: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"words" | "snippets">("words");
  const [searchQuery, setSearchQuery] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Pagination states
  const [wordPage, setWordPage] = useState(1);
  const [wordsPerPage, setWordsPerPage] = useState(10);

  const [snippetPage, setSnippetPage] = useState(1);
  const [snippetsPerPage, setSnippetsPerPage] = useState(6);

  // New Word Form State
  const [newSpoken, setNewSpoken] = useState("");
  const [newPreferred, setNewPreferred] = useState("");

  // New Snippet Form State
  const [newSnippetTrigger, setNewSnippetTrigger] = useState("");
  const [newSnippetValue, setNewSnippetValue] = useState("");

  // Live Test Box State
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async (updated: AppSettings) => {
    try {
      await api.updateSettings(updated);
      setSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  // Word Dictionary Handlers
  const addDictionaryWord = () => {
    if (!settings || !newSpoken.trim() || !newPreferred.trim()) return;
    const updatedDict = {
      ...settings.dictionary,
      [newSpoken.trim().toLowerCase()]: newPreferred.trim(),
    };
    const updatedSettings = { ...settings, dictionary: updatedDict };
    handleSave(updatedSettings);
    setNewSpoken("");
    setNewPreferred("");
  };

  const removeDictionaryWord = (key: string) => {
    if (!settings) return;
    const updatedDict = { ...settings.dictionary };
    delete updatedDict[key];
    const updatedSettings = { ...settings, dictionary: updatedDict };
    handleSave(updatedSettings);
  };

  // Snippet / Macro Handlers
  const addSnippet = () => {
    if (!settings || !newSnippetTrigger.trim() || !newSnippetValue.trim()) return;
    const updatedSnippets = {
      ...settings.snippets,
      [newSnippetTrigger.trim().toLowerCase()]: newSnippetValue.trim(),
    };
    const updatedSettings = { ...settings, snippets: updatedSnippets };
    handleSave(updatedSettings);
    setNewSnippetTrigger("");
    setNewSnippetValue("");
  };

  const removeSnippet = (key: string) => {
    if (!settings) return;
    const updatedSnippets = { ...settings.snippets };
    delete updatedSnippets[key];
    const updatedSettings = { ...settings, snippets: updatedSnippets };
    handleSave(updatedSettings);
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Live Test Sandbox Simulation
  useEffect(() => {
    if (!settings || !testInput) {
      setTestOutput("");
      return;
    }
    let res = testInput;

    // 1. Expand Snippets
    if (settings.snippets) {
      for (const [trigger, val] of Object.entries(settings.snippets)) {
        if (!trigger.trim()) continue;
        const re = new RegExp(`\\b${trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
        res = res.replace(re, val);
      }
    }

    // 2. Apply Word Dictionary
    if (settings.dictionary) {
      for (const [spoken, pref] of Object.entries(settings.dictionary)) {
        if (!spoken.trim()) continue;
        const re = new RegExp(`\\b${spoken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
        res = res.replace(re, pref);
      }
    }

    setTestOutput(res);
  }, [testInput, settings]);

  if (!settings) {
    return (
      <div className="p-8 text-center text-[var(--text-muted)] flex items-center justify-center gap-2 font-sans">
        <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" /> Loading dictionary...
      </div>
    );
  }

  // Filter items based on search query
  const filteredWords = Object.entries(settings.dictionary || {}).filter(
    ([spoken, preferred]) =>
      spoken.toLowerCase().includes(searchQuery.toLowerCase()) ||
      preferred.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSnippets = Object.entries(settings.snippets || {}).filter(
    ([trigger, value]) =>
      trigger.toLowerCase().includes(searchQuery.toLowerCase()) ||
      value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination computations for Words
  const totalWordPages = Math.max(1, Math.ceil(filteredWords.length / wordsPerPage));
  const activeWordPage = Math.min(wordPage, totalWordPages);
  const startWordIdx = (activeWordPage - 1) * wordsPerPage;
  const paginatedWords = filteredWords.slice(startWordIdx, startWordIdx + wordsPerPage);
  const wordPaginationRange = getPaginationRange(activeWordPage, totalWordPages);

  // Pagination computations for Snippets
  const totalSnippetPages = Math.max(1, Math.ceil(filteredSnippets.length / snippetsPerPage));
  const activeSnippetPage = Math.min(snippetPage, totalSnippetPages);
  const startSnippetIdx = (activeSnippetPage - 1) * snippetsPerPage;
  const paginatedSnippets = filteredSnippets.slice(startSnippetIdx, startSnippetIdx + snippetsPerPage);
  const snippetPaginationRange = getPaginationRange(activeSnippetPage, totalSnippetPages);

  return (
    <div className="space-y-5 animate-fadeIn font-sans w-full pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-medium text-[var(--text-primary)] tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[var(--accent)]" />
            Personal Dictionary & Voice Snippets
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Map phonetic terms to proper brand casing and configure expandable voice prompt shortcuts.
          </p>
        </div>

        {saveSuccess && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--success)] bg-[var(--success-bg)] px-2.5 py-1 rounded-[6px] border border-[var(--success-border)] font-medium font-mono shrink-0">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      {/* Sub Tab Switcher & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Sub Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[8px] w-full md:w-fit flex-wrap">
          <button
            onClick={() => {
              setActiveSubTab("words");
              setWordPage(1);
            }}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-[6px] text-[13px] font-medium transition-all cursor-pointer ${
              activeSubTab === "words"
                ? "bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-transparent"
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Word Mappings ({Object.keys(settings.dictionary || {}).length})</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab("snippets");
              setSnippetPage(1);
            }}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-[6px] text-[13px] font-medium transition-all cursor-pointer ${
              activeSubTab === "snippets"
                ? "bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-transparent"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Voice Snippets ({Object.keys(settings.snippets || {}).length})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 md:max-w-xs">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setWordPage(1);
              setSnippetPage(1);
            }}
            placeholder={`Search ${activeSubTab === "words" ? "words & replacements" : "snippets & triggers"}...`}
            className="w-full pl-9 pr-3.5 py-1.5 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[7px] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* TAB 1: Word Replacements (Table Format + Smart Pagination) */}
      {activeSubTab === "words" && (
        <div className="space-y-4">
          {/* Add Word Form */}
          <div className="forge-card p-4 space-y-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-primary)]">
            <div>
              <h3 className="text-[14px] font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Type className="w-4 h-4 text-[var(--accent)]" /> Add Phonetic Word Correction
              </h3>
              <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                Automatically convert spoken phonetic phrases into exact proper nouns, library names, or acronyms.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={newSpoken}
                onChange={(e) => setNewSpoken(e.target.value)}
                placeholder="Spoken: e.g. 'lang chain'"
                className="flex-1 px-3 py-2 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[7px] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] font-mono"
              />
              <input
                type="text"
                value={newPreferred}
                onChange={(e) => setNewPreferred(e.target.value)}
                placeholder="Preferred: e.g. 'LangChain'"
                className="flex-1 px-3 py-2 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[7px] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] font-mono font-medium"
              />
              <button
                type="button"
                onClick={addDictionaryWord}
                disabled={!newSpoken.trim() || !newPreferred.trim()}
                className="px-4 py-2 btn-primary text-[13px] font-medium disabled:opacity-40 flex items-center gap-1.5 justify-center shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Word
              </button>
            </div>
          </div>

          {/* Word List in Responsive Data Table */}
          <div className="forge-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-primary)] overflow-hidden">
            <div className="p-3.5 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h4 className="text-[12px] font-medium text-[var(--accent)] uppercase tracking-wider font-mono">
                  Word Mappings Table ({filteredWords.length})
                </h4>
              </div>

              {/* Rows Per Page Selector */}
              <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)] font-mono">
                <span>Show:</span>
                <select
                  value={wordsPerPage}
                  onChange={(e) => {
                    setWordsPerPage(Number(e.target.value));
                    setWordPage(1);
                  }}
                  className="px-2 py-0.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value={7}>7 rows</option>
                  <option value={10}>10 rows</option>
                  <option value={20}>20 rows</option>
                  <option value={50}>50 rows</option>
                </select>
                <span className="text-[var(--text-muted)] font-mono ml-2">
                  Page {activeWordPage} of {totalWordPages}
                </span>
              </div>
            </div>

            {filteredWords.length === 0 ? (
              <div className="p-10 text-center text-[var(--text-muted)] text-[13px]">
                No dictionary words found. Add a phonetic word correction above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-elevated)] text-[var(--text-muted)] font-mono uppercase tracking-wider text-[11px] border-b border-[var(--border-subtle)]">
                      <th className="py-2.5 px-3.5 font-medium w-12 text-center">#</th>
                      <th className="py-2.5 px-3.5 font-medium">Spoken / Phonetic Trigger</th>
                      <th className="py-2.5 px-2 font-medium w-8 text-center"></th>
                      <th className="py-2.5 px-3.5 font-medium">Cleaned Replacement</th>
                      <th className="py-2.5 px-3.5 font-medium text-right w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {paginatedWords.map(([spoken, preferred], index) => {
                      const rowNum = startWordIdx + index + 1;
                      return (
                        <tr
                          key={spoken}
                          className="hover:bg-[var(--surface-hover)] transition-colors group"
                        >
                          <td className="py-2.5 px-3.5 text-center font-mono text-[var(--text-muted)] text-[12px]">
                            {rowNum}
                          </td>
                          <td className="py-2.5 px-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[var(--surface-elevated)] border border-[var(--border)] font-mono text-[var(--text-primary)] text-[12px]">
                              &quot;{spoken}&quot;
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center text-[var(--text-muted)]">
                            <ArrowRight className="w-3.5 h-3.5 inline opacity-50 group-hover:opacity-100 group-hover:text-[var(--accent)] transition-all" />
                          </td>
                          <td className="py-2.5 px-3.5 font-mono font-medium text-[var(--accent)] text-[13px]">
                            {preferred}
                          </td>
                          <td className="py-2.5 px-3.5 text-right">
                            <div className="inline-flex items-center gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() => copyText(preferred, `word-${spoken}`)}
                                className="p-1 rounded-[5px] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors cursor-pointer"
                                title="Copy replacement text"
                              >
                                {copiedKey === `word-${spoken}` ? (
                                  <Check className="w-3.5 h-3.5 text-[var(--success)]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeDictionaryWord(spoken)}
                                className="p-1 rounded-[5px] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors cursor-pointer"
                                title="Delete mapping"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Smart Sliding Window Pagination Controls */}
            {totalWordPages > 1 && (
              <div className="p-3 bg-[var(--surface-elevated)] border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px]">
                <span className="text-[var(--text-secondary)] font-mono text-center sm:text-left">
                  Showing <strong className="text-[var(--text-primary)]">{startWordIdx + 1}</strong> to{" "}
                  <strong className="text-[var(--text-primary)]">
                    {Math.min(startWordIdx + wordsPerPage, filteredWords.length)}
                  </strong>{" "}
                  of <strong className="text-[var(--text-primary)]">{filteredWords.length}</strong> mappings
                </span>

                <div className="flex items-center gap-1 flex-wrap justify-center font-mono">
                  <button
                    type="button"
                    onClick={() => setWordPage((p) => Math.max(1, p - 1))}
                    disabled={activeWordPage === 1}
                    className="p-1 rounded-[5px] bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {wordPaginationRange.map((item, i) => {
                    if (item === "...") {
                      return (
                        <span
                          key={`dots-${i}`}
                          className="px-1 text-[11px] font-mono text-[var(--text-muted)]"
                        >
                          •••
                        </span>
                      );
                    }
                    const pageNum = Number(item);
                    return (
                      <button
                        type="button"
                        key={pageNum}
                        onClick={() => setWordPage(pageNum)}
                        className={`min-w-[24px] h-6 px-1.5 rounded-[5px] text-[11px] font-medium transition-all cursor-pointer ${
                          activeWordPage === pageNum
                            ? "bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] font-semibold"
                            : "bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setWordPage((p) => Math.min(totalWordPages, p + 1))}
                    disabled={activeWordPage === totalWordPages}
                    className="p-1 rounded-[5px] bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Voice Snippets & Macros */}
      {activeSubTab === "snippets" && (
        <div className="space-y-4">
          {/* Add Snippet Card */}
          <div className="forge-card p-4 space-y-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-primary)]">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-medium text-[var(--text-primary)] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--accent)]" /> Add Voice Snippet / Prompt Shortcut
              </h3>
              <span className="text-[11px] font-mono text-[var(--accent)] font-medium">Macro Expansion</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[12px] text-[var(--text-secondary)] block mb-1 font-mono">
                  Voice Trigger Phrase (What you speak)
                </label>
                <input
                  type="text"
                  value={newSnippetTrigger}
                  onChange={(e) => setNewSnippetTrigger(e.target.value)}
                  placeholder="e.g. 'my signature', 'email signoff', 'bug report template'"
                  className="w-full px-3 py-2 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[7px] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] font-mono placeholder:text-[var(--text-muted)]"
                />
              </div>

              <div>
                <label className="text-[12px] text-[var(--text-secondary)] block mb-1 font-mono">
                  Expanded Text Template (What gets inserted)
                </label>
                <textarea
                  rows={4}
                  value={newSnippetValue}
                  onChange={(e) => setNewSnippetValue(e.target.value)}
                  placeholder={`Best regards,\nAli\nLead Developer`}
                  className="w-full px-3 py-2 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[7px] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] font-mono resize-y placeholder:text-[var(--text-muted)]"
                />
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={addSnippet}
                  disabled={!newSnippetTrigger.trim() || !newSnippetValue.trim()}
                  className="px-4 py-2 btn-primary text-[13px] font-medium disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Save Voice Snippet
                </button>
              </div>
            </div>
          </div>

          {/* Snippets List */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h4 className="text-[12px] font-medium text-[var(--accent)] uppercase tracking-wider font-mono">
                  Configured Snippets ({filteredSnippets.length})
                </h4>
              </div>

              {/* Rows Per Page Selector */}
              <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)] font-mono">
                <span>Show:</span>
                <select
                  value={snippetsPerPage}
                  onChange={(e) => {
                    setSnippetsPerPage(Number(e.target.value));
                    setSnippetPage(1);
                  }}
                  className="px-2 py-0.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value={4}>4 items</option>
                  <option value={6}>6 items</option>
                  <option value={12}>12 items</option>
                  <option value={24}>24 items</option>
                </select>
                <span className="text-[var(--text-muted)] font-mono ml-2">
                  Page {activeSnippetPage} of {totalSnippetPages}
                </span>
              </div>
            </div>

            {filteredSnippets.length === 0 ? (
              <div className="forge-card p-8 text-center text-[var(--text-muted)] text-[13px] rounded-[8px] border border-[var(--border)] bg-[var(--surface-primary)]">
                No voice snippets configured yet. Add your first prompt or signature shortcut above.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {paginatedSnippets.map(([trigger, value]) => (
                  <div
                    key={trigger}
                    className="forge-card p-4 rounded-[8px] border border-[var(--border)] space-y-3 transition-all flex flex-col justify-between bg-[var(--surface-primary)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-[4px] bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-[12px] font-medium text-[var(--accent)] font-mono">
                        &quot;{trigger}&quot;
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => copyText(value, trigger)}
                          className="p-1 rounded-[5px] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors cursor-pointer"
                          title="Copy snippet text"
                        >
                          {copiedKey === trigger ? (
                            <Check className="w-3.5 h-3.5 text-[var(--success)]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSnippet(trigger)}
                          className="p-1 rounded-[5px] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors cursor-pointer"
                          title="Delete snippet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="bg-[var(--surface-elevated)] p-2.5 rounded-[6px] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Smart Sliding Window Pagination for Snippets */}
            {totalSnippetPages > 1 && (
              <div className="p-3 bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-[8px] flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px]">
                <span className="text-[var(--text-secondary)] font-mono text-center sm:text-left">
                  Showing <strong className="text-[var(--text-primary)]">{startSnippetIdx + 1}</strong> to{" "}
                  <strong className="text-[var(--text-primary)]">
                    {Math.min(startSnippetIdx + snippetsPerPage, filteredSnippets.length)}
                  </strong>{" "}
                  of <strong className="text-[var(--text-primary)]">{filteredSnippets.length}</strong> snippets
                </span>

                <div className="flex items-center gap-1 flex-wrap justify-center font-mono">
                  <button
                    type="button"
                    onClick={() => setSnippetPage((p) => Math.max(1, p - 1))}
                    disabled={activeSnippetPage === 1}
                    className="p-1 rounded-[5px] bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {snippetPaginationRange.map((item, i) => {
                    if (item === "...") {
                      return (
                        <span
                          key={`dots-s-${i}`}
                          className="px-1 text-[11px] font-mono text-[var(--text-muted)]"
                        >
                          •••
                        </span>
                      );
                    }
                    const pageNum = Number(item);
                    return (
                      <button
                        type="button"
                        key={`page-s-${pageNum}`}
                        onClick={() => setSnippetPage(pageNum)}
                        className={`min-w-[24px] h-6 px-1.5 rounded-[5px] text-[11px] font-medium transition-all cursor-pointer ${
                          activeSnippetPage === pageNum
                            ? "bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] font-semibold"
                            : "bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setSnippetPage((p) => Math.min(totalSnippetPages, p + 1))}
                    disabled={activeSnippetPage === totalSnippetPages}
                    className="p-1 rounded-[5px] bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Live Sandbox Tester */}
          <div className="forge-card p-4 space-y-2.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface-primary)]">
            <div className="flex items-center justify-between">
              <h4 className="text-[12px] font-medium text-[var(--accent)] uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Code2 className="w-4 h-4" /> Live Voice Expansion Sandbox Tester
              </h4>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">Simulation</span>
            </div>
            <p className="text-[13px] text-[var(--text-secondary)]">
              Type or speak any trigger phrase like <code className="text-[var(--accent)] font-mono">&quot;my signature&quot;</code> to test the expansion output below.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] block mb-1 font-mono">Test Input Text</label>
                <textarea
                  rows={3}
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="e.g. Please check this update, my signature"
                  className="w-full px-3 py-2 bg-[var(--surface-primary)] border border-[var(--border)] rounded-[7px] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] font-mono resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-[var(--text-muted)] block mb-1 font-mono">Live Expanded Output</label>
                <div className="w-full h-[74px] px-3 py-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-[7px] text-[13px] text-[var(--accent)] font-mono overflow-y-auto whitespace-pre-wrap font-medium">
                  {testOutput || <span className="text-[var(--text-muted)] italic font-normal text-[12px]">Expanded output appears here in real-time...</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
