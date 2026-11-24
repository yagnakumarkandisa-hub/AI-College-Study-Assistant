import { embedTexts } from './ai.ts';
import { db } from './db.ts';
import type { ExtractedPage } from './pdf.ts';

export interface TextChunk {
  pageNumber: number;
  chunkIndex: number;
  content: string;
}

export interface RetrievedChunk {
  documentId: number;
  documentName: string;
  pageNumber: number;
  content: string;
  score: number;
}

export function chunkDocumentPages(pages: ExtractedPage[], chunkSize = 850, overlap = 150): TextChunk[] {
  const chunks: TextChunk[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    const text = page.text.trim();
    if (!text) {
      continue;
    }

    if (text.length <= chunkSize) {
      chunks.push({
        pageNumber: page.page,
        chunkIndex: globalIndex++,
        content: text,
      });
      continue;
    }

    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start + chunkSize * 0.6) {
          end = lastSpace;
        }
      }
      const slice = text.slice(start, end).trim();
      if (slice.length > 0) {
        chunks.push({
          pageNumber: page.page,
          chunkIndex: globalIndex++,
          content: slice,
        });
      }
      if (end >= text.length) {
        break;
      }
      start = Math.max(end - overlap, start + 1);
    }
  }

  return chunks;
}

export async function indexDocumentChunks(
  documentId: number,
  userId: number,
  pages: ExtractedPage[]
): Promise<number> {
  const chunks = chunkDocumentPages(pages);
  if (chunks.length === 0) {
    return 0;
  }

  // Cap embeddings per upload to keep indexing responsive
  const textsToEmbed = chunks.slice(0, 60).map((c) => c.content);
  const embeddings = await embedTexts(textsToEmbed);

  const insertStmt = db.prepare(`
    INSERT INTO document_chunks (document_id, user_id, page_number, chunk_index, content, embedding_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const vec = i < embeddings.length ? embeddings[i] : null;
    insertStmt.run(
      documentId,
      userId,
      chunk.pageNumber,
      chunk.chunkIndex,
      chunk.content,
      vec ? JSON.stringify(vec) : null
    );
  }

  return chunks.length;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

function lexicalScore(query: string, content: string): number {
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'of', 'to', 'in',
    'for', 'what', 'how', 'why', 'when', 'where', 'who', 'explain', 'about', 'from',
    'with', 'that', 'this', 'these', 'those', 'are', 'was', 'were', 'can', 'you', 'my',
  ]);
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (tokens.length === 0) {
    return 0;
  }
  const lowerContent = content.toLowerCase();
  let hits = 0;
  for (const token of tokens) {
    if (lowerContent.includes(token)) {
      hits += 1;
    }
  }
  return hits / tokens.length;
}

export async function retrieveRelevantChunks(
  userId: number,
  query: string,
  documentId?: number | null,
  topK = 5
): Promise<RetrievedChunk[]> {
  const rows = documentId
    ? (db
        .prepare(
          `
          SELECT dc.document_id, d.original_name AS document_name, dc.page_number, dc.content, dc.embedding_json
          FROM document_chunks dc
          JOIN documents d ON d.id = dc.document_id
          WHERE dc.user_id = ? AND dc.document_id = ?
          `
        )
        .all(userId, documentId) as Array<{
        document_id: number;
        document_name: string;
        page_number: number;
        content: string;
        embedding_json: string | null;
      }>)
    : (db
        .prepare(
          `
          SELECT dc.document_id, d.original_name AS document_name, dc.page_number, dc.content, dc.embedding_json
          FROM document_chunks dc
          JOIN documents d ON d.id = dc.document_id
          WHERE dc.user_id = ?
          `
        )
        .all(userId) as Array<{
        document_id: number;
        document_name: string;
        page_number: number;
        content: string;
        embedding_json: string | null;
      }>);

  if (rows.length === 0) {
    return [];
  }

  const hasEmbeddings = rows.some((r) => Boolean(r.embedding_json));
  let queryVec: number[] | null = null;

  if (hasEmbeddings) {
    const [embedded] = await embedTexts([query]);
    queryVec = embedded ?? null;
  }

  const scored: RetrievedChunk[] = rows.map((row) => {
    const lex = lexicalScore(query, row.content);
    let sim = 0;
    if (queryVec && row.embedding_json) {
      try {
        const chunkVec = JSON.parse(row.embedding_json) as number[];
        sim = cosineSimilarity(queryVec, chunkVec);
      } catch {
        sim = 0;
      }
    }
    const combined = queryVec ? sim * 0.8 + lex * 0.2 : lex;
    return {
      documentId: row.document_id,
      documentName: row.document_name,
      pageNumber: row.page_number,
      content: row.content,
      score: combined,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
