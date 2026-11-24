import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';

export interface SafeUser {
  id: number;
  name: string;
  email: string;
  major: string;
  year_level: string;
  study_goal: string;
  preferred_explanation_style: string;
  created_at: string;
}

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
  sessionTokenHash?: string;
}

const SESSION_COOKIE_NAME = 'study_session';
const SESSION_TTL_DAYS = 7;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, originalHex] = parts;
  if (!salt || !originalHex) {
    return false;
  }
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const original = Buffer.from(originalHex, 'hex');
    if (derived.length !== original.length) {
      return false;
    }
    return crypto.timingSafeEqual(derived, original);
  } catch {
    return false;
  }
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function createSession(userId: number): string {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(tokenHash, userId, expiresAt);

  return rawToken;
}

export function deleteSessionByHash(tokenHash: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) {
    return cookies;
  }
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      if (key) {
        cookies[key] = decodeURIComponent(val);
      }
    }
  }
  return cookies;
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) {
    return true;
  }
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    return forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return false;
}

export function setSessionCookie(res: Response, req: Request, rawToken: string): void {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  if (isHttpsRequest(req)) {
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${maxAge}`
    );
  }
}

export function clearSessionCookie(res: Response, req: Request): void {
  if (isHttpsRequest(req)) {
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`
    );
  }
}

export function extractTokenFromRequest(req: Request): { token: string | null; viaCookie: boolean } {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      return { token, viaCookie: false };
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (cookieToken) {
    return { token: cookieToken, viaCookie: true };
  }

  return { token: null, viaCookie: false };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const { token, viaCookie } = extractTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  if (viaCookie && !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
    const hasCustomHeader = req.headers['x-requested-with'] === 'StudyAssistant';
    const origin = req.headers.origin;
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
    let originMatches = false;
    if (typeof origin === 'string' && host) {
      try {
        originMatches = new URL(origin).host === host;
      } catch {
        originMatches = false;
      }
    }
    if (!hasCustomHeader && !originMatches) {
      res.status(403).json({ error: 'Cross-origin request validation failed.' });
      return;
    }
  }

  const tokenHash = hashSessionToken(token);
  const nowIso = new Date().toISOString();

  const row = db
    .prepare(
      `
      SELECT u.id, u.name, u.email, u.major, u.year_level, u.study_goal,
             u.preferred_explanation_style, u.created_at, s.expires_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
      `
    )
    .get(tokenHash) as (SafeUser & { expires_at: string }) | undefined;

  if (!row || row.expires_at <= nowIso) {
    if (row) {
      deleteSessionByHash(tokenHash);
    }
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }

  req.user = {
    id: row.id,
    name: row.name,
    email: row.email,
    major: row.major,
    year_level: row.year_level,
    study_goal: row.study_goal,
    preferred_explanation_style: row.preferred_explanation_style,
    created_at: row.created_at,
  };
  req.sessionTokenHash = tokenHash;
  next();
}
