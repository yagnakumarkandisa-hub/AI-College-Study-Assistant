import React, { useEffect, useState } from 'react';
import { AlertCircle, Search, Trash2 } from 'lucide-react';
import { apiRequest, ApiError, formatTimestamp } from '../lib/api.ts';
import type { HistoryEntry } from '../types.ts';

const FILTER_TABS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All Activity' },
  { id: 'chat', label: 'AI Chat' },
  { id: 'upload', label: 'PDF Uploads' },
  { id: 'summary', label: 'Summaries' },
  { id: 'quiz', label: 'MCQ Quizzes' },
  { id: 'qa', label: 'Q&A Sets' },
  { id: 'explain', label: 'Explanations' },
];

const TYPE_LABELS: Record<string, string> = {
  upload: 'PDF Upload',
  chat: 'AI Tutor Chat',
  summary: 'Note Summary',
  quiz: 'MCQ Quiz',
  qa: 'Q&A Generator',
  explain: 'Topic Explainer',
};

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiRequest<{ history: HistoryEntry[] }>('/history');
        if (active) {
          setHistory(res.history);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof ApiError ? err.message : 'Unable to load study history.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleClearHistory = async () => {
    setClearing(true);
    setError('');
    try {
      await apiRequest('/history', { method: 'DELETE' });
      setHistory([]);
      setConfirmClear(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to clear study history.');
    } finally {
      setClearing(false);
    }
  };

  const filtered = history.filter((item) => {
    if (filterType !== 'all' && item.activity_type !== filterType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">Study History</h1>
            <p className="mt-1 text-xs text-slate-500">
              Review your saved questions, summaries, quiz scores, explanations, and uploaded PDFs.
            </p>
          </div>

          {history.length > 0 && (
            <div className="shrink-0">
              {confirmClear ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={clearing}
                    onClick={handleClearHistory}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 whitespace-nowrap"
                  >
                    {clearing ? 'Clearing...' : 'Confirm Clear'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear Study History</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Filter & Search Toolbar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  filterType === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search study log..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading study history...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-700">
              {history.length === 0
                ? 'No saved study history yet.'
                : 'No activity matches your current filter.'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {history.length === 0
                ? 'Your PDF uploads, AI questions, summaries, and quiz results will appear here.'
                : 'Try switching the activity tab or clearing the search box.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-slate-50/70 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-indigo-700">
                      {TYPE_LABELS[entry.activity_type] || entry.activity_type}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatTimestamp(entry.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-sm text-slate-900 truncate">{entry.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{entry.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
