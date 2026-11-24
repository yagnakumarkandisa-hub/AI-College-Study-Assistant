import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { WorkspaceLayout } from './components/WorkspaceLayout.tsx';
import { apiRequest, setAuthToken } from './lib/api.ts';
import { AuthPage } from './pages/AuthPages.tsx';
import { ChatbotPage } from './pages/ChatbotPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { ExplainPage } from './pages/ExplainPage.tsx';
import { HistoryPage } from './pages/HistoryPage.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { QuestionsPage } from './pages/QuestionsPage.tsx';
import { QuizPage } from './pages/QuizPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { SummaryPage } from './pages/SummaryPage.tsx';
import { UploadPage } from './pages/UploadPage.tsx';
import type { AppRoute, User } from './types.ts';

const VALID_ROUTES = new Set<AppRoute>([
  'landing',
  'login',
  'register',
  'dashboard',
  'chatbot',
  'upload',
  'summary',
  'quiz',
  'questions',
  'explain',
  'history',
  'settings',
]);

const PROTECTED_ROUTES = new Set<AppRoute>([
  'dashboard',
  'chatbot',
  'upload',
  'summary',
  'quiz',
  'questions',
  'explain',
  'history',
  'settings',
]);

const ROUTE_META: Record<AppRoute, { title: string; subtitle: string }> = {
  landing: { title: 'Home', subtitle: '' },
  login: { title: 'Sign In', subtitle: '' },
  register: { title: 'Register', subtitle: '' },
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Overview of your uploaded study notes, quiz performance, and recent activity',
  },
  chatbot: {
    title: 'AI Tutor Chat',
    subtitle: 'Ask subject questions grounded in your uploaded PDFs with page citations',
  },
  upload: {
    title: 'PDF Study Notes',
    subtitle: 'Upload, validate, and preview extracted text from your course PDFs',
  },
  summary: {
    title: 'PDF Note Summarizer',
    subtitle: 'Generate Quick, Detailed, or Exam Preparation summaries',
  },
  quiz: {
    title: 'MCQ Quiz Practice',
    subtitle: 'Test your recall with 4-option quizzes and detailed answer explanations',
  },
  questions: {
    title: 'Q&A Generator',
    subtitle: 'Create short-answer, long-answer, viva, and practice-exam question sets',
  },
  explain: {
    title: 'Explain Difficult Topics',
    subtitle: 'Break complex academic ideas into clear beginner steps and examples',
  },
  history: {
    title: 'Study History',
    subtitle: 'Filter and review your past chats, summaries, quizzes, and uploads',
  },
  settings: {
    title: 'Profile & Settings',
    subtitle: 'Manage your academic profile, study preferences, and password',
  },
};

function getInitialRouteFromHash(): AppRoute {
  const raw = window.location.hash.replace(/^#\/?/, '').trim() as AppRoute;
  return VALID_ROUTES.has(raw) ? raw : 'landing';
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [route, setRoute] = useState<AppRoute>(getInitialRouteFromHash);
  const [preselectedDocId, setPreselectedDocId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiRequest<{ user: User }>('/auth/me');
        if (active && res.user) {
          setUser(res.user);
          if (route === 'login' || route === 'register') {
            setRoute('dashboard');
          }
        }
      } catch {
        // Not signed in via cookie on initial load
      } finally {
        if (active) {
          setBooting(false);
        }
      }
    })();

    const onHashChange = () => {
      setRoute(getInitialRouteFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      active = false;
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  const navigate = (nextRoute: AppRoute) => {
    setPreselectedDocId(null);
    setRoute(nextRoute);
    window.location.hash = nextRoute === 'landing' ? '' : `#/${nextRoute}`;
  };

  const navigateWithDoc = (nextRoute: AppRoute, docId: number) => {
    setPreselectedDocId(docId);
    setRoute(nextRoute);
    window.location.hash = `#/${nextRoute}`;
  };

  const handleAuthSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    navigate('dashboard');
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on sign out
    }
    setAuthToken(null);
    setUser(null);
    navigate('landing');
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center gap-2.5 text-sm text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        <span>Loading AI College Study Assistant...</span>
      </div>
    );
  }

  // Redirect unauthenticated users away from protected routes
  const effectiveRoute: AppRoute =
    PROTECTED_ROUTES.has(route) && !user ? 'login' : route;

  if (effectiveRoute === 'landing') {
    return <LandingPage isAuthenticated={Boolean(user)} onNavigate={navigate} />;
  }

  if (effectiveRoute === 'login') {
    return <AuthPage mode="login" onSuccess={handleAuthSuccess} onNavigate={navigate} />;
  }

  if (effectiveRoute === 'register') {
    return <AuthPage mode="register" onSuccess={handleAuthSuccess} onNavigate={navigate} />;
  }

  if (!user) {
    return <AuthPage mode="login" onSuccess={handleAuthSuccess} onNavigate={navigate} />;
  }

  const meta = ROUTE_META[effectiveRoute];

  return (
    <WorkspaceLayout
      user={user}
      currentRoute={effectiveRoute}
      onNavigate={navigate}
      onLogout={handleLogout}
      pageTitle={meta.title}
      pageSubtitle={meta.subtitle}
    >
      {effectiveRoute === 'dashboard' && <DashboardPage user={user} onNavigate={navigate} />}
      {effectiveRoute === 'chatbot' && (
        <ChatbotPage onNavigate={navigate} preselectedDocId={preselectedDocId} />
      )}
      {effectiveRoute === 'upload' && <UploadPage onNavigateWithDoc={navigateWithDoc} />}
      {effectiveRoute === 'summary' && (
        <SummaryPage onNavigate={navigate} preselectedDocId={preselectedDocId} />
      )}
      {effectiveRoute === 'quiz' && <QuizPage preselectedDocId={preselectedDocId} />}
      {effectiveRoute === 'questions' && <QuestionsPage preselectedDocId={preselectedDocId} />}
      {effectiveRoute === 'explain' && (
        <ExplainPage defaultMode={user.preferred_explanation_style} />
      )}
      {effectiveRoute === 'history' && <HistoryPage />}
      {effectiveRoute === 'settings' && (
        <SettingsPage user={user} onUserUpdated={(updated) => setUser(updated)} />
      )}
    </WorkspaceLayout>
  );
}
