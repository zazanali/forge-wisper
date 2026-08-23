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
  Scissors,
  RotateCcw,
  ListOrdered,
  Brain,
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
      <div className="p-8 text-center text-[var(--text-3)] flex items-center justify-center gap-2 font-sans">
        <Loader2 className="w-5 h-5 animate-spin text-[#FF4D5E]" /> Loading dictionary...
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
    <div className="space-y-6 animate-fadeIn font-sans w-full pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-[var(--text-1)] flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[#FF4D5E]" />
            Personal Dictionary & Voice Snippets
          </h2>
          <p className="text-xs text-[var(--text-2)] mt-0.5">
            Map phonetic terms to proper brand casing and configure expandable voice prompt shortcuts.
          </p>
        </div>

        {saveSuccess && (
          <span className="inline-flex items-center gap-1.5 text-xs text-teal-600 dark:text-[#3FE3C4] bg-teal-500/15 px-3 py-1 rounded-xl border border-teal-500/30 font-bold shrink-0">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      {/* Sub Tab Switcher & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Sub Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--raised)] border border-[var(--border)] rounded-xl w-full md:w-fit flex-wrap">
          <button
            onClick={() => {
              setActiveSubTab("words");
              setWordPage(1);
            }}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === "words"
                ? "bg-[#FF4D5E] text-white shadow-md shadow-[#FF4D5E]/20"
                : "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--panel)]"
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
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === "snippets"
                ? "bg-[#FF4D5E] text-white shadow-md shadow-[#FF4D5E]/20"
                : "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--panel)]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Voice Snippets ({Object.keys(settings.snippets || {}).length})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 md:max-w-xs">
          <Search className="w-4 h-4 text-[var(--text-3)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setWordPage(1);
              setSnippetPage(1);
            }}
            placeholder={`Search ${activeSubTab === "words" ? "words & replacements" : "snippets & triggers"}...`}
            className="w-full pl-10 pr-4 py-2 bg-[var(--panel)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[#FF4D5E] transition-colors"
          />
        </div>
      </div>

      {/* TAB 1: Word Replacements (Table Format + Smart Pagination) */}
      {activeSubTab === "words" && (
        <div className="space-y-6">
          {/* Add Word Form */}
          <div className="forge-card p-5 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--panel)]">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-1)] flex items-center gap-2 font-display">
                <Type className="w-4 h-4 text-[#FF4D5E]" /> Add Phonetic Word Correction
              </h3>
              <p className="text-xs text-[var(--text-2)] mt-0.5">
                Automatically convert spoken phonetic phrases into exact proper nouns, library names, or acronyms.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={newSpoken}
                onChange={(e) => setNewSpoken(e.target.value)}
                placeholder="Spoken: e.g. 'lang chain'"
                className="flex-1 px-3.5 py-2.5 bg-[var(--raised)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[#FF4D5E] font-mono"
              />
              <input
                type="text"
                value={newPreferred}
                onChange={(e) => setNewPreferred(e.target.value)}
                placeholder="Preferred: e.g. 'LangChain'"
                className="flex-1 px-3.5 py-2.5 bg-[var(--raised)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[#FF4D5E] font-mono font-semibold"
              />
              <button
                onClick={addDictionaryWord}
                disabled={!newSpoken.trim() || !newPreferred.trim()}
                className="px-6 py-2.5 btn-blade rounded-xl text-xs font-semibold text-white disabled:opacity-40 flex items-center gap-2 justify-center shadow-md shadow-[#FF4D5E]/20 shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Word
              </button>
            </div>
          </div>

          {/* Word List in Responsive Modern Data Table */}
          <div className="forge-card rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h4 className="text-xs font-semibold text-[#FF4D5E] uppercase tracking-wider font-display">
                  Word Mappings Table ({filteredWords.length})
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--raised)] border border-[var(--border)] text-[var(--text-2)]">
                  {filteredWords.length} Total Entries
                </span>
              </div>

              {/* Rows Per Page Selector */}
              <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
                <span>Show:</span>
                <select
                  value={wordsPerPage}
                  onChange={(e) => {
                    setWordsPerPage(Number(e.target.value));
                    setWordPage(1);
                  }}
                  className="px-2.5 py-1 bg-[var(--raised)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-1)] font-mono focus:outline-none focus:border-[#FF4D5E]"
                >
                  <option value={7}>7 rows</option>
                  <option value={10}>10 rows</option>
                  <option value={20}>20 rows</option>
                  <option value={50}>50 rows</option>
                </select>
                <span className="text-[var(--text-3)] font-mono ml-2">
                  Page {activeWordPage} of {totalWordPages}
                </span>
              </div>
            </div>

            {filteredWords.length === 0 ? (
              <div className="p-12 text-center text-[var(--text-3)] text-xs">
                No dictionary words found. Add a phonetic word correction above!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--raised)]/80 text-[var(--text-3)] font-mono uppercase tracking-wider text-[11px] border-b border-[var(--border)]">
                      <th className="py-3 px-4 font-semibold w-12 text-center">#</th>
                      <th className="py-3 px-4 font-semibold">Spoken / Phonetic Trigger</th>
                      <th className="py-3 px-2 font-semibold w-8 text-center"></th>
                      <th className="py-3 px-4 font-semibold">Cleaned Replacement</th>
                      <th className="py-3 px-4 font-semibold text-right w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {paginatedWords.map(([spoken, preferred], index) => {
                      const rowNum = startWordIdx + index + 1;
                      return (
                        <tr
                          key={spoken}
                          className="hover:bg-[var(--raised)]/50 transition-colors group"
                        >
                          <td className="py-3 px-4 text-center font-mono text-[var(--text-3)]">
                            {rowNum}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[var(--raised)] border border-[var(--border)] font-mono text-[var(--text-1)] font-medium">
                              &quot;{spoken}&quot;
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center text-[var(--text-3)]">
                            <ArrowRight className="w-3.5 h-3.5 inline opacity-50 group-hover:opacity-100 group-hover:text-[#FF4D5E] transition-all" />
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[#FF4D5E] text-[13px]">
                            {preferred}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1 justify-end">
                              <button
                                onClick={() => copyText(preferred, `word-${spoken}`)}
                                className="p-1.5 rounded-lg bg-[var(--raised)] hover:bg-[var(--raised-hover)] text-[var(--text-2)] hover:text-[var(--text-1)] border border-[var(--border)] transition-colors"
                                title="Copy replacement text"
                              >
                                {copiedKey === `word-${spoken}` ? (
                                  <Check className="w-3.5 h-3.5 text-teal-600 dark:text-[#3FE3C4]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => removeDictionaryWord(spoken)}
                                className="p-1.5 rounded-lg hover:bg-[#FF4D5E]/20 text-[var(--text-3)] hover:text-[#FF4D5E] transition-colors"
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
              <div className="p-3.5 bg-[var(--raised)]/40 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-[var(--text-2)] font-mono text-center sm:text-left">
                  Showing <strong className="text-[var(--text-1)]">{startWordIdx + 1}</strong> to{" "}
                  <strong className="text-[var(--text-1)]">
                    {Math.min(startWordIdx + wordsPerPage, filteredWords.length)}
                  </strong>{" "}
                  of <strong className="text-[var(--text-1)]">{filteredWords.length}</strong> mappings
                </span>

                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  <button
                    onClick={() => setWordPage((p) => Math.max(1, p - 1))}
                    disabled={activeWordPage === 1}
                    className="p-1.5 rounded-lg bg-[var(--raised)] hover:bg-[var(--raised-hover)] text-[var(--text-2)] hover:text-[var(--text-1)] border border-[var(--border)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {wordPaginationRange.map((item, i) => {
                    if (item === "...") {
                      return (
                        <span
                          key={`dots-${i}`}
                          className="px-2 py-1 text-xs font-mono text-[var(--text-3)]"
                        >
                          •••
                        </span>
                      );
                    }
                    const pageNum = Number(item);
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setWordPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-mono font-semibold transition-all ${
                          activeWordPage === pageNum
                            ? "bg-[#FF4D5E] text-white shadow-sm"
                            : "bg-[var(--raised)] hover:bg-[var(--raised-hover)] text-[var(--text-2)] hover:text-[var(--text-1)] border border-[var(--border)]"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setWordPage((p) => Math.min(totalWordPages, p + 1))}
                    disabled={activeWordPage === totalWordPages}
                    className="p-1.5 rounded-lg bg-[var(--raised)] hover:bg-[var(--raised-hover)] text-[var(--text-2)] hover:text-[var(--text-1)] border border-[var(--border)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Voice Snippets & Macros (Card Grid + Smart Pagination) */}
      {activeSubTab === "snippets" && (
        <div className="space-y-6">
          {/* Add Snippet Card */}
          <div className="forge-card p-5 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--panel)]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-1)] flex items-center gap-2 font-display">
                <FileText className="w-4 h-4 text-[#FF4D5E]" /> Add Voice Snippet / Prompt Shortcut
              </h3>
              <span className="text-[11px] font-mono text-[#FF4D5E] dark:text-[#3FE3C4] font-semibold">Macro Expansion</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-2)] block mb-1.5 font-mono">
                  Voice Trigger Phrase (What you speak)
                </label>
                <input
                  type="text"
                  value={newSnippetTrigger}
                  onChange={(e) => setNewSnippetTrigger(e.target.value)}
                  placeholder="e.g. 'my signature', 'email signoff', 'bug report template'"
                  className="w-full px-3.5 py-2.5 bg-[var(--raised)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-1)] focus:outline-none focus:border-[#FF4D5E] font-mono placeholder:text-[var(--text-3)]"
                />
              </div>

              <div>
                <label className="text-xs text-[var(--text-2)] block mb-1.5 font-mono">
                  Expanded Text Template (What gets inserted)
                </label>
                <textarea
                  rows={4}
                  value={newSnippetValue}
                  onChange={(e) => setNewSnippetValue(e.target.value)}
                  placeholder={`Best regards,\nAli\nLead Developer`}
                  className="w-full px-3.5 py-2.5 bg-[var(--raised)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-1)] focus:outline-none focus:border-[#FF4D5E] font-mono resize-y placeholder:text-[var(--text-3)]"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-[11px] text-[var(--text-3)]">Insert preset:</span>
                <button
                  type="button"
                  onClick={() => {
                    setNewSnippetTrigger("my signature");
                    setNewSnippetValue("Best regards,\n[Your Name]\nLead Developer");
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[var(--raised)] hover:bg-[var(--raised-hover)] text-[11px] text-[var(--text-2)] hover:text-[#FF4D5E] border border-[var(--border)] transition-colors"
                >
                  + Signature
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewSnippetTrigger("meeting notes");
                    setNewSnippetValue("## Meeting Notes\n- **Attendees:** \n- **Key Takeaways:** \n- **Action Items:** \n  - [ ] ");
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[var(--raised)] hover:bg-[var(--raised-hover)] text-[11px] text-[var(--text-2)] hover:text-[#FF4D5E] border border-[var(--border)] transition-colors"
                >
                  + Meeting Notes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewSnippetTrigger("insert disclaimer");
                    setNewSnippetValue("CONFIDENTIALITY NOTICE: This transmission is intended only for the use of the individual or entity named above.");
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[var(--raised)] hover:bg-[var(--raised-hover)] text-[11px] text-[var(--text-2)] hover:text-[#FF4D5E] border border-[var(--border)] transition-colors"
                >
                  + Disclaimer
                </button>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={addSnippet}
                  disabled={!newSnippetTrigger.trim() || !newSnippetValue.trim()}
                  className="px-6 py-2.5 btn-blade rounded-xl text-xs font-semibold text-white disabled:opacity-40 flex items-center gap-2 shadow-md shadow-[#FF4D5E]/20"
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
                <h4 className="text-xs font-semibold text-[#FF4D5E] uppercase tracking-wider font-display">
                  Configured Snippets ({filteredSnippets.length})
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--raised)] border border-[var(--border)] text-[var(--text-2)]">
                  {filteredSnippets.length} Total Snippets
                </span>
              </div>

              {/* Rows Per Page Selector */}
              <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
                <span>Show:</span>
                <select
                  value={snippetsPerPage}
                  onChange={(e) => {
                    setSnippetsPerPage(Number(e.target.value));
                    setSnippetPage(1);
                  }}
                  className="px-2.5 py-1 bg-[var(--raised)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-1)] font-mono focus:outline-none focus:border-[#FF4D5E]"
                >
                  <option value={4}>4 items</option>
                  <option value={6}>6 items</option>
                  <option value={12}>12 items</option>
                  <option value={24}>24 items</option>
                </select>
                <span className="text-[var(--text-3)] font-mono ml-2">
                  Page {activeSnippetPage} of {totalSnippetPages}
                </span>
              </div>
            </div>

            {filteredSnippets.length === 0 ? (
              <div className="forge-card p-8 text-center text-[var(--text-3)] text-xs rounded-xl border border-[var(--border)] bg-[var(--panel)]">
                No voice snippets configured yet. Add your first prompt or signature shortcut above!
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {paginatedSnippets.map(([trigger, value]) => (
                  <div
                    key={trigger}
                    className="forge-card p-4 rounded-xl border border-[var(--border)] hover:border-[#FF4D5E]/40 space-y-2.5 transition-all flex flex-col justify-between bg-[var(--panel)] shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-[#FF4D5E]/12 border border-[#FF4D5E]/30 text-xs font-bold text-[#FF4D5E] font-mono">
                        &quot;{trigger}&quot;
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => copyText(value, trigger)}
                          className="p-1.5 rounded-lg bg-[var(--raised)] hover:bg-[var(--raised-hover)] text-[var(--text-2)] hover:text-[var(--text-1)] border border-[var(--border)] transition-colors"
                          title="Copy snippet text"
                        >
                          {copiedKey === trigger ? (
                            <Check className="w-3.5 h-3.5 text-teal-600 dark:text-[#3FE3C4]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => removeSnippet(trigger)}
                          className="p-1.5 rounded-lg bg-[var(--raised)] hover:bg-[#FF4D5E]/20 text-[var(--text-3)] hover:text-[#FF4D5E] border border-[var(--border)] transition-colors"
                          title="Delete snippet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 bg-[var(--raised)] rounded-lg border border-[var(--border)] text-xs font-mono text-[var(--text-1)] whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Smart Snippet Pagination Controls */}
            {totalSnippetPages > 1 && (
              <div className="p-3.5 bg-[var(--raised)]/40 border border-[var(--border)] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-[var(--text-2)] font-mono text-center sm:text-left">
                  Showing <strong className="text-[var(--text-1)]">{startSnippetIdx + 1}</strong> to{" "}
                  <strong className="text-[var(--text-1)]">
                    {Math.min(startSnippetIdx + snippetsPerPage, filteredSnippets.length)}
                  </strong>{" "}
                  of <strong className="text-[var(--text-1)]">{filteredSnippets.length}</strong> snippets
                </span>

                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  <button
                    onClick={() => setSnippetPage((p) => Math.max(1, p - 1))}
                    disabled={activeSnippetPage === 1}
                    className="p-1.5 rounded-lg bg-[var(--raised)] hover:bg-[var(--raised-hover)] text-[var(--text-2)] hover:text-[var(--text-1)] border border-[var(--border)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {snippetPaginationRange.map((item, i) => {
                    if (item === "...") {
                      return (
                        <span
                          key={`dots-snip-${i}`}
                          className="px-2 py-1 text-xs font-mono text-[var(--text-3)]"
                        >
                          •••
                        </span>
                      );
                    }
                    const pageNum = Number(item);
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setSnippetPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-mono font-semibold transition-all ${
                          activeSnippetPage === pageNum
                            ? "bg-[#FF4D5E] text-white shadow-sm"
                            : "bg-[var(--raised)] hover:bg-[var(--raised-hover)] text-[var(--text-2)] hover:text-[var(--text-1)] border border-[var(--border)]"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setSnippetPage((p) => Math.min(totalSnippetPages, p + 1))}
                    disabled={activeSnippetPage === totalSnippetPages}
                    className="p-1.5 rounded-lg bg-[var(--raised)] hover:bg-[var(--raised-hover)] text-[var(--text-2)] hover:text-[var(--text-1)] border border-[var(--border)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* How Word Mapping Works in Practice Guide */}
      <div className="forge-card p-5 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#FF4D5E]" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-1)] font-display">
              How Word Mapping & Voice Processing Works in Practice
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold text-teal-600 dark:text-[#3FE3C4] bg-teal-500/10 px-2 py-0.5 rounded-lg border border-teal-500/20">
            Intelligent Pipeline
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Card 1: Filler Removal */}
          <div className="p-3.5 rounded-xl bg-[var(--raised)] border border-[var(--border)] space-y-1.5 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[#FF4D5E]">
                <Scissors className="w-3.5 h-3.5 shrink-0" />
                <span>Filler Removal</span>
              </div>
              <p className="text-[11px] text-[var(--text-2)] leading-relaxed">
                Spoken pauses and verbal crutches like <code className="text-[#FF4D5E]">&quot;um&quot;</code> or <code className="text-[#FF4D5E]">&quot;ah&quot;</code> are automatically deleted before text lands in your app.
              </p>
            </div>
          </div>

          {/* Card 2: Real-Time Self-Correction */}
          <div className="p-3.5 rounded-xl bg-[var(--raised)] border border-[var(--border)] space-y-1.5 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>Real-Time Self-Correction</span>
              </div>
              <p className="text-[11px] text-[var(--text-2)] leading-relaxed">
                If you say <span className="text-[var(--text-1)] italic">&quot;meet at 5 PM, no actually 6 PM,&quot;</span> the mapping engine processes the intent and outputs <strong className="text-[var(--text-1)]">&quot;6 PM&quot;</strong>.
              </p>
            </div>
          </div>

          {/* Card 3: Contextual Formatting */}
          <div className="p-3.5 rounded-xl bg-[var(--raised)] border border-[var(--border)] space-y-1.5 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-teal-600 dark:text-[#3FE3C4]">
                <ListOrdered className="w-3.5 h-3.5 shrink-0" />
                <span>Contextual Formatting</span>
              </div>
              <p className="text-[11px] text-[var(--text-2)] leading-relaxed">
                Spoken lists or outlines transform directly into clean bullet points or numbered structures without manual hotkeys.
              </p>
            </div>
          </div>

          {/* Card 4: Adaptive Dictionary */}
          <div className="p-3.5 rounded-xl bg-[var(--raised)] border border-[var(--border)] space-y-1.5 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-cyan-400">
                <Brain className="w-3.5 h-3.5 shrink-0" />
                <span>Adaptive Dictionary</span>
              </div>
              <p className="text-[11px] text-[var(--text-2)] leading-relaxed">
                Custom vocabulary and unconventional names are learned and remembered automatically after your first manual correction.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Live Sandbox Tester */}
      <div className="forge-card p-5 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-teal-600 dark:text-[#3FE3C4] uppercase tracking-wider font-display flex items-center gap-2">
            <Code2 className="w-4 h-4" /> Live Voice Expansion Sandbox Tester
          </h4>
          <span className="text-[10px] text-[var(--text-3)] font-mono">Simulate real-time transcription</span>
        </div>
        <p className="text-xs text-[var(--text-2)]">
          Type or speak any trigger phrase like <code className="text-[#FF4D5E]">&quot;my signature&quot;</code> or <code className="text-teal-600 dark:text-[#3FE3C4]">&quot;lang chain&quot;</code> to test the expansion output below.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-[11px] text-[var(--text-3)] block mb-1 font-mono">Test Input Text</label>
            <textarea
              rows={3}
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="e.g. Please check this update, my signature"
              className="w-full px-3 py-2 bg-[var(--raised)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[#FF4D5E] font-mono resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-[var(--text-3)] block mb-1 font-mono">Live Expanded Output</label>
            <div className="w-full h-[74px] px-3 py-2 bg-[var(--raised)] border border-[var(--border)] rounded-xl text-xs text-teal-700 dark:text-[#3FE3C4] font-mono overflow-y-auto whitespace-pre-wrap font-semibold">
              {testOutput || <span className="text-[var(--text-3)] italic font-normal">Expanded output appears here...</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
