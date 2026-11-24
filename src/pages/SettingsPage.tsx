import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Save } from 'lucide-react';
import { apiRequest, ApiError, formatTimestamp } from '../lib/api.ts';
import type { User } from '../types.ts';

interface SettingsPageProps {
  user: User;
  onUserUpdated: (user: User) => void;
}

export function SettingsPage({ user, onUserUpdated }: SettingsPageProps) {
  const [name, setName] = useState(user.name);
  const [major, setMajor] = useState(user.major || '');
  const [yearLevel, setYearLevel] = useState(user.year_level || 'Undergraduate');
  const [studyGoal, setStudyGoal] = useState(user.study_goal || '');
  const [preferredStyle, setPreferredStyle] = useState(
    user.preferred_explanation_style || 'beginner'
  );

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordErr, setPasswordErr] = useState('');

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    setSavingProfile(true);
    try {
      const res = await apiRequest<{ user: User }>('/profile', {
        method: 'PATCH',
        body: {
          name: name.trim(),
          major: major.trim(),
          yearLevel,
          studyGoal: studyGoal.trim(),
          preferredStyle,
        },
      });
      onUserUpdated(res.user);
      setProfileMsg('Profile preferences saved.');
    } catch (err) {
      setProfileErr(err instanceof ApiError ? err.message : 'Unable to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordErr('');

    if (newPassword.length < 6) {
      setPasswordErr('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErr('New password confirmation does not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await apiRequest('/profile/password', {
        method: 'POST',
        body: {
          currentPassword,
          newPassword,
        },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg('Password updated successfully.');
    } catch (err) {
      setPasswordErr(err instanceof ApiError ? err.message : 'Unable to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Account Summary */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="font-display text-lg font-bold text-slate-900">Profile &amp; Settings</h1>
        <p className="mt-1 text-xs text-slate-500">
          {user.email} · Account created {formatTimestamp(user.created_at)}
        </p>

        {profileErr && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{profileErr}</span>
          </div>
        )}
        {profileMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{profileMsg}</span>
          </div>
        )}

        <form onSubmit={handleProfileSave} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prof-name" className="block text-xs font-medium text-slate-700 mb-1.5">
                Full Name
              </label>
              <input
                id="prof-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="prof-major" className="block text-xs font-medium text-slate-700 mb-1.5">
                Major / Subject Focus
              </label>
              <input
                id="prof-major"
                type="text"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder="e.g., Electrical Engineering"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prof-year" className="block text-xs font-medium text-slate-700 mb-1.5">
                Academic Level
              </label>
              <select
                id="prof-year"
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              >
                <option value="Freshman">Freshman (Year 1)</option>
                <option value="Sophomore">Sophomore (Year 2)</option>
                <option value="Junior">Junior (Year 3)</option>
                <option value="Senior">Senior (Year 4)</option>
                <option value="Undergraduate">Undergraduate</option>
                <option value="Graduate">Graduate / Masters</option>
              </select>
            </div>
            <div>
              <label htmlFor="prof-style" className="block text-xs font-medium text-slate-700 mb-1.5">
                Default Explanation Style
              </label>
              <select
                id="prof-style"
                value={preferredStyle}
                onChange={(e) => setPreferredStyle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              >
                <option value="beginner">Explain Like a Beginner</option>
                <option value="step_by_step">Step-by-Step Explanation</option>
                <option value="examples">Explain with Examples</option>
                <option value="quick_revision">Quick Revision</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="prof-goal" className="block text-xs font-medium text-slate-700 mb-1.5">
              Current Semester / Exam Goal
            </label>
            <input
              id="prof-goal"
              type="text"
              value={studyGoal}
              onChange={(e) => setStudyGoal(e.target.value)}
              placeholder="e.g., Prepare for Algorithms & Operating Systems midterms"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>{savingProfile ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Security / Change Password */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4.5 w-4.5 text-indigo-600" />
          <h2 className="font-display text-base font-semibold text-slate-900">Change Password</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Passwords are stored with salted scrypt cryptographic hashing.
        </p>

        {passwordErr && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{passwordErr}</span>
          </div>
        )}
        {passwordMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{passwordMsg}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="mt-4 space-y-4 max-w-md">
          <div>
            <label htmlFor="cur-pass" className="block text-xs font-medium text-slate-700 mb-1.5">
              Current Password
            </label>
            <input
              id="cur-pass"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="new-pass" className="block text-xs font-medium text-slate-700 mb-1.5">
              New Password
            </label>
            <input
              id="new-pass"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="conf-pass" className="block text-xs font-medium text-slate-700 mb-1.5">
              Confirm New Password
            </label>
            <input
              id="conf-pass"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            <span>{savingPassword ? 'Updating...' : 'Update Password'}</span>
          </button>
        </form>
      </section>
    </div>
  );
}
