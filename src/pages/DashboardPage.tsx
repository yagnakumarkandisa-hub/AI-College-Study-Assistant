import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckSquare,
  FileText,
  FileUp,
  HelpCircle,
  History,
  Lightbulb,
  MessageSquare,
} from 'lucide-react';
import { apiRequest, ApiError, formatTimestamp } from '../lib/api.ts';
import type { AppRoute, DashboardData, User } from '../types.ts';

interface DashboardPageProps {
  user: User;
  onNavigate: (route: AppRoute) => void;
}

const STUDY_TOOLS: Array<{
  route: AppRoute;
  title: string;
  description: string;
  actionLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    route: 'chatbot',
    title: 'AI Tutor Chat',
    description: 'Ask subject questions or query your uploaded PDF notes with page citations.',
    actionLabel: 'Open Chatbot',
    icon: MessageSquare,
  },
  {
    route: 'upload',
    title: 'Upload PDF Notes',
    description: 'Add lecture slides or textbooks and inspect extracted text page by page.',
    actionLabel: 'Manage PDFs',
    icon: FileUp,
  },
  {
    route: 'summary',
    title: 'Summarize Notes',
    description: 'Generate Quick Summaries, Detailed Notes, or Exam Preparation outlines.',
    actionLabel: 'Summarize Notes',
    icon: FileText,
  },
  {
    route: 'quiz',
    title: 'Generate MCQs',
    description: 'Take timed or untimed 4-option quizzes with instant explanations and scores.',
    actionLabel: 'Start Quiz',
    icon: CheckSquare,
  },
  {
    route: 'questions',
    title: 'Questions & Answers',
    description: 'Produce short, long, viva, and practice-exam Q&A sets organized by topic.',
    actionLabel: 'Generate Q&A',
    icon: HelpCircle,
  },
  {
    route: 'explain',
    title: 'Explain Difficult Topics',
    description: 'Break down tough concepts into beginner steps, examples, and quick revision.',
    actionLabel: 'Simplify Topic',
    icon: Lightbulb,
  },
];

export function DashboardPage({ user, onNavigate }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiRequest<DashboardData>('/dashboard');
        if (active) {
          setData(res);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof ApiError ? err.message : 'Unable to load dashboard metrics.');
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

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <p className="text-xs font-medium text-indigo-700">
            Student Workspace{user.major ? ` · ${user.major}` : ''} · {user.year_level}
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, {user.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            {user.study_goal
              ? `Current goal: ${user.study_goal}`
              : 'Upload your course PDFs, summarize chapters, or test your knowledge with AI-generated practice quizzes.'}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
          >
            <FileUp className="h-4 w-4" />
            <span>Upload PDF</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('chatbot')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Ask Tutor</span>
          </button>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Real Computed Metrics Strip */}
      <section aria-label="Study Statistics">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Uploaded PDFs</p>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {loading ? '—' : data?.stats.documentsCount ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">
              {loading ? 'Loading...' : `${data?.stats.totalPages ?? 0} total pages indexed`}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Quizzes Completed</p>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {loading ? '—' : data?.stats.quizzesCompleted ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-500">Graded MCQ attempts</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Average Quiz Score</p>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {loading
                ? '—'
                : data?.stats.averageScorePercent !== null &&
                  data?.stats.averageScorePercent !== undefined
                ? `${data.stats.averageScorePercent}%`
                : 'No quizzes yet'}
            </p>
            <p className="mt-1 text-xs text-slate-500">Calculated from submitted tests</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Saved Summaries</p>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {loading ? '—' : data?.stats.summariesCount ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-500">Chapter &amp; exam outlines</p>
          </div>
        </div>
      </section>

      {/* Study Tools Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Study Tools</h2>
          <span className="text-xs text-slate-500">Select a module to start studying</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {STUDY_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.route}
                className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-indigo-300 transition-colors"
              >
                <div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="mt-3.5 font-display text-base font-semibold text-slate-900">
                    {tool.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                    {tool.description}
                  </p>
                </div>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => onNavigate(tool.route)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
                  >
                    <span>{tool.actionLabel}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Latest Quiz Scores & Recent Study Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Latest Quiz Scores
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('quiz')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              Take a Quiz
            </button>
          </div>

          {!loading && (!data || data.latestQuizzes.length === 0) ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-600">No completed quizzes yet.</p>
              <p className="mt-1 text-xs text-slate-500">
                Generate an MCQ quiz from your notes to track your score here.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('quiz')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Create First Quiz
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(data?.latestQuizzes || []).map((q) => {
                const pct =
                  q.total_questions > 0 ? Math.round((q.score / q.total_questions) * 100) : 0;
                return (
                  <div key={q.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{q.title}</p>
                      <p className="text-xs text-slate-500 capitalize">
                        {q.difficulty} · {formatTimestamp(q.submitted_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                        {q.score}/{q.total_questions}
                      </p>
                      <p className="font-mono text-xs text-indigo-700 tabular-nums">{pct}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Recent Study Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              <History className="h-3.5 w-3.5" />
              <span>View All</span>
            </button>
          </div>

          {!loading && (!data || data.recentHistory.length === 0) ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-600">Your study timeline is empty.</p>
              <p className="mt-1 text-xs text-slate-500">
                Activities appear automatically as you upload PDFs, ask questions, or summarize notes.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(data?.recentHistory || []).map((item) => (
                <div key={item.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="truncate text-xs text-slate-500 mt-0.5">{item.detail}</p>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-slate-400 tabular-nums">
                    {formatTimestamp(item.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
