import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import {
  clearFailures,
  createSession,
  destroySession,
  isLocked,
  recordFailure,
  requireAdmin,
  requireUser,
  type AppEnv,
  type UserRow,
} from '../lib/auth';
import { hashPassword, newId, tempPassword, verifyPassword } from '../lib/crypto';
import { sync, SyncError } from '../lib/sync';
import type { Me, SyncRequest } from '../../shared/model';

const app = new Hono<AppEnv>().basePath('/api');

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const MIN_PASSWORD = 8;

// Respuestas de la API nunca se guardan en caché.
app.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
});

// Protección CSRF básica: las peticiones que modifican estado deben ser JSON (no se pueden
// enviar desde un formulario de otro sitio sin preflight CORS). Las cookies además son SameSite=Strict.
app.use('*', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && !(c.req.header('content-type') || '').startsWith('application/json')) {
    return c.json({ error: 'Content-Type no permitido' }, 415);
  }
  await next();
});

app.onError((err, c) => {
  if (err instanceof SyncError) return c.json({ error: err.message }, 400);
  console.error(err);
  return c.json({ error: 'Error interno' }, 500);
});

async function readJson<T>(req: Request): Promise<Partial<T>> {
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return {};
  }
}

const toMe = (u: UserRow): Me => ({
  id: u.id,
  username: u.username,
  displayName: u.display_name,
  mustChangePassword: !!u.must_change_pw,
});

const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') || 'local';

// ───────────────────────────── Usuarios ─────────────────────────────

app.post('/auth/login', async (c) => {
  const { username, password } = await readJson<{ username: string; password: string }>(c.req.raw);
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return c.json({ error: 'Ingresa usuario y contraseña.' }, 400);
  }
  const uname = username.trim().toLowerCase();
  const keys = [`u:${uname}`, `ip:${clientIp(c.req.raw)}`];
  for (const k of keys) {
    if (await isLocked(c.env.DB, k)) return c.json({ error: 'Demasiados intentos. Espera 15 minutos.' }, 429);
  }
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(uname).first<UserRow>();
  const ok = user ? await verifyPassword(password, user.pw_hash) : (await hashPassword(password), false);
  if (!user || !ok || user.disabled) {
    for (const k of keys) await recordFailure(c.env.DB, k);
    return c.json({ error: user?.disabled && ok ? 'Tu cuenta está deshabilitada.' : 'Usuario o contraseña incorrectos.' }, 401);
  }
  await clearFailures(c.env.DB, keys[0]);
  await c.env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(Date.now(), user.id).run();
  await createSession(c, 'user', user.id);
  return c.json({ me: toMe(user) });
});

app.post('/auth/logout', async (c) => {
  await destroySession(c, 'user');
  return c.json({ ok: true });
});

app.get('/auth/me', requireUser({ allowMustChange: true }), (c) => c.json({ me: toMe(c.var.user) }));

app.post('/auth/password', requireUser({ allowMustChange: true }), async (c) => {
  const { current, next } = await readJson<{ current: string; next: string }>(c.req.raw);
  const user = c.var.user;
  if (typeof current !== 'string' || !(await verifyPassword(current, user.pw_hash))) {
    return c.json({ error: 'La contraseña actual no es correcta.' }, 400);
  }
  if (typeof next !== 'string' || next.length < MIN_PASSWORD) {
    return c.json({ error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` }, 400);
  }
  if (next === current) return c.json({ error: 'La nueva contraseña debe ser distinta.' }, 400);
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET pw_hash = ?, must_change_pw = 0, updated_at = ? WHERE id = ?').bind(await hashPassword(next), now, user.id),
    // Cierra las demás sesiones del usuario.
    c.env.DB.prepare("DELETE FROM sessions WHERE kind = 'user' AND subject_id = ? AND token_hash != ?").bind(user.id, c.var.tokenHash),
  ]);
  return c.json({ me: toMe({ ...user, must_change_pw: 0 }) });
});

app.post('/sync', requireUser(), async (c) => {
  const body = (await readJson<SyncRequest>(c.req.raw)) as SyncRequest;
  return c.json(await sync(c.env.DB, c.var.user.id, body));
});

// ─────────────────────────── Administración ───────────────────────────
// Ningún handler de esta sección consulta entries, meds ni profiles.

app.post('/admin/login', async (c) => {
  const { username, password } = await readJson<{ username: string; password: string }>(c.req.raw);
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return c.json({ error: 'Ingresa usuario y contraseña.' }, 400);
  }
  const uname = username.trim().toLowerCase();
  const keys = [`a:${uname}`, `aip:${clientIp(c.req.raw)}`];
  for (const k of keys) {
    if (await isLocked(c.env.DB, k)) return c.json({ error: 'Demasiados intentos. Espera 15 minutos.' }, 429);
  }
  const admin = await c.env.DB.prepare('SELECT id, username, pw_hash FROM admins WHERE username = ?').bind(uname).first<{ id: string; username: string; pw_hash: string }>();
  const ok = admin ? await verifyPassword(password, admin.pw_hash) : (await hashPassword(password), false);
  if (!admin || !ok) {
    for (const k of keys) await recordFailure(c.env.DB, k);
    return c.json({ error: 'Usuario o contraseña incorrectos.' }, 401);
  }
  await clearFailures(c.env.DB, keys[0]);
  await createSession(c, 'admin', admin.id);
  return c.json({ admin: { username: admin.username } });
});

app.post('/admin/logout', async (c) => {
  await destroySession(c, 'admin');
  return c.json({ ok: true });
});

app.use('/admin/*', async (c, next) => {
  if (c.req.path === '/api/admin/login' || c.req.path === '/api/admin/logout') return next();
  return requireAdmin(c, next);
});

app.get('/admin/me', (c) => c.json({ admin: { username: c.var.admin.username } }));

app.post('/admin/password', async (c) => {
  const { current, next } = await readJson<{ current: string; next: string }>(c.req.raw);
  if (typeof current !== 'string' || !(await verifyPassword(current, c.var.admin.pw_hash))) {
    return c.json({ error: 'La contraseña actual no es correcta.' }, 400);
  }
  if (typeof next !== 'string' || next.length < 10) return c.json({ error: 'La nueva contraseña debe tener al menos 10 caracteres.' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE admins SET pw_hash = ? WHERE id = ?').bind(await hashPassword(next), c.var.admin.id),
    c.env.DB.prepare("DELETE FROM sessions WHERE kind = 'admin' AND subject_id = ? AND token_hash != ?").bind(c.var.admin.id, c.var.tokenHash),
  ]);
  return c.json({ ok: true });
});

const USER_COLUMNS = 'id, username, display_name, must_change_pw, disabled, created_at, last_login_at';

interface AdminUserRow {
  id: string;
  username: string;
  display_name: string;
  must_change_pw: number;
  disabled: number;
  created_at: number;
  last_login_at: number | null;
}

const toAdminUser = (u: AdminUserRow) => ({
  id: u.id,
  username: u.username,
  displayName: u.display_name,
  mustChangePassword: !!u.must_change_pw,
  disabled: !!u.disabled,
  createdAt: u.created_at,
  lastLoginAt: u.last_login_at,
});

app.get('/admin/users', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY created_at`).all<AdminUserRow>();
  return c.json({ users: results.map(toAdminUser) });
});

app.post('/admin/users', async (c) => {
  const { username, displayName } = await readJson<{ username: string; displayName: string }>(c.req.raw);
  const uname = typeof username === 'string' ? username.trim().toLowerCase() : '';
  const name = typeof displayName === 'string' ? displayName.trim() : '';
  if (!USERNAME_RE.test(uname)) return c.json({ error: 'Usuario: 3–32 caracteres (a-z, 0-9, punto, guion).' }, 400);
  if (!name || name.length > 80) return c.json({ error: 'Indica el nombre de la persona.' }, 400);
  const exists = await c.env.DB.prepare('SELECT 1 FROM users WHERE username = ?').bind(uname).first();
  if (exists) return c.json({ error: 'Ese usuario ya existe.' }, 409);
  const password = tempPassword();
  const id = newId();
  const now = Date.now();
  await c.env.DB.prepare(
    'INSERT INTO users (id, username, display_name, pw_hash, must_change_pw, disabled, seq, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, 0, ?, ?)',
  )
    .bind(id, uname, name, await hashPassword(password), now, now)
    .run();
  const row = await c.env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).bind(id).first<AdminUserRow>();
  return c.json({ user: toAdminUser(row!), tempPassword: password }, 201);
});

app.patch('/admin/users/:id', async (c) => {
  const id = c.req.param('id');
  const body = await readJson<{ displayName: string; disabled: boolean; resetPassword: boolean }>(c.req.raw);
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!user) return c.json({ error: 'Usuario no encontrado.' }, 404);
  const now = Date.now();
  const stmts: D1PreparedStatement[] = [];
  let password: string | undefined;
  if (body.displayName !== undefined) {
    const name = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (!name || name.length > 80) return c.json({ error: 'Indica el nombre de la persona.' }, 400);
    stmts.push(c.env.DB.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').bind(name, now, id));
  }
  if (typeof body.disabled === 'boolean') {
    stmts.push(c.env.DB.prepare('UPDATE users SET disabled = ?, updated_at = ? WHERE id = ?').bind(body.disabled ? 1 : 0, now, id));
  }
  if (body.resetPassword) {
    password = tempPassword();
    stmts.push(c.env.DB.prepare('UPDATE users SET pw_hash = ?, must_change_pw = 1, updated_at = ? WHERE id = ?').bind(await hashPassword(password), now, id));
  }
  if (body.disabled === true || body.resetPassword) {
    stmts.push(c.env.DB.prepare("DELETE FROM sessions WHERE kind = 'user' AND subject_id = ?").bind(id));
  }
  if (stmts.length) await c.env.DB.batch(stmts);
  const row = await c.env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).bind(id).first<AdminUserRow>();
  return c.json({ user: toAdminUser(row!), tempPassword: password });
});

app.delete('/admin/users/:id', async (c) => {
  const id = c.req.param('id');
  // Borra al usuario y sus datos sin leerlos.
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM entries WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM meds WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM profiles WHERE user_id = ?').bind(id),
    c.env.DB.prepare("DELETE FROM sessions WHERE kind = 'user' AND subject_id = ?").bind(id),
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
  return c.json({ ok: true });
});

app.all('*', (c) => c.json({ error: 'No encontrado' }, 404));

export const onRequest = handle(app);
