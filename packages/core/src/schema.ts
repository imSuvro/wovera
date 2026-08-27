import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * The vault's tables — the Karpathy skeleton as SQLite. One documents table,
 * typed; a links graph; the append-only ledger; and the oplog that the sync
 * protocol (next plan) will push. Raw SQL in migrations.ts is the source of
 * truth for DDL; drizzle here is the typed query layer, and the test suite
 * runs queries against migration-built databases so the two cannot drift.
 */

export const documents = sqliteTable("documents", {
  ulid: text("ulid").primaryKey(),
  type: text("type").notNull(), // DocumentType
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  shelf: text("shelf"), // wiki index section; null for journal/thread
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  hlc: text("hlc").notNull(),
  /** Raw dictation audio file, when the entry was spoken. */
  audioUri: text("audio_uri"),
  /** The assistant's reply — beside the entry, never inside the verbatim body. */
  replyMd: text("reply_md"),
  /** Threads with a clock: when this document should resurface (ms epoch). */
  remindAt: integer("remind_at"),
});

export const links = sqliteTable(
  "links",
  {
    fromUlid: text("from_ulid").notNull(),
    /** Wikilink target by title — may name a page that doesn't exist yet. */
    targetTitle: text("target_title").notNull(),
    kind: text("kind").notNull(), // LinkKind
  },
  (t) => [primaryKey({ columns: [t.fromUlid, t.targetTitle, t.kind] })],
);

export const ledger = sqliteTable("ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ts: integer("ts").notNull(),
  kind: text("kind").notNull(), // LedgerKind
  summary: text("summary").notNull(),
  docUlid: text("doc_ulid"),
  diffRef: text("diff_ref"),
});

export const oplog = sqliteTable("oplog_outbox", {
  opUlid: text("op_ulid").primaryKey(),
  docUlid: text("doc_ulid").notNull(),
  deviceId: text("device_id").notNull(),
  hlc: text("hlc").notNull(),
  opKind: text("op_kind").notNull(), // v1: "put"
  /** JSON of the full document — small docs make full-doc ops the simple choice. */
  payload: text("payload").notNull(),
  createdAt: integer("created_at").notNull(),
  pushed: integer("pushed").notNull().default(0),
});

export const syncState = sqliteTable("sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
