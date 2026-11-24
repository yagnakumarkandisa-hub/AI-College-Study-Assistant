export type AppRoute =
  | 'landing'
  | 'login'
  | 'register'
  | 'dashboard'
  | 'chatbot'
  | 'upload'
  | 'summary'
  | 'quiz'
  | 'questions'
  | 'explain'
  | 'history'
  | 'settings';

export interface User {
  id: number;
  name: string;
  email: string;
  major: string;
  year_level: string;
  study_goal: string;
  preferred_explanation_style: string;
  created_at: string;
}

export interface DocumentSummary {
  id: number;
  original_name: string;
  file_size: number;
  page_count: number;
  char_count: number;
  created_at: string;
}

export interface DocumentPage {
  page: number;
  text: string;
}

export interface DocumentDetail extends DocumentSummary {
  extracted_text: string;
  pages: DocumentPage[];
}

export interface Citation {
  documentId: number;
  docName: string;
  page: number;
  snippet: string;
}

export interface ChatMessage {
  id: number;
  documentId: number | null;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  created_at: string;
}

export interface SummaryItem {
  id: number;
  document_id: number;
  document_name: string;
  mode: 'quick' | 'detailed' | 'exam';
  content: string;
  created_at: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
  pageRef?: string;
}

export interface QuizItem {
  id: number;
  documentId: number | null;
  documentName?: string | null;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  submitted: boolean;
  userAnswers: number[] | null;
  score: number | null;
  totalQuestions: number;
  questions: QuizQuestion[];
  created_at: string;
  submitted_at?: string | null;
}

export interface QaItem {
  topicSection: string;
  question: string;
  answer: string;
  keyPoints: string[];
}

export interface QaSet {
  id: number;
  documentId: number | null;
  documentName?: string | null;
  mode: 'important' | 'short' | 'long' | 'viva' | 'exam';
  topic: string;
  numQuestions: number;
  items: QaItem[];
  created_at: string;
}

export interface ExplanationItem {
  id: number;
  document_id: number | null;
  document_name?: string | null;
  topic: string;
  mode: 'beginner' | 'step_by_step' | 'examples' | 'quick_revision' | 'simpler';
  content: string;
  created_at: string;
}

export interface HistoryEntry {
  id: number;
  activity_type: 'upload' | 'chat' | 'summary' | 'quiz' | 'qa' | 'explain';
  title: string;
  detail: string;
  created_at: string;
}

export interface DashboardData {
  stats: {
    documentsCount: number;
    totalPages: number;
    quizzesCompleted: number;
    averageScorePercent: number | null;
    summariesCount: number;
  };
  latestQuizzes: Array<{
    id: number;
    title: string;
    difficulty: string;
    score: number;
    total_questions: number;
    submitted_at: string;
  }>;
  recentHistory: HistoryEntry[];
  recentDocuments: Array<{
    id: number;
    original_name: string;
    page_count: number;
    file_size: number;
    created_at: string;
  }>;
}
