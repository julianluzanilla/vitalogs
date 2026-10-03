import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { randomToken, sha256 } from './crypto';

export interface Env {
  DB: D1Database;
}

export type Kind = 'user' | 'admin';

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  pw_hash: string;
  must_change_pw: number;
  disabled: number;
  seq: number;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
}

export interface AdminRow {
  id: string;
  username: string;
  pw_hash: string;
}

export type Vars = { user: UserRow; admin: AdminRow; tokenHash: string };
export type AppEnv = { Bindings: Env; Variables: Vars };

const DAY = 86_400_000;

export const SESSION = {
  user: { cookie: 'vl_s', path: '/api', ttl: 30 * DAY },
  admin: { cookie: 'vl_a', path: '/api/admin', ttl: DAY / 2 },
} as const;

export async function createSession(c: Context<AppEnv>, kind: Kind, subjectId: string) {
  const cfg = SESSION[kind];
  const token = randomToken();
  const now = Date.now();
  await c.env.DB.prepare('INSERT INTO sessions (token_hash, kind, subject_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256(token), kind, subjectId, now + cfg.ttl, now)
    .run();
  setCookie(c, cfg.cookie, token, {
    path: cfg.path,
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: Math.floor(cfg.ttl / 1000),
  });
}

export async function destroySession(c: Context<AppEnv>, kind: Kind) {
  const cfg = SESSION[kind];
  const token = getCookie(c, cfg.cookie);
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  deleteCookie(c, cfg.cookie, { path: cfg.path, secure: true });
}

/** Exige sesión de usuario final. Carga la fila en c.var.user. */
export function requireUser(opts: { allowMustChange?: boolean } = {}): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = getCookie(c, SESSION.user.cookie);
    if (!token) return c.json({ error: 'No autenticado' }, 401);
    const tokenHash = await sha256(token);
    const row = await c.env.DB.prepare(
      `SELECT u.*, s.expires_at AS s_exp FROM sessions s JOIN users u ON u.id = s.subject_id
       WHERE s.token_hash = ? AND s.kind = 'user'`,
    )
      .bind(tokenHash)
      .first<UserRow & { s_exp: number }>();
    const now = Date.now();
    if (!row || row.s_exp < now || row.disabled) {
      deleteCookie(c, SESSION.user.cookie, { path: SESSION.user.path, secure: true });
      return c.json({ error: 'No autenticado' }, 401);
    }
    if (row.must_change_pw && !opts.allowMustChange) return c.json({ error: 'Debes cambiar tu contraseña' }, 403);
    // Sesión deslizante: renovar cuando le queden menos de 15 días.
    if (row.s_exp - now < 15 * DAY) {
      await c.env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').bind(now + SESSION.user.ttl, tokenHash).run();
      setCookie(c, SESSION.user.cookie, token, {
        path: SESSION.user.path,
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: Math.floor(SESSION.user.ttl / 1000),
      });
    }
    c.set('user', row);
    c.set('tokenHash', tokenHash);
    await next();
  };
}

/** Exige sesión de administrador. */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION.admin.cookie);
  if (!token) return c.json({ error: 'No autenticado' }, 401);
  const tokenHash = await sha256(token);
  const row = await c.env.DB.prepare(
    `SELECT a.id, a.username, a.pw_hash, s.expires_at AS s_exp FROM sessions s JOIN admins a ON a.id = s.subject_id
     WHERE s.token_hash = ? AND s.kind = 'admin'`,
  )
    .bind(tokenHash)
    .first<AdminRow & { s_exp: number }>();
  if (!row || row.s_exp < Date.now()) {
    deleteCookie(c, SESSION.admin.cookie, { path: SESSION.admin.path, secure: true });
    return c.json({ error: 'No autenticado' }, 401);
  }
  c.set('admin', row);
  c.set('tokenHash', tokenHash);
  await next();
};

const WINDOW = 15 * 60_000;
const MAX_FAILS = 5;

/** Devuelve true si la clave está bloqueada por demasiados intentos fallidos. */
export async function isLocked(db: D1Database, key: string): Promise<boolean> {
  const row = await db.prepare('SELECT count, window_start FROM login_attempts WHERE key = ?').bind(key).first<{ count: number; window_start: number }>();
  return !!row && row.count >= MAX_FAILS && Date.now() - row.window_start < WINDOW;
}

export async function recordFailure(db: D1Database, key: string) {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO login_attempts (key, count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN ? - window_start > ? THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN ? - window_start > ? THEN ? ELSE window_start END`,
    )
    .bind(key, now, now, WINDOW, now, WINDOW, now)
    .run();
}

export async function clearFailures(db: D1Database, key: string) {
  await db.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
}
