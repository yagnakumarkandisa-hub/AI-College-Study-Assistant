import express from 'express';
import multer from 'multer';
import {
  AiServiceError,
  generateMcqJson,
  generateQaJson,
  generateStudyText,
} from './ai.ts';
import {
  type AuthenticatedRequest,
  clearSessionCookie,
  createSession,
  deleteSessionByHash,
  hashPassword,
  requireAuth,
  setSessionCookie,
  verifyPassword,
} from './auth.ts';
import { db, recordStudyHistory } from './db.ts';
import {
  deleteUserPdfSafely,
  extractPdfContent,
  PdfValidationError,
  saveUserPdfSafely,
} from './pdf.ts';
import { indexDocumentChunks, retrieveRelevantChunks } from './rag.ts';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    const isPdfExt = file.originalname.toLowerCase().endsWith('.pdf');
    const isPdfMime =
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/x-pdf' ||
      file.mimetype === 'application/octet-stream';
    if (!isPdfExt || !isPdfMime) {
      cb(new PdfValidationError('Only PDF files (.pdf) are allowed.'));
      return;
    }
    cb(null, true);
  },
});

export function createApiRouter(): express.Router {
  const router = express.Router();

  // Health check
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // --- Authentication Routes ---
  router.post('/auth/register', (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const major = typeof req.body?.major === 'string' ? req.body.major.trim().slice(0, 100) : '';
    const yearLevel =
      typeof req.body?.yearLevel === 'string' && req.body.yearLevel.trim()
        ? req.body.yearLevel.trim().slice(0, 50)
        : 'Undergraduate';

    if (name.length < 2 || name.length > 80) {
      res.status(400).json({ error: 'Please enter your full name (2 to 80 characters).' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid college or personal email address.' });
      return;
    }
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 6 and 128 characters.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
      return;
    }

    const passwordHash = hashPassword(password);
    const result = db
      .prepare(
        `
        INSERT INTO users (name, email, password_hash, major, year_level)
        VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(name, email, passwordHash, major, yearLevel);

    const userId = Number(result.lastInsertRowid);
    const user = db
      .prepare(
        `SELECT id, name, email, major, year_level, study_goal, preferred_explanation_style, created_at
         FROM users WHERE id = ?`
      )
      .get(userId);

    const token = createSession(userId);
    setSessionCookie(res, req, token);
    res.status(201).json({ token, user });
  });

  router.post('/auth/login', (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const row = db
      .prepare(
        `SELECT id, name, email, password_hash, major, year_level, study_goal, preferred_explanation_style, created_at
         FROM users WHERE email = ?`
      )
      .get(email) as
      | {
          id: number;
          name: string;
          email: string;
          password_hash: string;
          major: string;
          year_level: string;
          study_goal: string;
          preferred_explanation_style: string;
          created_at: string;
        }
      | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = createSession(row.id);
    setSessionCookie(res, req, token);

    const safeUser = {
      id: row.id,
      name: row.name,
      email: row.email,
      major: row.major,
      year_level: row.year_level,
      study_goal: row.study_goal,
      preferred_explanation_style: row.preferred_explanation_style,
      created_at: row.created_at,
    };
    res.json({ token, user: safeUser });
  });

  router.post('/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.sessionTokenHash) {
      deleteSessionByHash(req.sessionTokenHash);
    }
    clearSessionCookie(res, req);
    res.json({ ok: true });
  });

  router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  // --- Dashboard Metrics (strictly real computed database records) ---
  router.get('/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;

    const docStats = db
      .prepare('SELECT COUNT(*) AS count, COALESCE(SUM(page_count), 0) AS pages FROM documents WHERE user_id = ?')
      .get(userId) as { count: number; pages: number };

    const quizStats = db
      .prepare(
        `SELECT COUNT(*) AS completed,
                COALESCE(AVG(CAST(score AS REAL) / NULLIF(total_questions, 0) * 100), 0) AS avg_percent
         FROM quizzes
         WHERE user_id = ? AND submitted = 1`
      )
      .get(userId) as { completed: number; avg_percent: number };

    const latestQuizzes = db
      .prepare(
        `SELECT id, title, difficulty, score, total_questions, submitted_at
         FROM quizzes
         WHERE user_id = ? AND submitted = 1
         ORDER BY datetime(submitted_at) DESC
         LIMIT 5`
      )
      .all(userId);

    const summaryCount = db
      .prepare('SELECT COUNT(*) AS count FROM summaries WHERE user_id = ?')
      .get(userId) as { count: number };

    const recentHistory = db
      .prepare(
        `SELECT id, activity_type, title, detail, created_at
         FROM study_history
         WHERE user_id = ?
         ORDER BY id DESC
         LIMIT 8`
      )
      .all(userId);

    const recentDocuments = db
      .prepare(
        `SELECT id, original_name, page_count, file_size, created_at
         FROM documents
         WHERE user_id = ?
         ORDER BY id DESC
         LIMIT 4`
      )
      .all(userId);

    res.json({
      stats: {
        documentsCount: docStats.count,
        totalPages: docStats.pages,
        quizzesCompleted: quizStats.completed,
        averageScorePercent: quizStats.completed > 0 ? Math.round(quizStats.avg_percent) : null,
        summariesCount: summaryCount.count,
      },
      latestQuizzes,
      recentHistory,
      recentDocuments,
    });
  });

  // --- PDF Document Management ---
  router.get('/documents', requireAuth, (req: AuthenticatedRequest, res) => {
    const docs = db
      .prepare(
        `SELECT id, original_name, file_size, page_count, char_count, created_at
         FROM documents
         WHERE user_id = ?
         ORDER BY id DESC`
      )
      .all(req.user!.id);
    res.json({ documents: docs });
  });

  router.get('/documents/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const docId = Number(req.params.id);
    if (!Number.isInteger(docId) || docId <= 0) {
      res.status(400).json({ error: 'Invalid document ID.' });
      return;
    }

    const doc = db
      .prepare(
        `SELECT id, original_name, file_size, page_count, char_count, extracted_text, pages_json, created_at
         FROM documents
         WHERE id = ? AND user_id = ?`
      )
      .get(docId, req.user!.id) as
      | {
          id: number;
          original_name: string;
          file_size: number;
          page_count: number;
          char_count: number;
          extracted_text: string;
          pages_json: string;
          created_at: string;
        }
      | undefined;

    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    let pages: Array<{ page: number; text: string }> = [];
    try {
      pages = JSON.parse(doc.pages_json);
    } catch {
      pages = [];
    }

    res.json({
      document: {
        id: doc.id,
        original_name: doc.original_name,
        file_size: doc.file_size,
        page_count: doc.page_count,
        char_count: doc.char_count,
        extracted_text: doc.extracted_text,
        pages,
        created_at: doc.created_at,
      },
    });
  });

  router.post(
    '/documents/upload',
    requireAuth,
    (req: AuthenticatedRequest, res, next) => {
      upload.array('files', 5)(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              res.status(400).json({ error: 'File is too large. Maximum allowed PDF size is 15 MB.' });
              return;
            }
            res.status(400).json({ error: `Upload error: ${err.message}` });
            return;
          }
          if (err instanceof PdfValidationError) {
            res.status(err.statusCode).json({ error: err.message });
            return;
          }
          res.status(400).json({ error: 'Invalid file upload.' });
          return;
        }
        next();
      });
    },
    async (req: AuthenticatedRequest, res) => {
      const userId = req.user!.id;
      const files = req.files as Express.Multer.File[] | undefined;

      if (!files || files.length === 0) {
        res.status(400).json({ error: 'Please select at least one PDF file to upload.' });
        return;
      }

      const uploadedDocs: Array<{
        id: number;
        original_name: string;
        file_size: number;
        page_count: number;
        char_count: number;
        chunks_indexed: number;
      }> = [];
      const errors: Array<{ filename: string; error: string }> = [];

      for (const file of files) {
        const cleanName = file.originalname.replace(/[^\w.\-()\s]/g, '_').slice(0, 140) || 'study_notes.pdf';
        try {
          const extracted = await extractPdfContent(file.buffer);
          const storedFilename = saveUserPdfSafely(userId, file.buffer);

          const insertRes = db
            .prepare(
              `INSERT INTO documents (user_id, stored_filename, original_name, file_size, page_count, char_count, extracted_text, pages_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              userId,
              storedFilename,
              cleanName,
              file.size,
              extracted.pageCount,
              extracted.charCount,
              extracted.fullText,
              JSON.stringify(extracted.pages)
            );

          const documentId = Number(insertRes.lastInsertRowid);
          const chunksIndexed = await indexDocumentChunks(documentId, userId, extracted.pages);

          recordStudyHistory(
            userId,
            'upload',
            `Uploaded ${cleanName}`,
            `${extracted.pageCount} page${extracted.pageCount === 1 ? '' : 's'} extracted (${chunksIndexed} RAG segments)`,
            { documentId, pageCount: extracted.pageCount }
          );

          uploadedDocs.push({
            id: documentId,
            original_name: cleanName,
            file_size: file.size,
            page_count: extracted.pageCount,
            char_count: extracted.charCount,
            chunks_indexed: chunksIndexed,
          });
        } catch (err) {
          const message =
            err instanceof PdfValidationError
              ? err.message
              : 'Could not extract text from this PDF file.';
          errors.push({ filename: cleanName, error: message });
        }
      }

      if (uploadedDocs.length === 0) {
        res.status(400).json({
          error: errors[0]?.error || 'No valid PDF files could be processed.',
          errors,
        });
        return;
      }

      res.status(201).json({
        documents: uploadedDocs,
        errors,
      });
    }
  );

  router.delete('/documents/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const docId = Number(req.params.id);
    if (!Number.isInteger(docId) || docId <= 0) {
      res.status(400).json({ error: 'Invalid document ID.' });
      return;
    }

    const doc = db
      .prepare('SELECT id, stored_filename FROM documents WHERE id = ? AND user_id = ?')
      .get(docId, req.user!.id) as { id: number; stored_filename: string } | undefined;

    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    db.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?').run(docId, req.user!.id);
    deleteUserPdfSafely(req.user!.id, doc.stored_filename);
    res.json({ ok: true });
  });

  // --- AI Chatbot (RAG Grounded + Multi-turn) ---
  router.get('/chat', requireAuth, (req: AuthenticatedRequest, res) => {
    const messages = db
      .prepare(
        `SELECT id, document_id, role, content, citations_json, created_at
         FROM chat_messages
         WHERE user_id = ?
         ORDER BY id ASC
         LIMIT 100`
      )
      .all(req.user!.id) as Array<{
      id: number;
      document_id: number | null;
      role: 'user' | 'assistant';
      content: string;
      citations_json: string | null;
      created_at: string;
    }>;

    res.json({
      messages: messages.map((m) => ({
        id: m.id,
        documentId: m.document_id,
        role: m.role,
        content: m.content,
        citations: m.citations_json ? JSON.parse(m.citations_json) : [],
        created_at: m.created_at,
      })),
    });
  });

  router.delete('/chat', requireAuth, (req: AuthenticatedRequest, res) => {
    db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(req.user!.id);
    res.json({ ok: true });
  });

  router.post('/chat', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const rawDocId = req.body?.documentId;

    if (!message || message.length > 4000) {
      res.status(400).json({ error: 'Please enter a question between 1 and 4000 characters.' });
      return;
    }

    // documentMode: 'none' (0) => general subject tutor; null => all uploaded notes; positive int => specific PDF
    let targetDocId: number | null = null;
    let useNotes = true;

    if (rawDocId === 0 || rawDocId === 'none') {
      useNotes = false;
    } else if (rawDocId !== undefined && rawDocId !== null && rawDocId !== '' && rawDocId !== 'all') {
      const parsedId = Number(rawDocId);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        res.status(400).json({ error: 'Invalid document selection.' });
        return;
      }
      const owned = db
        .prepare('SELECT id FROM documents WHERE id = ? AND user_id = ?')
        .get(parsedId, userId);
      if (!owned) {
        res.status(404).json({ error: 'Selected PDF document was not found.' });
        return;
      }
      targetDocId = parsedId;
    }

    try {
      const retrieved = useNotes
        ? await retrieveRelevantChunks(userId, message, targetDocId, 5)
        : [];

      const citations = retrieved
        .filter((c) => c.score > 0.05 || retrieved.length <= 3)
        .slice(0, 4)
        .map((c) => ({
          documentId: c.documentId,
          docName: c.documentName,
          page: c.pageNumber,
          snippet: c.content.slice(0, 180) + (c.content.length > 180 ? '...' : ''),
        }));

      const recentTurns = db
        .prepare(
          `SELECT role, content
           FROM chat_messages
           WHERE user_id = ?
           ORDER BY id DESC
           LIMIT 10`
        )
        .all(userId) as Array<{ role: 'user' | 'assistant'; content: string }>;

      const orderedTurns = recentTurns.reverse();

      const contextBlock =
        retrieved.length > 0
          ? retrieved
              .map(
                (c, i) =>
                  `[Excerpt ${i + 1} | Document: "${c.documentName}" | Page ${c.pageNumber}]\n${c.content}`
              )
              .join('\n\n')
          : '';

      const systemInstruction = `
You are an AI College Study Assistant acting as a supportive personal tutor for college students.
Follow these strict rules:
1. Answer in clear, simple English suitable for college students. Avoid unnecessarily complicated jargon; define key terms simply.
2. When excerpts from the student's uploaded PDF notes are provided below, prioritize those notes first.
3. Do NOT invent information and attribute it to the uploaded notes.
4. If the uploaded notes do not contain enough information to answer the question, explicitly state: "Your uploaded notes do not contain enough information on this specific point." Then, if helpful, provide a separate clearly labeled section "**Additional General Knowledge**" so the student clearly sees what came from their document vs. general academic knowledge.
5. Cite document names and page numbers inline (e.g., "(Lecture_Notes.pdf, Page 4)") whenever referencing retrieved excerpts.
6. Maintain conversation context for follow-up questions.
7. Never claim that a generated answer is guaranteed to be 100% error-free or guaranteed to appear on an exam.
8. Format your response cleanly with short paragraphs, headings, or bullet points when helpful.
`.trim();

      const userPromptWithContext = contextBlock
        ? `Retrieved Study Note Excerpts:\n${contextBlock}\n\nStudent Question:\n${message}`
        : message;

      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = orderedTurns.map(
        (t) => ({
          role: t.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: t.content }],
        })
      );
      contents.push({
        role: 'user',
        parts: [{ text: userPromptWithContext }],
      });

      const reply = await generateStudyText({
        systemInstruction,
        contents,
        lowLatency: true,
      });

      db.prepare(
        `INSERT INTO chat_messages (user_id, document_id, role, content, citations_json)
         VALUES (?, ?, 'user', ?, NULL)`
      ).run(userId, targetDocId, message);

      const assistantInsert = db
        .prepare(
          `INSERT INTO chat_messages (user_id, document_id, role, content, citations_json)
           VALUES (?, ?, 'assistant', ?, ?)`
        )
        .run(userId, targetDocId, reply, citations.length > 0 ? JSON.stringify(citations) : null);

      recordStudyHistory(
        userId,
        'chat',
        message.slice(0, 72) + (message.length > 72 ? '...' : ''),
        citations.length > 0
          ? `Answered using ${citations[0].docName} (Page ${citations[0].page})`
          : 'General AI Tutor response',
        { messageId: Number(assistantInsert.lastInsertRowid) }
      );

      res.json({
        reply,
        citations,
        messageId: Number(assistantInsert.lastInsertRowid),
      });
    } catch (err) {
      if (err instanceof AiServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Unable to generate an answer right now. Please try again.' });
    }
  });

  // --- PDF Chapter Summarizer (with chunked map-reduce for long PDFs) ---
  router.get('/summaries', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT s.id, s.document_id, d.original_name AS document_name, s.mode, s.content, s.created_at
         FROM summaries s
         JOIN documents d ON d.id = s.document_id
         WHERE s.user_id = ?
         ORDER BY s.id DESC
         LIMIT 25`
      )
      .all(req.user!.id);
    res.json({ summaries: rows });
  });

  router.post('/summaries', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const documentId = Number(req.body?.documentId);
    const mode = req.body?.mode as 'quick' | 'detailed' | 'exam';

    if (!Number.isInteger(documentId) || documentId <= 0) {
      res.status(400).json({ error: 'Please select a valid uploaded PDF document.' });
      return;
    }
    if (!['quick', 'detailed', 'exam'].includes(mode)) {
      res.status(400).json({ error: 'Invalid summary mode selected.' });
      return;
    }

    const doc = db
      .prepare(
        `SELECT id, original_name, extracted_text, page_count
         FROM documents
         WHERE id = ? AND user_id = ?`
      )
      .get(documentId, userId) as
      | { id: number; original_name: string; extracted_text: string; page_count: number }
      | undefined;

    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    const modeDirectives: Record<string, string> = {
      quick:
        'Create a crisp Quick Summary (approx. 250-400 words) with clear section headings, top takeaways, and core definitions in simple English.',
      detailed:
        'Create a thorough Detailed Summary organized by topic headings and bullet points, covering key concepts, definitions, formulas/mechanisms, and examples present in the notes.',
      exam:
        'Create structured Exam Preparation Notes highlighting must-know definitions, high-yield exam concepts, key comparisons, common pitfalls, and a quick revision checklist.',
    };

    try {
      const fullText = doc.extracted_text;
      let finalSummary = '';

      // Process long documents in manageable sections and combine
      const sectionSize = 14000;
      if (fullText.length <= sectionSize) {
        finalSummary = await generateStudyText({
          systemInstruction:
            'You are an academic note summarizer. Use only facts present in the student document. Use clean Markdown headings and bullet points.',
          contents: `${modeDirectives[mode]}\n\nDocument: "${doc.original_name}" (${doc.page_count} pages)\n\nContent:\n${fullText}`,
        });
      } else {
        const sections: string[] = [];
        for (let i = 0; i < fullText.length && sections.length < 6; i += sectionSize) {
          sections.push(fullText.slice(i, i + sectionSize));
        }

        const sectionSummaries: string[] = [];
        for (let idx = 0; idx < sections.length; idx++) {
          const partSummary = await generateStudyText({
            systemInstruction:
              'Extract all important concepts, definitions, and key points from this section of study notes accurately.',
            contents: `Summarize Section ${idx + 1} of ${sections.length} from "${doc.original_name}" using concise headings and bullet points:\n\n${sections[idx]}`,
            lowLatency: true,
          });
          sectionSummaries.push(`### Section ${idx + 1}\n${partSummary}`);
        }

        finalSummary = await generateStudyText({
          systemInstruction:
            'Combine section notes into one clean, unified study summary using headings, bullet points, definitions, and exam highlights without repeating points.',
          contents: `${modeDirectives[mode]}\n\nCombine these section summaries for "${doc.original_name}":\n\n${sectionSummaries.join('\n\n')}`,
        });
      }

      const insertRes = db
        .prepare(
          `INSERT INTO summaries (user_id, document_id, mode, content)
           VALUES (?, ?, ?, ?)`
        )
        .run(userId, documentId, mode, finalSummary);

      const modeTitle =
        mode === 'quick' ? 'Quick Summary' : mode === 'detailed' ? 'Detailed Summary' : 'Exam Prep Notes';

      recordStudyHistory(
        userId,
        'summary',
        `${modeTitle}: ${doc.original_name}`,
        `Generated ${modeTitle.toLowerCase()} across ${doc.page_count} page(s)`,
        { summaryId: Number(insertRes.lastInsertRowid), documentId, mode }
      );

      res.status(201).json({
        summary: {
          id: Number(insertRes.lastInsertRowid),
          document_id: documentId,
          document_name: doc.original_name,
          mode,
          content: finalSummary,
          created_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      if (err instanceof AiServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Failed to summarize notes. Please try again.' });
    }
  });

  // --- MCQ Quiz Generator & Server-Validated Scoring ---
  router.get('/quizzes', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT q.id, q.document_id, d.original_name AS document_name, q.title, q.difficulty,
                q.questions_json, q.submitted, q.user_answers_json, q.score, q.total_questions,
                q.created_at, q.submitted_at
         FROM quizzes q
         LEFT JOIN documents d ON d.id = q.document_id
         WHERE q.user_id = ?
         ORDER BY q.id DESC
         LIMIT 20`
      )
      .all(req.user!.id) as Array<{
      id: number;
      document_id: number | null;
      document_name: string | null;
      title: string;
      difficulty: string;
      questions_json: string;
      submitted: number;
      user_answers_json: string | null;
      score: number | null;
      total_questions: number;
      created_at: string;
      submitted_at: string | null;
    }>;

    const formatted = rows.map((q) => {
      const fullQuestions = JSON.parse(q.questions_json) as Array<{
        question: string;
        options: string[];
        correctIndex: number;
        explanation: string;
        pageRef?: string;
      }>;
      const sanitizedQuestions = q.submitted
        ? fullQuestions
        : fullQuestions.map(({ question, options, pageRef }) => ({ question, options, pageRef }));

      return {
        id: q.id,
        documentId: q.document_id,
        documentName: q.document_name,
        title: q.title,
        difficulty: q.difficulty,
        submitted: Boolean(q.submitted),
        userAnswers: q.user_answers_json ? JSON.parse(q.user_answers_json) : null,
        score: q.score,
        totalQuestions: q.total_questions,
        questions: sanitizedQuestions,
        created_at: q.created_at,
        submitted_at: q.submitted_at,
      };
    });

    res.json({ quizzes: formatted });
  });

  router.post('/quizzes/generate', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const rawDocId = req.body?.documentId;
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
    const numQuestions = Math.min(15, Math.max(3, Number(req.body?.numQuestions) || 5));
    const difficulty = (['easy', 'medium', 'hard'].includes(req.body?.difficulty)
      ? req.body.difficulty
      : 'medium') as 'easy' | 'medium' | 'hard';

    let documentId: number | null = null;
    let sourceText = '';
    let title = '';

    if (rawDocId) {
      const parsedId = Number(rawDocId);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        res.status(400).json({ error: 'Invalid PDF document selected.' });
        return;
      }
      const doc = db
        .prepare('SELECT id, original_name, extracted_text FROM documents WHERE id = ? AND user_id = ?')
        .get(parsedId, userId) as
        | { id: number; original_name: string; extracted_text: string }
        | undefined;
      if (!doc) {
        res.status(404).json({ error: 'Selected PDF document not found.' });
        return;
      }
      documentId = doc.id;
      sourceText = doc.extracted_text.slice(0, 24000);
      title = topic ? `${doc.original_name} — ${topic}` : doc.original_name;
    } else if (topic.length >= 2) {
      sourceText = `Generate college-level practice MCQs on the topic: "${topic}".`;
      title = topic;
    } else {
      res.status(400).json({ error: 'Please select an uploaded PDF or enter a study topic.' });
      return;
    }

    try {
      const questions = await generateMcqJson({
        sourceText,
        topicLabel: title,
        numQuestions,
        difficulty,
      });

      const insertRes = db
        .prepare(
          `INSERT INTO quizzes (user_id, document_id, title, difficulty, questions_json, total_questions)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(userId, documentId, title, difficulty, JSON.stringify(questions), questions.length);

      const quizId = Number(insertRes.lastInsertRowid);
      const clientQuestions = questions.map(({ question, options, pageRef }) => ({
        question,
        options,
        pageRef,
      }));

      res.status(201).json({
        quiz: {
          id: quizId,
          documentId,
          title,
          difficulty,
          submitted: false,
          userAnswers: null,
          score: null,
          totalQuestions: questions.length,
          questions: clientQuestions,
          created_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      if (err instanceof AiServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Could not generate MCQ quiz. Please try again.' });
    }
  });

  router.post('/quizzes/:id/submit', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const quizId = Number(req.params.id);
    const answers = req.body?.answers;

    if (!Number.isInteger(quizId) || quizId <= 0) {
      res.status(400).json({ error: 'Invalid quiz ID.' });
      return;
    }

    const quiz = db
      .prepare(
        `SELECT id, title, difficulty, questions_json, submitted, total_questions
         FROM quizzes
         WHERE id = ? AND user_id = ?`
      )
      .get(quizId, userId) as
      | {
          id: number;
          title: string;
          difficulty: string;
          questions_json: string;
          submitted: number;
          total_questions: number;
        }
      | undefined;

    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }

    const questions = JSON.parse(quiz.questions_json) as Array<{
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
      pageRef?: string;
    }>;

    if (!Array.isArray(answers) || answers.length !== questions.length) {
      res.status(400).json({ error: 'Please answer every question before submitting.' });
      return;
    }

    const normalizedAnswers: number[] = [];
    let score = 0;

    for (let i = 0; i < questions.length; i++) {
      const choice = Number(answers[i]);
      if (!Number.isInteger(choice) || choice < 0 || choice > 3) {
        res.status(400).json({ error: `Please select a valid option for question ${i + 1}.` });
        return;
      }
      normalizedAnswers.push(choice);
      if (choice === questions[i].correctIndex) {
        score += 1;
      }
    }

    const nowIso = new Date().toISOString();
    db.prepare(
      `UPDATE quizzes
       SET submitted = 1, user_answers_json = ?, score = ?, submitted_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(JSON.stringify(normalizedAnswers), score, nowIso, quizId, userId);

    const pct = Math.round((score / questions.length) * 100);
    recordStudyHistory(
      userId,
      'quiz',
      `Completed Quiz: ${quiz.title}`,
      `Scored ${score}/${questions.length} (${pct}%) on ${quiz.difficulty} difficulty`,
      { quizId, score, totalQuestions: questions.length, percent: pct }
    );

    res.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        difficulty: quiz.difficulty,
        submitted: true,
        userAnswers: normalizedAnswers,
        score,
        totalQuestions: questions.length,
        questions,
        submitted_at: nowIso,
      },
    });
  });

  router.post('/quizzes/:id/retake', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const quizId = Number(req.params.id);
    if (!Number.isInteger(quizId) || quizId <= 0) {
      res.status(400).json({ error: 'Invalid quiz ID.' });
      return;
    }

    const quiz = db
      .prepare('SELECT id, title, difficulty, questions_json, total_questions FROM quizzes WHERE id = ? AND user_id = ?')
      .get(quizId, userId) as
      | { id: number; title: string; difficulty: string; questions_json: string; total_questions: number }
      | undefined;

    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }

    db.prepare(
      `UPDATE quizzes
       SET submitted = 0, user_answers_json = NULL, score = NULL, submitted_at = NULL
       WHERE id = ? AND user_id = ?`
    ).run(quizId, userId);

    const fullQuestions = JSON.parse(quiz.questions_json) as Array<{
      question: string;
      options: string[];
      pageRef?: string;
    }>;

    res.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        difficulty: quiz.difficulty,
        submitted: false,
        userAnswers: null,
        score: null,
        totalQuestions: quiz.total_questions,
        questions: fullQuestions.map(({ question, options, pageRef }) => ({
          question,
          options,
          pageRef,
        })),
      },
    });
  });

  // --- Question & Answer Generator ---
  router.get('/qa', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT q.id, q.document_id, d.original_name AS document_name, q.mode, q.topic,
                q.num_questions, q.items_json, q.created_at
         FROM qa_sets q
         LEFT JOIN documents d ON d.id = q.document_id
         WHERE q.user_id = ?
         ORDER BY q.id DESC
         LIMIT 20`
      )
      .all(req.user!.id) as Array<{
      id: number;
      document_id: number | null;
      document_name: string | null;
      mode: string;
      topic: string;
      num_questions: number;
      items_json: string;
      created_at: string;
    }>;

    res.json({
      qaSets: rows.map((r) => ({
        id: r.id,
        documentId: r.document_id,
        documentName: r.document_name,
        mode: r.mode,
        topic: r.topic,
        numQuestions: r.num_questions,
        items: JSON.parse(r.items_json),
        created_at: r.created_at,
      })),
    });
  });

  router.post('/qa/generate', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const rawDocId = req.body?.documentId;
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
    const mode = req.body?.mode as 'important' | 'short' | 'long' | 'viva' | 'exam';
    const numQuestions = Math.min(12, Math.max(3, Number(req.body?.numQuestions) || 5));

    if (!['important', 'short', 'long', 'viva', 'exam'].includes(mode)) {
      res.status(400).json({ error: 'Invalid question set mode.' });
      return;
    }

    let documentId: number | null = null;
    let sourceText = '';
    let topicLabel = '';

    if (rawDocId) {
      const parsedId = Number(rawDocId);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        res.status(400).json({ error: 'Invalid PDF document selected.' });
        return;
      }
      const doc = db
        .prepare('SELECT id, original_name, extracted_text FROM documents WHERE id = ? AND user_id = ?')
        .get(parsedId, userId) as
        | { id: number; original_name: string; extracted_text: string }
        | undefined;
      if (!doc) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }
      documentId = doc.id;
      sourceText = doc.extracted_text.slice(0, 24000);
      topicLabel = topic ? `${doc.original_name} (${topic})` : doc.original_name;
    } else if (topic.length >= 2) {
      sourceText = `Topic: ${topic}. Generate study questions and thorough answers suitable for college exam preparation.`;
      topicLabel = topic;
    } else {
      res.status(400).json({ error: 'Please select a PDF document or enter a topic.' });
      return;
    }

    try {
      const items = await generateQaJson({
        sourceText,
        mode,
        numQuestions,
        topicLabel,
      });

      const insertRes = db
        .prepare(
          `INSERT INTO qa_sets (user_id, document_id, mode, topic, num_questions, items_json)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(userId, documentId, mode, topicLabel, items.length, JSON.stringify(items));

      const modeLabels: Record<string, string> = {
        important: 'Important Questions',
        short: 'Short Q&A',
        long: 'Long Q&A',
        viva: 'Viva Questions',
        exam: 'Practice Exam Questions',
      };

      recordStudyHistory(
        userId,
        'qa',
        `${modeLabels[mode]}: ${topicLabel}`,
        `Generated ${items.length} structured questions and answers`,
        { qaSetId: Number(insertRes.lastInsertRowid), mode }
      );

      res.status(201).json({
        qaSet: {
          id: Number(insertRes.lastInsertRowid),
          documentId,
          mode,
          topic: topicLabel,
          numQuestions: items.length,
          items,
          created_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      if (err instanceof AiServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Could not generate questions and answers. Please try again.' });
    }
  });

  // --- Explain Difficult Topics ---
  router.get('/explain', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT e.id, e.document_id, d.original_name AS document_name, e.topic, e.mode, e.content, e.created_at
         FROM topic_explanations e
         LEFT JOIN documents d ON d.id = e.document_id
         WHERE e.user_id = ?
         ORDER BY e.id DESC
         LIMIT 20`
      )
      .all(req.user!.id);
    res.json({ explanations: rows });
  });

  router.post('/explain', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
    const excerpt = typeof req.body?.excerpt === 'string' ? req.body.excerpt.trim().slice(0, 6000) : '';
    const rawDocId = req.body?.documentId;
    const mode = req.body?.mode as
      | 'beginner'
      | 'step_by_step'
      | 'examples'
      | 'quick_revision'
      | 'simpler';
    const previousExplanation =
      typeof req.body?.previousExplanation === 'string'
        ? req.body.previousExplanation.slice(0, 4000)
        : '';

    if (topic.length < 2 && excerpt.length < 10) {
      res.status(400).json({ error: 'Please enter a topic or paste an excerpt to explain.' });
      return;
    }
    if (!['beginner', 'step_by_step', 'examples', 'quick_revision', 'simpler'].includes(mode)) {
      res.status(400).json({ error: 'Invalid explanation mode.' });
      return;
    }

    let documentId: number | null = null;
    let docContext = '';

    if (rawDocId) {
      const parsedId = Number(rawDocId);
      if (Number.isInteger(parsedId) && parsedId > 0) {
        const doc = db
          .prepare('SELECT id FROM documents WHERE id = ? AND user_id = ?')
          .get(parsedId, userId);
        if (doc) {
          documentId = parsedId;
          const chunks = await retrieveRelevantChunks(userId, topic || excerpt.slice(0, 120), parsedId, 3);
          if (chunks.length > 0) {
            docContext = chunks
              .map((c) => `[${c.documentName} · Page ${c.pageNumber}]\n${c.content}`)
              .join('\n\n');
          }
        }
      }
    }

    const modePrompts: Record<string, string> = {
      beginner:
        'Explain like I am a complete beginner encountering this concept for the first time. Avoid heavy jargon, define every key term clearly, use an everyday analogy, and end with a short Revision Summary.',
      step_by_step:
        'Break the concept down into clear numbered steps from foundation to conclusion, include a concrete example, and end with a short Revision Summary.',
      examples:
        'Teach this concept primarily through 2-3 clear real-life and academic examples, showing how the principle works in practice, and end with a short Revision Summary.',
      quick_revision:
        'Provide a crisp last-minute revision breakdown: core definition, 4-5 key bullet takeaways, common exam mistake to avoid, and a 2-sentence Revision Summary.',
      simpler:
        'Make this explanation MUCH simpler and easier to digest than the previous attempt. Use everyday plain English, a friendly relatable analogy, short sentences, and a 3-bullet Quick Revision Summary at the end.',
    };

    try {
      const prompt = `
Topic: ${topic || 'Selected Study Material Excerpt'}
Explanation Goal: ${modePrompts[mode]}

${excerpt ? `Student's Selected Text:\n${excerpt}\n` : ''}
${docContext ? `Relevant Excerpts From Uploaded PDF:\n${docContext}\n` : ''}
${previousExplanation && mode === 'simpler' ? `Previous Explanation to Simplify Further:\n${previousExplanation}\n` : ''}

Structure your output cleanly in Markdown with clear sections:
1. Simple Definition
2. Breakdown / Walkthrough
3. Real-Life Example(s)
4. Quick Revision Summary
`.trim();

      const content = await generateStudyText({
        systemInstruction:
          'You are an empathetic college tutor who excels at turning intimidating academic concepts into crystal-clear, memorable explanations in simple English.',
        contents: prompt,
      });

      const titleTopic = topic || excerpt.slice(0, 60) + '...';
      const insertRes = db
        .prepare(
          `INSERT INTO topic_explanations (user_id, document_id, topic, mode, content)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(userId, documentId, titleTopic, mode, content);

      recordStudyHistory(
        userId,
        'explain',
        `Explained: ${titleTopic}`,
        `Explanation mode: ${mode.replace('_', ' ')}`,
        { explanationId: Number(insertRes.lastInsertRowid), mode }
      );

      res.status(201).json({
        explanation: {
          id: Number(insertRes.lastInsertRowid),
          document_id: documentId,
          topic: titleTopic,
          mode,
          content,
          created_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      if (err instanceof AiServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Unable to generate explanation right now. Please try again.' });
    }
  });

  // --- Study History ---
  router.get('/history', requireAuth, (req: AuthenticatedRequest, res) => {
    const typeFilter = typeof req.query?.type === 'string' ? req.query.type.trim() : '';
    const allowedTypes = new Set(['upload', 'chat', 'summary', 'quiz', 'qa', 'explain']);

    const rows =
      typeFilter && allowedTypes.has(typeFilter)
        ? db
            .prepare(
              `SELECT id, activity_type, title, detail, metadata_json, created_at
               FROM study_history
               WHERE user_id = ? AND activity_type = ?
               ORDER BY id DESC
               LIMIT 100`
            )
            .all(req.user!.id, typeFilter)
        : db
            .prepare(
              `SELECT id, activity_type, title, detail, metadata_json, created_at
               FROM study_history
               WHERE user_id = ?
               ORDER BY id DESC
               LIMIT 100`
            )
            .all(req.user!.id);

    res.json({ history: rows });
  });

  router.delete('/history', requireAuth, (req: AuthenticatedRequest, res) => {
    db.prepare('DELETE FROM study_history WHERE user_id = ?').run(req.user!.id);
    res.json({ ok: true });
  });

  // --- Profile & Settings ---
  router.patch('/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const major = typeof req.body?.major === 'string' ? req.body.major.trim().slice(0, 100) : '';
    const yearLevel =
      typeof req.body?.yearLevel === 'string' ? req.body.yearLevel.trim().slice(0, 50) : 'Undergraduate';
    const studyGoal =
      typeof req.body?.studyGoal === 'string' ? req.body.studyGoal.trim().slice(0, 240) : '';
    const preferredStyle = ['beginner', 'step_by_step', 'examples', 'quick_revision'].includes(
      req.body?.preferredStyle
    )
      ? req.body.preferredStyle
      : 'beginner';

    if (name.length < 2 || name.length > 80) {
      res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
      return;
    }

    db.prepare(
      `UPDATE users
       SET name = ?, major = ?, year_level = ?, study_goal = ?, preferred_explanation_style = ?
       WHERE id = ?`
    ).run(name, major, yearLevel, studyGoal, preferredStyle, userId);

    const updated = db
      .prepare(
        `SELECT id, name, email, major, year_level, study_goal, preferred_explanation_style, created_at
         FROM users WHERE id = ?`
      )
      .get(userId);

    res.json({ user: updated });
  });

  router.post('/profile/password', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!currentPassword || newPassword.length < 6 || newPassword.length > 128) {
      res.status(400).json({
        error: 'Provide your current password and a new password (6 to 128 characters).',
      });
      return;
    }

    const row = db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(userId) as { password_hash: string } | undefined;

    if (!row || !verifyPassword(currentPassword, row.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    const newHash = hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);
    res.json({ ok: true });
  });

  return router;
}
