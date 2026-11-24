import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Lightbulb,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer.tsx';
import { apiRequest, ApiError, formatTimestamp } from '../lib/api.ts';
import type { DocumentSummary, ExplanationItem } from '../types.ts';

const EXPLAIN_MODES: Array<{
  id: 'beginner' | 'step_by_step' | 'examples' | 'quick_revision';
  label: string;
  description: string;
}> = [
  {
    id: 'beginner',
    label: 'Explain Like a Beginner',
    description: 'Plain English definitions with everyday analogies.',
  },
  {
    id: 'step_by_step',
    label: 'Step-by-Step Explanation',
    description: 'Break complex mechanics into clear numbered steps.',
  },
  {
    id: 'examples',
    label: 'Explain with Examples',
    description: 'Learn through concrete real-life and academic scenarios.',
  },
  {
    id: 'quick_revision',
    label: 'Quick Revision',
    description: 'Crisp takeaway bullets and common exam pitfalls.',
  },
];

export function ExplainPage({ defaultMode }: { defaultMode?: string }) {
  const initialMode = (['beginner', 'step_by_step', 'examples', 'quick_revision'].includes(
    defaultMode || ''
  )
    ? defaultMode
    : 'beginner') as 'beginner' | 'step_by_step' | 'examples' | 'quick_revision';

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [explanations, setExplanations] = useState<ExplanationItem[]>([]);
  const [activeItem, setActiveItem] = useState<ExplanationItem | null>(null);

  const [topic, setTopic] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [mode, setMode] = useState<'beginner' | 'step_by_step' | 'examples' | 'quick_revision'>(
    initialMode
  );

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [docsRes, expRes] = await Promise.all([
          apiRequest<{ documents: DocumentSummary[] }>('/documents'),
          apiRequest<{ explanations: ExplanationItem[] }>('/explain'),
        ]);
        if (active) {
          setDocuments(docsRes.documents);
          setExplanations(expRes.explanations);
          if (expRes.explanations.length > 0) {
            setActiveItem(expRes.explanations[0]);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof ApiError ? err.message : 'Unable to load topic explainer.');
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

  const runExplanation = async (
    chosenMode: 'beginner' | 'step_by_step' | 'examples' | 'quick_revision' | 'simpler',
    overrideTopic?: string,
    previousText?: string
  ) => {
    const targetTopic = (overrideTopic ?? topic).trim();
    const targetExcerpt = excerpt.trim();

    if (targetTopic.length < 2 && targetExcerpt.length < 10) {
      setError('Please enter a topic name or paste an excerpt from your study notes.');
      return;
    }

    setError('');
    setGenerating(true);
    try {
      const res = await apiRequest<{ explanation: ExplanationItem }>('/explain', {
        method: 'POST',
        body: {
          topic: targetTopic,
          excerpt: targetExcerpt,
          documentId: selectedDocId ? Number(selectedDocId) : null,
          mode: chosenMode,
          previousExplanation: previousText || '',
        },
      });
      setActiveItem(res.explanation);
      setExplanations((prev) => [res.explanation, ...prev]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to explain topic.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!activeItem) return;
    try {
      await navigator.clipboard.writeText(activeItem.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Clipboard access was denied.');
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Loading topic explainer...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Form */}
      <div className="lg:col-span-4 space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runExplanation(mode);
          }}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">
              Explain Difficult Topics
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Get plain-English definitions, steps, real-life examples, and a revision summary.
            </p>
          </div>

          <div>
            <label htmlFor="explain-topic" className="block text-xs font-medium text-slate-700 mb-1.5">
              Concept or Topic
            </label>
            <input
              id="explain-topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Backpropagation, Eigenvalues, Osmosis"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="explain-doc" className="block text-xs font-medium text-slate-700 mb-1.5">
              Optional PDF Context
            </label>
            <select
              id="explain-doc"
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
            >
              <option value="">General Academic Explanation</option>
              {documents.map((doc) => (
                <option key={doc.id} value={String(doc.id)}>
                  Reference: {doc.original_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="explain-excerpt" className="block text-xs font-medium text-slate-700 mb-1.5">
              Optional Text Excerpt From Notes
            </label>
            <textarea
              id="explain-excerpt"
              rows={3}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Paste a confusing paragraph or theorem from your PDF..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 mb-2">
              Explanation Style
            </span>
            <div className="space-y-2">
              {EXPLAIN_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                    mode === m.id
                      ? 'border-indigo-600 bg-indigo-50/70'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-900">{m.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{m.description}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={generating}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Explaining Topic...</span>
              </>
            ) : (
              <>
                <Lightbulb className="h-4 w-4" />
                <span>Explain Topic</span>
              </>
            )}
          </button>
        </form>

        {explanations.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-sm font-semibold text-slate-900 mb-3">
              Recent Explanations
            </h2>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {explanations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveItem(item)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${
                    activeItem?.id === item.id
                      ? 'bg-indigo-50 text-indigo-800'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <p className="truncate font-medium">{item.topic}</p>
                  <p className="text-[11px] text-slate-500 capitalize">
                    {item.mode.replace('_', ' ')} · {formatTimestamp(item.created_at)}
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

        <div className="rounded-xl border border-slate-200 bg-white min-h-[460px] flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-indigo-700 capitalize">
                {activeItem
                  ? `${activeItem.mode.replace('_', ' ')} Mode`
                  : 'Concept Explanation'}
              </p>
              <h2 className="truncate font-display text-base font-semibold text-slate-900">
                {activeItem ? activeItem.topic : 'Enter a topic to get a clear explanation'}
              </h2>
            </div>

            {activeItem && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => runExplanation('simpler', activeItem.topic, activeItem.content)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Explain Even Simpler</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="p-6 flex-1">
            {generating ? (
              <div className="py-20 text-center space-y-3">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
                <p className="text-sm text-slate-600">
                  Breaking down the concept into clear steps and everyday examples...
                </p>
              </div>
            ) : activeItem ? (
              <MarkdownRenderer content={activeItem.content} />
            ) : (
              <div className="py-20 text-center">
                <p className="text-sm font-medium text-slate-700">No explanation selected yet.</p>
                <p className="mt-1 text-xs text-slate-500">
                  Enter any difficult topic on the left and pick an explanation style.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
