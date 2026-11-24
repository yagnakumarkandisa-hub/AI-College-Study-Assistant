import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  FileUp,
  Loader2,
  MessageSquare,
  Trash2,
  X,
} from 'lucide-react';
import { apiRequest, ApiError, formatBytes, formatTimestamp } from '../lib/api.ts';
import type { AppRoute, DocumentDetail, DocumentSummary } from '../types.ts';

interface UploadPageProps {
  onNavigateWithDoc: (route: AppRoute, docId: number) => void;
}

export function UploadPage({ onNavigateWithDoc }: UploadPageProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [previewDoc, setPreviewDoc] = useState<DocumentDetail | null>(null);
  const [previewPageIdx, setPreviewPageIdx] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDocuments = async () => {
    try {
      const res = await apiRequest<{ documents: DocumentSummary[] }>('/documents');
      setDocuments(res.documents);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load uploaded documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError('');
    setSuccessMsg('');

    const files = Array.from(fileList);
    if (files.length > 5) {
      setError('You can upload up to 5 PDF files at once.');
      return;
    }

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setError(`"${file.name}" is not a PDF file. Only .pdf documents are supported.`);
        return;
      }
      if (file.size === 0) {
        setError(`"${file.name}" is empty (0 bytes). Please select a valid PDF.`);
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setError(`"${file.name}" exceeds the 15 MB per-file upload limit.`);
        return;
      }
    }

    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    setUploading(true);
    try {
      const res = await apiRequest<{
        documents: Array<{ id: number; original_name: string; page_count: number }>;
        errors?: Array<{ filename: string; error: string }>;
      }>('/documents/upload', {
        method: 'POST',
        formData,
      });

      const uploadedCount = res.documents.length;
      const totalPages = res.documents.reduce((acc, d) => acc + d.page_count, 0);
      setSuccessMsg(
        `Processed ${uploadedCount} PDF${uploadedCount === 1 ? '' : 's'} (${totalPages} total pages extracted and indexed).`
      );
      if (res.errors && res.errors.length > 0) {
        setError(res.errors.map((e) => `${e.filename}: ${e.error}`).join(' '));
      }
      await loadDocuments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to upload PDF.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePreview = async (docId: number) => {
    setPreviewLoading(true);
    setError('');
    try {
      const res = await apiRequest<{ document: DocumentDetail }>(`/documents/${docId}`);
      setPreviewDoc(res.document);
      setPreviewPageIdx(0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load PDF preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDelete = async (docId: number, name: string) => {
    setError('');
    setSuccessMsg('');
    try {
      await apiRequest(`/documents/${docId}`, { method: 'DELETE' });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (previewDoc?.id === docId) {
        setPreviewDoc(null);
      }
      setSuccessMsg(`Removed "${name}" from your study vault.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete document.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Dropzone Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">
              Upload PDF Study Notes
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload up to 5 PDFs at a time (max 15 MB each). Text is extracted page by page and
              indexed for AI tutoring.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {documents.length} {documents.length === 1 ? 'document' : 'documents'} stored
          </span>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragOver
              ? 'border-indigo-500 bg-indigo-50/60'
              : 'border-slate-300 bg-slate-50/70 hover:border-slate-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="pdf-file-input"
          />

          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <FileUp className="h-6 w-6" />
            )}
          </div>

          <h2 className="mt-3 font-display text-sm font-semibold text-slate-900">
            {uploading ? 'Extracting PDF text and building search index...' : 'Drop your PDF study notes here'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Lecture slides, textbook chapters, and syllabus handouts (.pdf)
          </p>

          <label
            htmlFor="pdf-file-input"
            className={`mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 cursor-pointer transition-colors ${
              uploading ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <span>Choose PDF Files</span>
          </label>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}
      </section>

      {/* Uploaded Documents List */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Your Study Material Library
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading your PDFs...</div>
        ) : documents.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">No PDF study notes uploaded yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Upload a PDF above to preview extracted pages, generate summaries, or quiz yourself.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
                    <p className="truncate font-medium text-sm text-slate-900">
                      {doc.original_name}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                    <span>{doc.page_count} pages</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatBytes(doc.file_size)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{doc.char_count.toLocaleString()} characters</span>
                    <span aria-hidden="true">·</span>
                    <span>Uploaded {formatTimestamp(doc.created_at)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePreview(doc.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Preview Text</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateWithDoc('chatbot', doc.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Ask AI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateWithDoc('summary', doc.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 whitespace-nowrap"
                  >
                    <span>Summarize</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateWithDoc('quiz', doc.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 whitespace-nowrap"
                  >
                    <span>MCQ Quiz</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id, doc.original_name)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    aria-label={`Delete ${doc.original_name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Extracted Text Preview Panel */}
      {(previewLoading || previewDoc) && (
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-indigo-700">Extracted Document Preview</p>
              <h3 className="truncate font-display text-base font-semibold text-slate-900">
                {previewDoc ? previewDoc.original_name : 'Loading...'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setPreviewDoc(null)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close document preview"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {previewLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading extracted pages...</div>
          ) : previewDoc && previewDoc.pages.length > 0 ? (
            <div className="p-6">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <span className="font-mono text-xs font-medium text-slate-600 tabular-nums">
                  Page {previewDoc.pages[previewPageIdx]?.page} of {previewDoc.pages.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={previewPageIdx === 0}
                    onClick={() => setPreviewPageIdx((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Previous</span>
                  </button>
                  <button
                    type="button"
                    disabled={previewPageIdx >= previewDoc.pages.length - 1}
                    onClick={() =>
                      setPreviewPageIdx((i) => Math.min(previewDoc.pages.length - 1, i + 1))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                {previewDoc.pages[previewPageIdx]?.text || 'No selectable text on this page.'}
              </div>
            </div>
          ) : (
            <div className="p-6 text-sm text-slate-500">No page text available.</div>
          )}
        </section>
      )}
    </div>
  );
}
