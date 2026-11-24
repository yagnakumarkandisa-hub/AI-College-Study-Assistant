import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  FileUp,
  Loader2,
  Send,
  Trash2,
} from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer.tsx';
import { apiRequest, ApiError, formatTimestamp } from '../lib/api.ts';
import type { AppRoute, ChatMessage, DocumentSummary } from '../types.ts';

interface ChatbotPageProps {
  onNavigate: (route: AppRoute) => void;
  preselectedDocId?: number | null;
}

const STARTER_PROMPTS = [
  'Summarize the key concepts from my uploaded lecture notes.',
  'What is machine learning and how does supervised learning work?',
  'Explain the main formulas or definitions I should review for my exam.',
  'Quiz me with a quick conceptual question from my notes.',
];

export function ChatbotPage({ onNavigate, preselectedDocId }: ChatbotPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>(
    preselectedDocId ? String(preselectedDocId) : 'all'
  );
  const [input, setInput] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (preselectedDocId) {
      setSelectedDoc(String(preselectedDocId));
    }
  }, [preselectedDocId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [chatRes, docsRes] = await Promise.all([
          apiRequest<{ messages: ChatMessage[] }>('/chat'),
          apiRequest<{ documents: DocumentSummary[] }>('/documents'),
        ]);
        if (active) {
          setMessages(chatRes.messages);
          setDocuments(docsRes.documents);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof ApiError ? err.message : 'Unable to load chat history.');
        }
      } finally {
        if (active) {
          setInitialLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const sendMessage = async (textOverride?: string) => {
    const trimmed = (textOverride ?? input).trim();
    if (!trimmed || sending) return;

    setError('');
    setSending(true);
    if (!textOverride) {
      setInput('');
    }

    const tempId = Date.now();
    const optimisticUserMsg: ChatMessage = {
      id: tempId,
      documentId: selectedDoc !== 'all' && selectedDoc !== 'none' ? Number(selectedDoc) : null,
      role: 'user',
      content: trimmed,
      citations: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);

    try {
      const docPayload =
        selectedDoc === 'all' ? null : selectedDoc === 'none' ? 0 : Number(selectedDoc);

      const res = await apiRequest<{
        reply: string;
        citations: ChatMessage['citations'];
        messageId: number;
      }>('/chat', {
        method: 'POST',
        body: {
          message: trimmed,
          documentId: docPayload,
        },
      });

      const assistantMsg: ChatMessage = {
        id: res.messageId,
        documentId: typeof docPayload === 'number' && docPayload > 0 ? docPayload : null,
        role: 'assistant',
        content: res.reply,
        citations: res.citations || [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (!textOverride) {
        setInput(trimmed);
      }
      setError(
        err instanceof ApiError
          ? err.message
          : 'The AI assistant is currently unavailable. Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleClearHistory = async () => {
    if (messages.length === 0 || clearing) return;
    setClearing(true);
    setError('');
    try {
      await apiRequest('/chat', { method: 'DELETE' });
      setMessages([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to clear chat history.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] min-h-[520px] rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="chat-doc-scope" className="text-xs font-medium text-slate-600">
            Study Context:
          </label>
          <select
            id="chat-doc-scope"
            value={selectedDoc}
            onChange={(e) => setSelectedDoc(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-600 focus:outline-none"
          >
            <option value="all">
              All Uploaded PDFs ({documents.length})
            </option>
            <option value="none">General Subject Tutor (No PDF Context)</option>
            {documents.map((doc) => (
              <option key={doc.id} value={String(doc.id)}>
                {doc.original_name} ({doc.page_count}p)
              </option>
            ))}
          </select>

          {documents.length === 0 && (
            <button
              type="button"
              onClick={() => onNavigate('upload')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              <FileUp className="h-3.5 w-3.5" />
              <span>Upload PDF notes</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleClearHistory}
          disabled={messages.length === 0 || clearing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Clear Chat</span>
        </button>
      </div>

      {/* Messages Viewport */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 bg-slate-50/60">
        {initialLoading ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-500 gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            <span>Loading conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="max-w-2xl mx-auto py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <BookOpen className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold text-slate-900">
              Ask Your Personal AI College Tutor
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 max-w-lg mx-auto">
              Ask about difficult concepts, follow up on lecture slides, or query your uploaded PDF
              study materials with automatic page citations.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-700 hover:border-indigo-300 hover:text-slate-900 transition-colors text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-xl px-4 py-3.5 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-1">
                  <span
                    className={`text-[11px] font-medium ${
                      msg.role === 'user' ? 'text-indigo-100' : 'text-slate-500'
                    }`}
                  >
                    {msg.role === 'user' ? 'You' : 'AI Study Assistant'}
                  </span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {formatTimestamp(msg.created_at)}
                  </span>
                </div>

                {msg.role === 'user' ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <>
                    <MarkdownRenderer content={msg.content} />
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-[11px] font-medium text-slate-500 mb-1.5">
                          Referenced Study Material
                        </p>
                        <div className="space-y-1.5">
                          {msg.citations.map((cit, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                            >
                              <p className="font-medium text-indigo-700">
                                {cit.docName} · Page {cit.page}
                              </p>
                              <p className="text-slate-600 mt-0.5 line-clamp-2">{cit.snippet}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-2.5 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              <span>Reading your study context and preparing an explanation...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2.5 border-t border-red-200 bg-red-50 flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Input Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="p-3.5 border-t border-slate-200 bg-white flex items-end gap-3"
      >
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask a question about your subject or uploaded PDF notes..."
          className="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Send className="h-4 w-4" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}
