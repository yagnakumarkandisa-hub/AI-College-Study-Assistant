import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  FileText,
  FileUp,
  Loader2,
} from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer.tsx';
import { apiRequest, ApiError, formatTimestamp } from '../lib/api.ts';
import type { AppRoute, DocumentSummary, SummaryItem } from '../types.ts';

interface SummaryPageProps {
  onNavigate: (route: AppRoute) => void;
  preselectedDocId?: number | null;
}

const SUMMARY_MODES: Array<{
  id: 'quick' | 'detailed' | 'exam';
  label: string;
  description: string;
}> = [
  {
    id: 'quick',
    label: 'Quick Summary',
    description: 'Concise 250–400 word overview with core takeaways and key definitions.',
  },
  {
    id: 'detailed',
    label: 'Detailed Summary',
    description: 'Comprehensive topic-by-topic breakdown covering mechanisms and examples.',
  },
  {
    id: 'exam',
    label: 'Exam Preparation Notes',
    description: 'High-yield concepts, definitions, comparisons, and revision checklist.',
  },
];

export function SummaryPage({ onNavigate, preselectedDocId }: SummaryPageProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>(
    preselectedDocId ? String(preselectedDocId) : ''
  );
  const [mode, setMode] = useState<'quick' | 'detailed' | 'exam'>('quick');
  const [activeSummary, setActiveSummary] = useState<SummaryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (preselectedDocId) {
      setSelectedDocId(String(preselectedDocId));
    }
  }, [preselectedDocId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [docsRes, sumRes] = await Promise.all([
          apiRequest<{ documents: DocumentSummary[] }>('/documents'),
          apiRequest<{ summaries: SummaryItem[] }>('/summaries'),
        ]);
        if (active) {
          setDocuments(docsRes.documents);
          setSummaries(sumRes.summaries);
          if (!preselectedDocId && docsRes.documents.length > 0) {
            setSelectedDocId(String(docsRes.documents[0].id));
          }
          if (sumRes.summaries.length > 0) {
            setActiveSummary(sumRes.summaries[0]);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof ApiError ? err.message : 'Unable to load summaries.');
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
  }, [preselectedDocId]);

  const handleSummarize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId || generating) return;
    setError('');
    setGenerating(true);

    try {
      const res = await apiRequest<{ summary: SummaryItem }>('/summaries', {
        method: 'POST',
        body: {
          documentId: Number(selectedDocId),
          mode,
        },
      });
      setActiveSummary(res.summary);
      setSummaries((prev) => [res.summary, ...prev]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to summarize notes.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!activeSummary) return;
    try {
      await navigator.clipboard.writeText(activeSummary.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Clipboard access was blocked by the browser.');
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Loading PDF summarizer...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Configuration & Saved Summaries */}
      <div className="lg:col-span-4 space-y-6">
        <form
          onSubmit={handleSummarize}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
        >
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">PDF Note Summarizer</h1>
            <p className="mt-1 text-xs text-slate-500">
              Long PDFs are automatically processed in sections and combined cleanly.
            </p>
          </div>

          {documents.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-xs text-slate-600">You have not uploaded any PDFs yet.</p>
              <button
                type="button"
                onClick={() => onNavigate('upload')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <FileUp className="h-3.5 w-3.5" />
                <span>Upload PDF Notes</span>
              </button>
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="summary-doc-select"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Select PDF Notes
                </label>
                <select
                  id="summary-doc-select"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                >
                  {documents.map((doc) => (
                    <option key={doc.id} value={String(doc.id)}>
                      {doc.original_name} ({doc.page_count}p)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 mb-2">
                  Summary Format
                </span>
                <div className="space-y-2">
                  {SUMMARY_MODES.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMode(opt.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        mode === opt.id
                          ? 'border-indigo-600 bg-indigo-50/70'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={generating || !selectedDocId}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Summarizing Notes...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    <span>Summarize My Notes</span>
                  </>
                )}
              </button>
            </>
          )}
        </form>

        {summaries.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-sm font-semibold text-slate-900 mb-3">
              Saved Summaries
            </h2>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {summaries.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSummary(s)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${
                    activeSummary?.id === s.id
                      ? 'bg-indigo-50 text-indigo-800'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <p className="truncate font-medium">{s.document_name}</p>
                  <p className="text-[11px] text-slate-500 capitalize">
                    {s.mode} · {formatTimestamp(s.created_at)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Output Canvas */}
      <div className="lg:col-span-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white min-h-[420px] flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-indigo-700 capitalize">
                {activeSummary ? `${activeSummary.mode} Summary` : 'Summary Output'}
              </p>
              <h2 className="truncate font-display text-base font-semibold text-slate-900">
                {activeSummary ? activeSummary.document_name : 'Select a PDF to summarize'}
              </h2>
            </div>

            {activeSummary && (
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Summary</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="p-6 flex-1">
            {generating ? (
              <div className="py-20 flex flex-col items-center justify-center text-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                <p className="text-sm text-slate-600">
                  Reading document sections and structuring key exam points...
                </p>
              </div>
            ) : activeSummary ? (
              <MarkdownRenderer content={activeSummary.content} />
            ) : (
              <div className="py-20 text-center">
                <p className="text-sm font-medium text-slate-700">No summary generated yet.</p>
                <p className="mt-1 text-xs text-slate-500">
                  Choose one of your uploaded PDFs and click &ldquo;Summarize My Notes&rdquo;.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
