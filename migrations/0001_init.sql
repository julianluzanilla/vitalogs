-- VitaLogs: esquema inicial

-- Usuarios finales (dueños de sus registros)
CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  username       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name   TEXT NOT NULL,
  pw_hash        TEXT NOT NULL,           -- pbkdf2$<iter>$<salt b64>$<hash b64>
  must_change_pw INTEGER NOT NULL DEFAULT 1,
  disabled       INTEGER NOT NULL DEFAULT 0,
  seq            INTEGER NOT NULL DEFAULT 0, -- contador de sincronización por usuario
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  last_login_at  INTEGER
);

-- Administradores: identidades totalmente separadas de los usuarios
CREATE TABLE admins (
  id         TEXT PRIMARY KEY,
  username   TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pw_hash    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Sesiones: se guarda solo el SHA-256 del token
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('user', 'admin')),
  subject_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_subject ON sessions (kind, subject_id);

CREATE TABLE entries (
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  id         TEXT NOT NULL,
  type       TEXT NOT NULL,
  date       TEXT NOT NULL,
  time       TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  server_seq INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX entries_sync ON entries (user_id, server_seq);

CREATE TABLE meds (
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  id         TEXT NOT NULL,
  name       TEXT NOT NULL,
  dose       TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  server_seq INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX meds_sync ON meds (user_id, server_seq);

CREATE TABLE profiles (
  user_id     TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  report_name TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  server_seq  INTEGER NOT NULL
);

-- Limitación de intentos de inicio de sesión
CREATE TABLE login_attempts (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
