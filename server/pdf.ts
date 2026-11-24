import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { UPLOAD_ROOT } from './db.ts';

export interface ExtractedPage {
  page: number;
  text: string;
}

export interface PdfExtractionResult {
  pageCount: number;
  charCount: number;
  fullText: string;
  pages: ExtractedPage[];
}

export class PdfValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function isPdfMagicHeader(buffer: Buffer): boolean {
  if (buffer.length < 5) {
    return false;
  }
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

export async function extractPdfContent(buffer: Buffer): Promise<PdfExtractionResult> {
  if (!isPdfMagicHeader(buffer)) {
    throw new PdfValidationError(
      'Invalid file format. Please upload a genuine PDF document starting with a valid %PDF header.'
    );
  }

  let loadingTask;
  let pdfDoc;
  try {
    loadingTask = getDocument({
      data: new Uint8Array(buffer),
      verbosity: 0,
      useSystemFonts: true,
    });
    pdfDoc = await loadingTask.promise;
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.toLowerCase().includes('password')) {
      throw new PdfValidationError(
        'This PDF is password-protected. Please remove the password and upload an unlocked PDF.'
      );
    }
    throw new PdfValidationError(
      'The uploaded PDF appears corrupted or unreadable. Please verify the file and try again.'
    );
  }

  const pageCount = pdfDoc.numPages;
  if (!pageCount || pageCount <= 0) {
    await pdfDoc.cleanup();
    await loadingTask.destroy();
    throw new PdfValidationError('This PDF contains zero pages and cannot be processed.');
  }

  const pages: ExtractedPage[] = [];
  let totalChars = 0;

  try {
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const strings: string[] = [];
      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string') {
          strings.push(item.str);
        }
      }
      const cleaned = strings
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      pages.push({ page: pageNum, text: cleaned });
      totalChars += cleaned.replace(/\s/g, '').length;
    }
  } finally {
    await pdfDoc.cleanup();
    await loadingTask.destroy();
  }

  if (totalChars < 20) {
    throw new PdfValidationError(
      'No readable text was found in this PDF. It appears to be empty or a scanned image-based PDF, so OCR may be required before AI study tools can read it.'
    );
  }

  const avgCharsPerPage = totalChars / pageCount;
  if (pageCount >= 2 && avgCharsPerPage < 25) {
    throw new PdfValidationError(
      'Very little selectable text was detected across the pages. This looks like a scanned PDF where OCR may be required.'
    );
  }

  const fullText = pages
    .filter((p) => p.text.length > 0)
    .map((p) => `[Page ${p.page}]\n${p.text}`)
    .join('\n\n');

  return {
    pageCount,
    charCount: fullText.length,
    fullText,
    pages,
  };
}

export function saveUserPdfSafely(userId: number, buffer: Buffer): string {
  const userDir = path.resolve(UPLOAD_ROOT, String(userId));
  if (!userDir.startsWith(UPLOAD_ROOT + path.sep)) {
    throw new Error('Invalid user upload directory.');
  }
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const filename = `${crypto.randomUUID()}.pdf`;
  const targetPath = path.resolve(userDir, filename);
  if (!targetPath.startsWith(userDir + path.sep)) {
    throw new Error('Invalid upload target path.');
  }

  fs.writeFileSync(targetPath, buffer);
  return filename;
}

export function deleteUserPdfSafely(userId: number, storedFilename: string): void {
  const userDir = path.resolve(UPLOAD_ROOT, String(userId));
  const safeBase = path.basename(storedFilename);
  const targetPath = path.resolve(userDir, safeBase);
  if (!targetPath.startsWith(userDir + path.sep)) {
    return;
  }
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
}
