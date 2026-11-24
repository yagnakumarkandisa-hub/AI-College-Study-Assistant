import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export const TEXT_MODEL = 'gemini-4-hydrogen';
export const EMBEDDING_MODEL = 'gemini-embedding-2';

export class AiServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new AiServiceError(
      'AI study service is not configured yet. Please ensure GEMINI_API_KEY is set in the environment secrets.',
      503
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withAiRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.toLowerCase().includes('rate') ||
        msg.toLowerCase().includes('temporarily');
      if (isTransient && attempt < maxAttempts) {
        await sleep(800 * attempt);
        continue;
      }
      break;
    }
  }
  throw mapAiError(lastError);
}

export function mapAiError(err: unknown): AiServiceError {
  if (err instanceof AiServiceError) {
    return err;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403') || lower.includes('401')) {
    return new AiServiceError(
      'The AI service rejected the configured API key. Please verify GEMINI_API_KEY in Settings > Secrets.',
      503
    );
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return new AiServiceError(
      'The AI service is temporarily busy due to rate limits. Please wait a moment and try again.',
      429
    );
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return new AiServiceError(
      'The requested AI model is currently unavailable. Please try again shortly.',
      502
    );
  }
  return new AiServiceError(
    'The AI study assistant could not complete this request right now. Please try again in a moment.',
    502
  );
}

export async function generateStudyText(params: {
  systemInstruction: string;
  contents: string | Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  lowLatency?: boolean;
}): Promise<string> {
  const ai = getGeminiClient();
  return withAiRetry(async () => {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: params.contents,
      config: {
        systemInstruction: params.systemInstruction,
        thinkingConfig: {
          thinkingLevel: params.lowLatency ? ThinkingLevel.LOW : ThinkingLevel.MEDIUM,
        },
      },
    });
    const text = response.text?.trim();
    if (!text) {
      throw new AiServiceError('The AI returned an empty response. Please rephrase and try again.', 502);
    }
    return text;
  });
}

export interface GeneratedMcqItem {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  pageRef?: string;
}

export async function generateMcqJson(params: {
  sourceText: string;
  topicLabel: string;
  numQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard';
}): Promise<GeneratedMcqItem[]> {
  const ai = getGeminiClient();

  const difficultyGuide =
    params.difficulty === 'easy'
      ? 'Focus on core definitions, direct recall, and foundational concepts.'
      : params.difficulty === 'hard'
      ? 'Focus on multi-step reasoning, application scenarios, edge cases, and conceptual synthesis.'
      : 'Balance conceptual understanding with practical application.';

  const prompt = `
Create exactly ${params.numQuestions} multiple-choice questions for college students.
Difficulty: ${params.difficulty.toUpperCase()} (${difficultyGuide})
Topic / Source Material Label: ${params.topicLabel}

Rules:
- Each question must have exactly 4 distinct options (A, B, C, D).
- Only one option is correct (correctIndex is 0, 1, 2, or 3).
- Base questions directly on the provided study notes whenever notes are provided.
- Do NOT invent facts outside the notes when notes are provided.
- Provide a clear, concise 1-2 sentence explanation for the correct answer.
- If a page marker like [Page X] is visible in the source, include it in pageRef (e.g. "Page 3"), otherwise empty string.
- Use simple, clear academic English.

Study Material:
${params.sourceText}
`.trim();

  return withAiRetry(async () => {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          'You are a careful college exam question author. Output valid JSON strictly adhering to the schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              correctIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
              pageRef: { type: Type.STRING },
            },
            required: ['question', 'options', 'correctIndex', 'explanation'],
          },
        },
      },
    });

    const raw = (response.text ?? '[]').trim();
    const parsed = JSON.parse(raw) as Array<{
      question?: unknown;
      options?: unknown;
      correctIndex?: unknown;
      explanation?: unknown;
      pageRef?: unknown;
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new AiServiceError('Could not generate valid quiz questions from this material.', 502);
    }

    const sanitized: GeneratedMcqItem[] = [];
    for (const item of parsed.slice(0, params.numQuestions)) {
      if (
        typeof item.question === 'string' &&
        Array.isArray(item.options) &&
        item.options.length >= 4 &&
        typeof item.explanation === 'string'
      ) {
        const opts = item.options.slice(0, 4).map((o) => String(o).trim()) as [
          string,
          string,
          string,
          string,
        ];
        const rawIdx = Number(item.correctIndex);
        const correctIndex = Number.isInteger(rawIdx) && rawIdx >= 0 && rawIdx <= 3 ? rawIdx : 0;
        sanitized.push({
          question: item.question.trim(),
          options: opts,
          correctIndex,
          explanation: item.explanation.trim(),
          pageRef: typeof item.pageRef === 'string' ? item.pageRef.trim() : '',
        });
      }
    }

    if (sanitized.length === 0) {
      throw new AiServiceError('Generated quiz format was incomplete. Please try again.', 502);
    }
    return sanitized;
  });
}

export interface GeneratedQaItem {
  topicSection: string;
  question: string;
  answer: string;
  keyPoints: string[];
}

export async function generateQaJson(params: {
  sourceText: string;
  mode: 'important' | 'short' | 'long' | 'viva' | 'exam';
  numQuestions: number;
  topicLabel: string;
}): Promise<GeneratedQaItem[]> {
  const ai = getGeminiClient();

  const modeInstructions: Record<string, string> = {
    important: 'Generate high-yield important conceptual questions and thorough study answers organized by topic.',
    short: 'Generate concise short-answer questions (2-4 sentence answers ideal for 2-5 mark exam questions).',
    long: 'Generate comprehensive long-answer essay/analytical questions with structured multi-paragraph answers.',
    viva: 'Generate oral viva/interview questions with crisp, spoken-style answers and quick follow-up points.',
    exam: 'Generate previous-exam-style practice questions reflecting typical university examination framing and marking depth.',
  };

  const prompt = `
Generate ${params.numQuestions} study questions and answers.
Mode: ${modeInstructions[params.mode] || modeInstructions.important}
Topic / Document: ${params.topicLabel}

Rules:
- Ground answers strictly in the provided study notes when notes are provided.
- If a sub-topic isn't deeply covered in the notes, note what is from the document vs general foundational context.
- Organize each item under a clear topicSection heading.
- Include 2-3 concise keyPoints per answer for rapid revision.
- Do NOT claim these exact questions will appear on an actual examination.
- Use simple, clear college-level English.

Study Material:
${params.sourceText}
`.trim();

  return withAiRetry(async () => {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          'You are an academic study coach creating structured questions and answers in valid JSON.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topicSection: { type: Type.STRING },
              question: { type: Type.STRING },
              answer: { type: Type.STRING },
              keyPoints: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['topicSection', 'question', 'answer', 'keyPoints'],
          },
        },
      },
    });

    const raw = (response.text ?? '[]').trim();
    const parsed = JSON.parse(raw) as Array<{
      topicSection?: unknown;
      question?: unknown;
      answer?: unknown;
      keyPoints?: unknown;
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new AiServiceError('Could not generate questions and answers. Please try again.', 502);
    }

    return parsed.slice(0, params.numQuestions).map((item) => ({
      topicSection: typeof item.topicSection === 'string' && item.topicSection.trim()
        ? item.topicSection.trim()
        : 'Core Concepts',
      question: String(item.question || '').trim(),
      answer: String(item.answer || '').trim(),
      keyPoints: Array.isArray(item.keyPoints)
        ? item.keyPoints.map((k) => String(k).trim()).filter(Boolean)
        : [],
    }));
  });
}

export async function embedTexts(texts: string[]): Promise<Array<number[] | null>> {
  if (texts.length === 0) {
    return [];
  }
  try {
    const ai = getGeminiClient();
    const results: Array<number[] | null> = [];
    const batchSize = 20;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: batch,
      });
      const embeddings = response.embeddings ?? [];
      for (let j = 0; j < batch.length; j++) {
        const values = embeddings[j]?.values;
        results.push(Array.isArray(values) && values.length > 0 ? values : null);
      }
    }
    return results;
  } catch {
    return texts.map(() => null);
  }
}
