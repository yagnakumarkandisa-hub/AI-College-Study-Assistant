import React, { useState } from 'react';
import {
  BookOpen,
  CheckSquare,
  FileText,
  FileUp,
  GraduationCap,
  HelpCircle,
  History,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  X,
} from 'lucide-react';
import type { AppRoute, User } from '../types.ts';

interface WorkspaceLayoutProps {
  user: User;
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onLogout: () => void;
  pageTitle: string;
  pageSubtitle?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  route: AppRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { route: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { route: 'chatbot', label: 'AI Tutor Chat', icon: MessageSquare },
  { route: 'upload', label: 'PDF Study Notes', icon: FileUp },
  { route: 'summary', label: 'Note Summarizer', icon: FileText },
  { route: 'quiz', label: 'MCQ Quiz Practice', icon: CheckSquare },
  { route: 'questions', label: 'Q&A Generator', icon: HelpCircle },
  { route: 'explain', label: 'Topic Explainer', icon: Lightbulb },
  { route: 'history', label: 'Study History', icon: History },
  { route: 'settings', label: 'Profile & Settings', icon: Settings },
];

export function WorkspaceLayout({
  user,
  currentRoute,
  onNavigate,
  onLogout,
  pageTitle,
  pageSubtitle,
  headerAction,
  children,
}: WorkspaceLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavClick = (route: AppRoute) => {
    setMobileOpen(false);
    onNavigate(route);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200">
      <div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <button
            type="button"
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-md"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <GraduationCap className="h-4.5 w-4.5" />
            </span>
            <span className="font-display text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Study Assistant
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1" aria-label="Workspace Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentRoute === item.route;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => handleNavClick(item.route)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-200 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-display text-sm font-semibold text-indigo-700">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">
              {user.major ? `${user.major} · ${user.year_level}` : user.email}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 w-68 max-w-[85vw] h-full">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Open navigation menu"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <BookOpen className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">AI College Study Assistant</span>
                  <span aria-hidden="true">/</span>
                  <span className="truncate text-slate-700 font-medium">{pageTitle}</span>
                </div>
                {pageSubtitle && (
                  <p className="hidden sm:block text-xs text-slate-500 truncate mt-0.5">
                    {pageSubtitle}
                  </p>
                )}
              </div>
            </div>
            {headerAction && <div className="shrink-0">{headerAction}</div>}
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
