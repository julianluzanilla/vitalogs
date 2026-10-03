import {
  entryData,
  sanitizeEntry,
  sanitizeMed,
  SYNC_BATCH,
  type Entry,
  type Med,
  type Profile,
  type SyncRequest,
  type SyncResponse,
} from '../../shared/model';

const PAGE = 500;

interface EntryRow {
  id: string;
  type: string;
  date: string;
  time: string;
  data: string;
  updated_at: number;
  deleted: number;
  server_seq: number;
}

interface MedRow {
  id: string;
  name: string;
  dose: string;
  updated_at: number;
  deleted: number;
  server_seq: number;
}

export class SyncError extends Error {}

/**
 * Aplica los cambios del cliente y devuelve todo lo modificado desde `cursor`.
 *
 * Cada fila escrita recibe un `server_seq` del contador del usuario. El incremento del
 * contador y las escrituras van en un único batch (transacción), así que un lector nunca
 * ve un contador mayor que las filas confirmadas. Conflictos: last-write-wins por updatedAt.
 */
export async function sync(db: D1Database, userId: string, body: SyncRequest): Promise<SyncResponse> {
  const cursor = Number.isFinite(body?.cursor) && body.cursor >= 0 ? Math.floor(body.cursor) : 0;
  const rawEntries = Array.isArray(body?.entries) ? body.entries : [];
  const rawMeds = Array.isArray(body?.meds) ? body.meds : [];
  const total = rawEntries.length + rawMeds.length + (body?.profile ? 1 : 0);
  if (total > SYNC_BATCH) throw new SyncError(`Máximo ${SYNC_BATCH} cambios por petición`);

  const entries: Entry[] = [];
  for (const r of rawEntries) {
    const e = sanitizeEntry(r);
    if (!e) throw new SyncError('Registro no válido');
    entries.push(e);
  }
  const meds: Med[] = [];
  for (const r of rawMeds) {
    const m = sanitizeMed(r);
    if (!m) throw new SyncError('Medicamento no válido');
    meds.push(m);
  }
  let profile: Profile | null = null;
  if (body?.profile) {
    const p = body.profile;
    if (typeof p.reportName !== 'string' || p.reportName.length > 120 || !Number.isFinite(p.updatedAt)) throw new SyncError('Perfil no válido');
    profile = { reportName: p.reportName, updatedAt: p.updatedAt };
  }

  const n = entries.length + meds.length + (profile ? 1 : 0);
  if (n > 0) {
    // seq asignado a la fila i: (contador final) - (n - 1 - i)
    const seqExpr = '(SELECT seq FROM users WHERE id = ?) - ?';
    const stmts: D1PreparedStatement[] = [db.prepare('UPDATE users SET seq = seq + ? WHERE id = ?').bind(n, userId)];
    let i = 0;
    for (const e of entries) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO entries (user_id, id, type, date, time, data, updated_at, deleted, server_seq)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${seqExpr})
             ON CONFLICT(user_id, id) DO UPDATE SET
               type = excluded.type, date = excluded.date, time = excluded.time, data = excluded.data,
               updated_at = excluded.updated_at, deleted = excluded.deleted, server_seq = excluded.server_seq
             WHERE excluded.updated_at >= entries.updated_at`,
          )
          .bind(userId, e.id, e.type, e.date, e.time, JSON.stringify(entryData(e)), e.updatedAt, e.deleted ? 1 : 0, userId, n - 1 - i++),
      );
    }
    for (const m of meds) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO meds (user_id, id, name, dose, updated_at, deleted, server_seq)
             VALUES (?, ?, ?, ?, ?, ?, ${seqExpr})
             ON CONFLICT(user_id, id) DO UPDATE SET
               name = excluded.name, dose = excluded.dose, updated_at = excluded.updated_at,
               deleted = excluded.deleted, server_seq = excluded.server_seq
             WHERE excluded.updated_at >= meds.updated_at`,
          )
          .bind(userId, m.id, m.name, m.dose, m.updatedAt, m.deleted ? 1 : 0, userId, n - 1 - i++),
      );
    }
    if (profile) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO profiles (user_id, report_name, updated_at, server_seq)
             VALUES (?, ?, ?, ${seqExpr})
             ON CONFLICT(user_id) DO UPDATE SET
               report_name = excluded.report_name, updated_at = excluded.updated_at, server_seq = excluded.server_seq
             WHERE excluded.updated_at >= profiles.updated_at`,
          )
          .bind(userId, profile.reportName, profile.updatedAt, userId, n - 1 - i++),
      );
    }
    await db.batch(stmts);
  }

  // Lectura consistente: contador + cambios en una sola transacción.
  const [seqRes, entRes, medRes, profRes] = await db.batch([
    db.prepare('SELECT seq FROM users WHERE id = ?').bind(userId),
    db
      .prepare('SELECT id, type, date, time, data, updated_at, deleted, server_seq FROM entries WHERE user_id = ? AND server_seq > ? ORDER BY server_seq LIMIT ?')
      .bind(userId, cursor, PAGE + 1),
    db
      .prepare('SELECT id, name, dose, updated_at, deleted, server_seq FROM meds WHERE user_id = ? AND server_seq > ? ORDER BY server_seq LIMIT ?')
      .bind(userId, cursor, PAGE + 1),
    db.prepare('SELECT report_name, updated_at, server_seq FROM profiles WHERE user_id = ? AND server_seq > ?').bind(userId, cursor),
  ]);

  const seq = (seqRes.results[0] as { seq: number } | undefined)?.seq ?? 0;
  let entRows = entRes.results as unknown as EntryRow[];
  let medRows = medRes.results as unknown as MedRow[];
  const profRow = profRes.results[0] as { report_name: string; updated_at: number; server_seq: number } | undefined;

  // Si alguna lista se cortó, el nuevo cursor es el menor seq que aún falta, menos 1.
  let next = seq;
  let hasMore = false;
  if (entRows.length > PAGE) {
    hasMore = true;
    next = Math.min(next, entRows[PAGE].server_seq - 1);
  }
  if (medRows.length > PAGE) {
    hasMore = true;
    next = Math.min(next, medRows[PAGE].server_seq - 1);
  }
  entRows = entRows.filter((r) => r.server_seq <= next);
  medRows = medRows.filter((r) => r.server_seq <= next);

  return {
    cursor: next,
    hasMore,
    entries: entRows.map(
      (r) =>
        ({
          ...JSON.parse(r.data),
          id: r.id,
          type: r.type,
          date: r.date,
          time: r.time,
          updatedAt: r.updated_at,
          deleted: r.deleted ? 1 : 0,
        }) as Entry,
    ),
    meds: medRows.map((r) => ({ id: r.id, name: r.name, dose: r.dose, updatedAt: r.updated_at, deleted: r.deleted ? 1 : 0 })),
    profile: profRow && profRow.server_seq <= next ? { reportName: profRow.report_name, updatedAt: profRow.updated_at } : null,
  };
}
