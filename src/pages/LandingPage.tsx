import React from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  FileText,
  FileUp,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import type { AppRoute } from '../types.ts';

interface LandingPageProps {
  isAuthenticated: boolean;
  onNavigate: (route: AppRoute) => void;
}

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'RAG-Grounded AI Tutor',
    description:
      'Ask questions in plain English and get explanations anchored directly to your uploaded lecture PDFs with page citations.',
  },
  {
    icon: FileUp,
    title: 'Multi-PDF Study Vault',
    description:
      'Upload textbooks, handouts, and lab notes. Automatic text extraction validates files and flags scanned pages needing OCR.',
  },
  {
    icon: FileText,
    title: 'Chapter Summarizer',
    description:
      'Generate Quick Summaries, Detailed Topic Breakdowns, or Exam Preparation Notes across long multi-page documents.',
  },
  {
    icon: CheckSquare,
    title: 'Adaptive MCQ Quizzes',
    description:
      'Practice 4-option multiple-choice tests across Easy, Medium, and Hard difficulty with instant explanations and score tracking.',
  },
  {
    icon: HelpCircle,
    title: 'Exam Q&A Generator',
    description:
      'Create short-answer, long-answer, viva, and practice-exam question sets organized cleanly by topic.',
  },
  {
    icon: Lightbulb,
    title: 'Concept Simplifier',
    description:
      'Turn dense theories into beginner-friendly steps and real-life analogies, plus one-click "Explain Even Simpler" refinement.',
  },
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Create Your Study Account',
    detail: 'Register securely to keep your PDFs, quiz attempts, and chat threads private to your workspace.',
  },
  {
    step: '02',
    title: 'Upload Course PDFs',
    detail: 'Drop lecture slides or chapter notes. Pages are extracted, indexed into chunks, and prepared for retrieval.',
  },
  {
    step: '03',
    title: 'Study With Grounded AI',
    detail: 'Ask follow-up questions, generate structured summaries, or simplify hard concepts with page-level citations.',
  },
  {
    step: '04',
    title: 'Test & Track Readiness',
    detail: 'Run MCQ practice quizzes and review your saved study history and scores from your dashboard.',
  },
];

export function LandingPage({ isAuthenticated, onNavigate }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="flex items-center gap-2.5 font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <GraduationCap className="h-4.5 w-4.5" />
            </span>
            <span>AI College Study Assistant</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#features"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Features
            </a>
            <a
              href="#workflow"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#trust"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Academic Integrity
            </a>
            <button
              type="button"
              onClick={() => onNavigate(isAuthenticated ? 'dashboard' : 'login')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              {isAuthenticated ? 'Dashboard' : 'Sign In'}
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onNavigate(isAuthenticated ? 'dashboard' : 'register')}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
            >
              <span>{isAuthenticated ? 'Open Workspace' : 'Get Started'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Split Section */}
        <section className="border-b border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center">
                <p className="text-xs font-medium text-indigo-700 mb-3">
                  Personal Academic Workspace · PDF Notes &amp; Exam Prep
                </p>
                <h1 className="font-display text-[clamp(2.25rem,4vw,3.35rem)] font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance]">
                  Turn dense lecture PDFs into clear understanding and exam readiness.
                </h1>
                <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-xl">
                  Upload your course handouts, ask follow-up questions grounded in your notes with
                  page references, summarize chapters, and test yourself with graded MCQ quizzes.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => onNavigate(isAuthenticated ? 'dashboard' : 'register')}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>{isAuthenticated ? 'Go to Dashboard' : 'Create Student Account'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate(isAuthenticated ? 'chatbot' : 'login')}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>{isAuthenticated ? 'Open AI Tutor' : 'Sign In'}</span>
                  </button>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
                  <span>Page-cited PDF retrieval</span>
                  <span aria-hidden="true">·</span>
                  <span>3 summary depth modes</span>
                  <span aria-hidden="true">·</span>
                  <span>Private per-student SQLite vault</span>
                </div>
              </div>

              {/* Crisp Interactive-Style Study Preview Card */}
              <div className="lg:col-span-6 flex">
                <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                      <div className="flex items-center gap-2.5">
                        <BookOpen className="h-4 w-4 text-indigo-600" />
                        <span className="font-display text-sm font-semibold text-slate-900">
                          Operating_Systems_Ch4.pdf
                        </span>
                      </div>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        18 Pages · Indexed
                      </span>
                    </div>

                    <div className="mt-5 space-y-4">
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <p className="text-xs font-medium text-slate-500 mb-1">Student Question</p>
                        <p className="text-sm font-medium text-slate-900">
                          What is the difference between a process and a thread according to my notes?
                        </p>
                      </div>

                      <div className="rounded-lg border border-indigo-200 bg-white p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-indigo-700">
                            Grounded Tutor Answer
                          </span>
                          <span className="font-mono text-xs text-slate-500">
                            Page 4 · Page 5
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          A <strong className="font-semibold text-slate-900">process</strong> is an
                          independent program in execution with its own isolated memory space, while
                          a <strong className="font-semibold text-slate-900">thread</strong> is a
                          lightweight execution unit inside a process that shares the same heap and
                          code segment with sibling threads.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-200 grid grid-cols-3 gap-4 text-left">
                    <div>
                      <p className="text-xs text-slate-500">Summary Mode</p>
                      <p className="mt-0.5 font-display text-sm font-semibold text-slate-900">
                        Exam Prep
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Quiz Check</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                        4-Option MCQ
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Explanation</p>
                      <p className="mt-0.5 font-display text-sm font-semibold text-slate-900">
                        Beginner Ready
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Features Section */}
        <section id="features" className="py-16 lg:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-indigo-700">Study Toolkit</p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                Six focused tools built around how college students actually revise.
              </h2>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.title}
                    className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 font-display text-base font-semibold text-slate-900">
                        {feat.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                        {feat.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="border-t border-b border-slate-200 bg-white py-16 lg:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-blue-700">Workflow</p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                From raw lecture slides to exam-day confidence in four steps.
              </h2>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {WORKFLOW_STEPS.map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-6"
                >
                  <span className="font-mono text-xs font-semibold text-indigo-700 tabular-nums">
                    {item.step}
                  </span>
                  <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Academic Reliability Section */}
        <section id="trust" className="py-16 lg:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-slate-200 bg-white p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Grounded &amp; Transparent</span>
                </div>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900">
                  Honest about what is in your notes and what is general knowledge.
                </h2>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-2xl">
                  When your PDFs do not cover a question, the assistant tells you directly instead
                  of fabricating citations. Every student account isolates uploaded notes, quiz
                  results, and study history cleanly.
                </p>
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Clear source vs. general knowledge separation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Server-validated MCQ grading &amp; score history</span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 flex lg:justify-end">
                <button
                  type="button"
                  onClick={() => onNavigate(isAuthenticated ? 'dashboard' : 'register')}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{isAuthenticated ? 'Return to Workspace' : 'Start Studying Now'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>AI College Study Assistant · Academic Learning Workspace</span>
          <div className="flex items-center gap-5">
            <a
              href="/ai-college-study-assistant.zip"
              download="ai-college-study-assistant.zip"
              className="hover:text-slate-900 transition-colors"
            >
              Download Project ZIP
            </a>
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="hover:text-slate-900 transition-colors"
            >
              Student Login
            </button>
            <button
              type="button"
              onClick={() => onNavigate('register')}
              className="hover:text-slate-900 transition-colors"
            >
              Student Registration
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
