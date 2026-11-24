import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import { apiRequest, ApiError, formatTimestamp } from '../lib/api.ts';
import type { DocumentSummary, QaSet } from '../types.ts';

const QA_MODES: Array<{
  id: 'important' | 'short' | 'long' | 'viva' | 'exam';
  label: string;
  hint: string;
}> = [
  { id: 'important', label: 'Important Questions', hint: 'High-yield core conceptual questions' },
  { id: 'short', label: 'Short Questions & Answers', hint: 'Concise 2–4 sentence answers' },
  { id: 'long', label: 'Long Questions & Answers', hint: 'Detailed essay-style breakdowns' },
  { id: 'viva', label: 'Viva Questions', hint: 'Oral exam & interview style Q&A' },
  {
    id: 'exam',
    label: 'Previous-Exam-Style Practice',
    hint: 'University exam format practice prompts',
  },
];

export function QuestionsPage({ preselectedDocId }: { preselectedDocId?: number | null }) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [qaSets, setQaSets] = useState<QaSet[]>([]);
  const [activeSet, setActiveSet] = useState<QaSet | null>(null);

  const [sourceType, setSourceType] = useState<'pdf' | 'topic'>('pdf');
  const [selectedDocId, setSelectedDocId] = useState<string>(
    preselectedDocId ? String(preselectedDocId) : ''
  );
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<'important' | 'short' | 'long' | 'viva' | 'exam'>('important');
  const [numQuestions, setNumQuestions] = useState(5);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [docsRes, qaRes] = await Promise.all([
          apiRequest<{ documents: DocumentSummary[] }>('/documents'),
          apiRequest<{ qaSets: QaSet[] }>('/qa'),
        ]);
        if (active) {
          setDocuments(docsRes.documents);
          setQaSets(qaRes.qaSets);
          if (docsRes.documents.length > 0 && !preselectedDocId) {
            setSelectedDocId(String(docsRes.documents[0].id));
          } else if (docsRes.documents.length === 0) {
            setSourceType('topic');
          }
          if (qaRes.qaSets.length > 0) {
            setActiveSet(qaRes.qaSets[0]);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof ApiError ? err.message : 'Unable to load Q&A generator.');
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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generating) return;
    setError('');

    if (sourceType === 'pdf' && !selectedDocId) {
      setError('Please select a PDF document or switch to Custom Topic.');
      return;
    }
    if (sourceType === 'topic' && topic.trim().length < 2) {
      setError('Please enter a topic to generate questions.');
      return;
    }

    setGenerating(true);
    try {
      const res = await apiRequest<{ qaSet: QaSet }>('/qa/generate', {
        method: 'POST',
        body: {
          documentId: sourceType === 'pdf' ? Number(selectedDocId) : null,
          topic: topic.trim(),
          mode,
          numQuestions,
        },
      });
      setActiveSet(res.qaSet);
      setQaSets((prev) => [res.qaSet, ...prev]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate Q&A set.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyAll = async () => {
    if (!activeSet) return;
    const formatted = activeSet.items
      .map(
        (item, idx) =>
          `Q${idx + 1} [${item.topicSection}]: ${item.question}\nAnswer: ${item.answer}\nKey Points:\n${item.keyPoints
            .map((k) => `- ${k}`)
            .join('\n')}`
      )
      .join('\n\n---\n\n');

    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Clipboard access was denied.');
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Loading Q&amp;A generator...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Configuration */}
      <div className="lg:col-span-4 space-y-6">
        <form
          onSubmit={handleGenerate}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">
              Question &amp; Answer Generator
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Organize study questions by topic with structured answers for revision.
            </p>
          </div>

          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSourceType('pdf')}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                sourceType === 'pdf'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              From PDF Notes
            </button>
            <button
              type="button"
              onClick={() => setSourceType('topic')}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                sourceType === 'topic'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom Topic
            </button>
          </div>

          {sourceType === 'pdf' ? (
            <div>
              <label htmlFor="qa-doc-select" className="block text-xs font-medium text-slate-700 mb-1.5">
                Select Uploaded PDF
              </label>
              {documents.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  No PDFs uploaded yet. Switch to Custom Topic or upload notes first.
                </p>
              ) : (
                <select
                  id="qa-doc-select"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                >
                  {documents.map((doc) => (
                    <option key={doc.id} value={String(doc.id)}>
                      {doc.original_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div>
              <label htmlFor="qa-topic-input" className="block text-xs font-medium text-slate-700 mb-1.5">
                Topic or Chapter Name
              </label>
              <input
                id="qa-topic-input"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Database Normalization (1NF–BCNF)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label htmlFor="qa-mode-select" className="block text-xs font-medium text-slate-700 mb-1.5">
              Question Format
            </label>
            <select
              id="qa-mode-select"
              value={mode}
              onChange={(e) =>
                setMode(e.target.value as 'important' | 'short' | 'long' | 'viva' | 'exam')
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
            >
              {QA_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              {QA_MODES.find((m) => m.id === mode)?.hint}
            </p>
          </div>

          <div>
            <label htmlFor="qa-count" className="block text-xs font-medium text-slate-700 mb-1.5">
              Number of Questions
            </label>
            <select
              id="qa-count"
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none tabular-nums"
            >
              <option value={3}>3 Questions</option>
              <option value={5}>5 Questions</option>
              <option value={8}>8 Questions</option>
              <option value={10}>10 Questions</option>
              <option value={12}>12 Questions</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={generating || (sourceType === 'pdf' && documents.length === 0)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating Q&amp;A...</span>
              </>
            ) : (
              <>
                <HelpCircle className="h-4 w-4" />
                <span>Generate Questions &amp; Answers</span>
              </>
            )}
          </button>
        </form>

        {qaSets.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-sm font-semibold text-slate-900 mb-3">
              Saved Q&amp;A Sets
            </h2>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {qaSets.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  onClick={() => setActiveSet(set)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${
                    activeSet?.id === set.id
                      ? 'bg-indigo-50 text-indigo-800'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <p className="truncate font-medium">{set.topic}</p>
                  <p className="text-[11px] text-slate-500 capitalize">
                    {set.mode} · {set.numQuestions} items · {formatTimestamp(set.created_at)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Output */}
      <div className="lg:col-span-8 space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-indigo-700 capitalize">
                {activeSet ? `${activeSet.mode} Study Set` : 'Study Questions & Answers'}
              </p>
              <h2 className="truncate font-display text-base font-semibold text-slate-900">
                {activeSet ? activeSet.topic : 'Generate a Question & Answer set'}
              </h2>
            </div>

            {activeSet && (
              <button
                type="button"
                onClick={handleCopyAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Copied All</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Q&amp;A</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="p-6">
            {generating ? (
              <div className="py-20 text-center space-y-3">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
                <p className="text-sm text-slate-600">
                  Organizing questions by topic and writing study answers...
                </p>
              </div>
            ) : !activeSet ? (
              <div className="py-20 text-center">
                <p className="text-sm font-medium text-slate-700">No Q&amp;A set generated yet.</p>
                <p className="mt-1 text-xs text-slate-500">
                  Pick a question format on the left to build practice questions from your notes.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
                  Practice Note: These AI-generated questions are study aids based on your notes and
                  are not guaranteed to appear on an actual university examination.
                </p>

                {activeSet.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="pb-6 border-b border-slate-100 last:border-b-0 last:pb-0 space-y-2.5"
                  >
                    <p className="text-xs font-semibold text-indigo-700">{item.topicSection}</p>
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      <span className="font-mono text-slate-400 mr-2 tabular-nums">
                        Q{idx + 1}.
                      </span>
                      {item.question}
                    </h3>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                      {item.answer}
                    </p>
                    {item.keyPoints && item.keyPoints.length > 0 && (
                      <div className="pt-1">
                        <p className="text-xs font-medium text-slate-500 mb-1">Key Points:</p>
                        <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
                          {item.keyPoints.map((kp, kIdx) => (
                            <li key={kIdx}>{kp}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
