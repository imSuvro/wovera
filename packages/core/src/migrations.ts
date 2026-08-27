/**
 * Versioned raw-SQL migrations, tracked via PRAGMA user_version.
 *
 * Raw SQL (not a generator) because the vault needs things ORMs don't model:
 * an FTS5 external-content index with sync triggers, and database-level
 * enforcement that the ledger is append-only. The same migrations run on
 * expo-sqlite (app) and better-sqlite3 (tests), so tests exercise the real
 * schema the phone uses.
 */

export interface MigrationIO {
  /** Execute a batch of SQL statements. */
  exec(sql: string): void | Promise<void>;
  getUserVersion(): number | Promise<number>;
  setUserVersion(version: number): void | Promise<void>;
}

interface Migration {
  version: number;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
CREATE TABLE IF NOT EXISTS documents (
  ulid TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  shelf TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  hlc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_shelf ON documents(shelf);

CREATE TABLE IF NOT EXISTS links (
  from_ulid TEXT NOT NULL,
  target_title TEXT NOT NULL,
  kind TEXT NOT NULL,
  PRIMARY KEY (from_ulid, target_title, kind)
);

CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  doc_ulid TEXT,
  diff_ref TEXT
);
-- The trust mechanism, enforced by the engine itself: no rewriting history.
CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger
BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger
BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;

CREATE TABLE IF NOT EXISTS oplog_outbox (
  op_ulid TEXT PRIMARY KEY,
  doc_ulid TEXT NOT NULL,
  device_id TEXT NOT NULL,
  hlc TEXT NOT NULL,
  op_kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  pushed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_oplog_pushed ON oplog_outbox(pushed, created_at);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Full-text search over titles and bodies (external content keeps one copy).
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  title, body_md, content='documents', content_rowid='rowid'
);
CREATE TRIGGER IF NOT EXISTS documents_fts_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid, title, body_md) VALUES (new.rowid, new.title, new.body_md);
END;
CREATE TRIGGER IF NOT EXISTS documents_fts_ad AFTER DELETE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, body_md)
  VALUES ('delete', old.rowid, old.title, old.body_md);
END;
CREATE TRIGGER IF NOT EXISTS documents_fts_au AFTER UPDATE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, body_md)
  VALUES ('delete', old.rowid, old.title, old.body_md);
  INSERT INTO documents_fts(rowid, title, body_md) VALUES (new.rowid, new.title, new.body_md);
END;
`,
  },
  {
    version: 2,
    // The verbatim promise's second half: raw audio kept beside the words.
    sql: `ALTER TABLE documents ADD COLUMN audio_uri TEXT;`,
  },
  {
    version: 3,
    // The assistant's reply lives BESIDE the entry, never inside the
    // user's verbatim body. Citations ride the links table (kind 'reply').
    sql: `ALTER TABLE documents ADD COLUMN reply_md TEXT;`,
  },
  {
    version: 4,
    // A thread with a clock: quick-capture reminders resurface at this time.
    sql: `ALTER TABLE documents ADD COLUMN remind_at INTEGER;`,
  },
];

/** Applies pending migrations. Safe to call on every app start. */
export async function runMigrations(io: MigrationIO): Promise<number> {
  const current = await io.getUserVersion();
  let version = current;
  for (const migration of MIGRATIONS) {
    if (migration.version <= version) continue;
    await io.exec(migration.sql);
    await io.setUserVersion(migration.version);
    version = migration.version;
  }
  return version;
}
