import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Loader2,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { apiRequest, ApiError, formatTimestamp } from '../lib/api.ts';
import type { DocumentSummary, QuizItem } from '../types.ts';

interface QuizPageProps {
  preselectedDocId?: number | null;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function QuizPage({ preselectedDocId }: QuizPageProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<QuizItem | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);

  const [sourceType, setSourceType] = useState<'pdf' | 'topic'>(
    preselectedDocId ? 'pdf' : 'pdf'
  );
  const [selectedDocId, setSelectedDocId] = useState<string>(
    preselectedDocId ? String(preselectedDocId) : ''
  );
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (preselectedDocId) {
      setSourceType('pdf');
      setSelectedDocId(String(preselectedDocId));
    }
  }, [preselectedDocId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [docsRes, quizRes] = await Promise.all([
          apiRequest<{ documents: DocumentSummary[] }>('/documents'),
          apiRequest<{ quizzes: QuizItem[] }>('/quizzes'),
        ]);
        if (active) {
          setDocuments(docsRes.documents);
          setQuizzes(quizRes.quizzes);
          if (docsRes.documents.length > 0 && !preselectedDocId) {
            setSelectedDocId(String(docsRes.documents[0].id));
          } else if (docsRes.documents.length === 0 && !preselectedDocId) {
            setSourceType('topic');
          }
          if (quizRes.quizzes.length > 0) {
            const latest = quizRes.quizzes[0];
            setActiveQuiz(latest);
            setSelectedAnswers(
              latest.userAnswers || new Array(latest.questions.length).fill(-1)
            );
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof ApiError ? err.message : 'Unable to load quizzes.');
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

  const selectQuizForView = (quiz: QuizItem) => {
    setError('');
    setActiveQuiz(quiz);
    setSelectedAnswers(quiz.userAnswers || new Array(quiz.questions.length).fill(-1));
  };

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generating) return;
    setError('');

    if (sourceType === 'pdf' && !selectedDocId) {
      setError('Please upload or select a PDF document, or switch to Custom Topic.');
      return;
    }
    if (sourceType === 'topic' && topic.trim().length < 2) {
      setError('Please enter a subject or topic for your quiz.');
      return;
    }

    setGenerating(true);
    try {
      const res = await apiRequest<{ quiz: QuizItem }>('/quizzes/generate', {
        method: 'POST',
        body: {
          documentId: sourceType === 'pdf' ? Number(selectedDocId) : null,
          topic: topic.trim(),
          numQuestions,
          difficulty,
        },
      });
      setQuizzes((prev) => [res.quiz, ...prev]);
      setActiveQuiz(res.quiz);
      setSelectedAnswers(new Array(res.quiz.questions.length).fill(-1));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate quiz.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz || submitting) return;
    setError('');

    if (selectedAnswers.some((a) => a < 0 || a > 3)) {
      setError('Please answer all questions before submitting your quiz.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{ quiz: QuizItem }>(`/quizzes/${activeQuiz.id}/submit`, {
        method: 'POST',
        body: { answers: selectedAnswers },
      });
      setActiveQuiz(res.quiz);
      setQuizzes((prev) => prev.map((q) => (q.id === res.quiz.id ? res.quiz : q)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to grade quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTryAgain = async () => {
    if (!activeQuiz) return;
    setError('');
    try {
      const res = await apiRequest<{ quiz: QuizItem }>(`/quizzes/${activeQuiz.id}/retake`, {
        method: 'POST',
      });
      setActiveQuiz(res.quiz);
      setSelectedAnswers(new Array(res.quiz.questions.length).fill(-1));
      setQuizzes((prev) => prev.map((q) => (q.id === res.quiz.id ? res.quiz : q)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reset quiz.');
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Loading MCQ quiz workspace...
      </div>
    );
  }

  const answeredCount = selectedAnswers.filter((a) => a >= 0).length;
  const correctCount = activeQuiz?.submitted ? activeQuiz.score ?? 0 : 0;
  const incorrectCount = activeQuiz?.submitted
    ? activeQuiz.totalQuestions - correctCount
    : 0;
  const percentScore =
    activeQuiz?.submitted && activeQuiz.totalQuestions > 0
      ? Math.round((correctCount / activeQuiz.totalQuestions) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Quiz Builder & Saved Quizzes */}
      <div className="lg:col-span-4 space-y-6">
        <form
          onSubmit={handleGenerateQuiz}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">MCQ Quiz Generator</h1>
            <p className="mt-1 text-xs text-slate-500">
              Generate 4-option quizzes grounded in your PDF notes or any college topic.
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
              <label
                htmlFor="quiz-pdf-select"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Select Uploaded PDF
              </label>
              {documents.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  No PDFs uploaded yet. Switch to Custom Topic or upload notes first.
                </p>
              ) : (
                <select
                  id="quiz-pdf-select"
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
              <label
                htmlFor="quiz-topic-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Subject or Topic
              </label>
              <input
                id="quiz-topic-input"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Data Structures & Binary Trees"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="quiz-count"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Questions
              </label>
              <select
                id="quiz-count"
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none tabular-nums"
              >
                <option value={3}>3 Questions</option>
                <option value={5}>5 Questions</option>
                <option value={8}>8 Questions</option>
                <option value={10}>10 Questions</option>
                <option value={15}>15 Questions</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="quiz-difficulty"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Difficulty
              </label>
              <select
                id="quiz-difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={generating || (sourceType === 'pdf' && documents.length === 0)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating Quiz...</span>
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4" />
                <span>Generate MCQ Quiz</span>
              </>
            )}
          </button>
        </form>

        {quizzes.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-sm font-semibold text-slate-900 mb-3">
              Your Quizzes
            </h2>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {quizzes.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => selectQuizForView(q)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2 ${
                    activeQuiz?.id === q.id
                      ? 'bg-indigo-50 text-indigo-800'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{q.title}</p>
                    <p className="text-[11px] text-slate-500 capitalize">
                      {q.difficulty} · {q.totalQuestions} Qs · {formatTimestamp(q.created_at)}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold shrink-0 tabular-nums">
                    {q.submitted ? `${q.score}/${q.totalQuestions}` : 'Open'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Interactive Quiz Stage */}
      <div className="lg:col-span-8 space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {generating ? (
          <div className="rounded-xl border border-slate-200 bg-white p-14 text-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
            <p className="text-sm font-medium text-slate-700">
              Crafting {numQuestions} {difficulty} multiple-choice questions...
            </p>
          </div>
        ) : !activeQuiz ? (
          <div className="rounded-xl border border-slate-200 bg-white p-14 text-center">
            <p className="text-sm font-medium text-slate-700">No quiz selected yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Configure your quiz options on the left and click &ldquo;Generate MCQ Quiz&rdquo;.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Quiz Header & Score Summary */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-indigo-700 capitalize">
                    {activeQuiz.difficulty} Difficulty · {activeQuiz.totalQuestions} Questions
                  </p>
                  <h2 className="mt-1 font-display text-lg font-bold text-slate-900">
                    {activeQuiz.title}
                  </h2>
                </div>

                {activeQuiz.submitted ? (
                  <button
                    type="button"
                    onClick={handleTryAgain}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Try Again</span>
                  </button>
                ) : (
                  <span className="font-mono text-xs font-medium text-slate-600 tabular-nums">
                    Answered {answeredCount} / {activeQuiz.totalQuestions}
                  </span>
                )}
              </div>

              {activeQuiz.submitted && (
                <div className="mt-5 pt-5 border-t border-slate-200 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Score</p>
                    <p className="mt-1 font-display text-2xl font-bold text-indigo-700 tabular-nums">
                      {percentScore}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Correct</p>
                    <p className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums">
                      {correctCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Incorrect</p>
                    <p className="mt-1 font-display text-2xl font-bold text-red-600 tabular-nums">
                      {incorrectCount}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Questions List */}
            {activeQuiz.questions.map((q, qIdx) => {
              const userChoice = selectedAnswers[qIdx] ?? -1;
              const isSubmitted = activeQuiz.submitted;
              const isCorrect = isSubmitted && userChoice === q.correctIndex;

              return (
                <div
                  key={qIdx}
                  className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-display text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                      <span className="font-mono text-indigo-600 mr-2 tabular-nums">
                        {qIdx + 1}.
                      </span>
                      {q.question}
                    </h3>
                    {q.pageRef && (
                      <span className="font-mono text-xs text-slate-500 shrink-0">
                        {q.pageRef}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {q.options.map((opt, optIdx) => {
                      const selected = userChoice === optIdx;
                      const isRightOption = isSubmitted && q.correctIndex === optIdx;
                      const isWrongSelected =
                        isSubmitted && selected && q.correctIndex !== optIdx;

                      let optionClass =
                        'border-slate-200 bg-white text-slate-800 hover:border-slate-300';
                      if (!isSubmitted && selected) {
                        optionClass = 'border-indigo-600 bg-indigo-50/70 text-indigo-950';
                      } else if (isRightOption) {
                        optionClass = 'border-emerald-500 bg-emerald-50 text-emerald-950';
                      } else if (isWrongSelected) {
                        optionClass = 'border-red-400 bg-red-50 text-red-950';
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={isSubmitted}
                          onClick={() => {
                            const copy = [...selectedAnswers];
                            copy[qIdx] = optIdx;
                            setSelectedAnswers(copy);
                          }}
                          className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors flex items-center justify-between gap-3 ${optionClass}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-semibold text-slate-500 shrink-0">
                              {OPTION_LETTERS[optIdx]}.
                            </span>
                            <span>{opt}</span>
                          </div>
                          {isRightOption && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          )}
                          {isWrongSelected && (
                            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {isSubmitted && q.explanation && (
                    <div
                      className={`rounded-lg border p-3.5 text-xs leading-relaxed ${
                        isCorrect
                          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <p className="font-semibold mb-1">
                        {isCorrect
                          ? 'Correct'
                          : `Incorrect · Correct Answer: ${OPTION_LETTERS[q.correctIndex ?? 0]}`}
                      </p>
                      <p>{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}

            {!activeQuiz.submitted && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmitQuiz}
                  disabled={submitting || answeredCount < activeQuiz.totalQuestions}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Grading Quiz...' : 'Submit Answers'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
