import { and, desc, eq, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { newUlid as ulid } from "./ids";
import { encodeHlc, hlcNext } from "./hlc";
import type { Hlc } from "./hlc";
import type { DocumentType, LedgerKind, LinkKind, VaultDocument } from "./index";
import { documents, ledger, links, oplog, settings } from "./schema";
import { extractWikilinks } from "./wikilinks";

/** Drizzle database over either driver: expo-sqlite (app) or better-sqlite3 (tests). */
export type VaultDb = BaseSQLiteDatabase<"sync" | "async", unknown, Record<string, never>>;

export interface LedgerEntry {
  id: number;
  ts: number;
  kind: LedgerKind;
  summary: string;
  docUlid: string | null;
  /** Restore payload for undoable actions: JSON {prevBodyMd, prevTitle?}. */
  diffRef: string | null;
}

export interface SearchHit {
  ulid: string;
  type: DocumentType;
  title: string;
  shelf: string | null;
  /** Snippet around the match, with the match wrapped in » «. */
  snippet: string;
}

export interface ShelfSummary {
  shelf: string;
  count: number;
}

/**
 * The vault's async API. Two implementations: SqliteVault (the real thing)
 * and MemoryVault (web fallback until sqlite-on-web lands; also fast tests).
 * UI code depends on this interface only.
 */
export interface VaultApi {
  createDocument(input: {
    type: DocumentType;
    title: string;
    bodyMd: string;
    shelf?: string | null;
    /** Historical creation time (importer); defaults to now. */
    createdAt?: number;
    audioUri?: string | null;
    remindAt?: number | null;
    ledger?: { kind: LedgerKind; summary: string };
  }): Promise<VaultDocument>;
  updateDocument(
    ulid: string,
    patch: { title?: string; bodyMd?: string; shelf?: string | null },
    ledgerEntry?: { kind: LedgerKind; summary: string },
  ): Promise<VaultDocument>;
  getDocument(ulid: string): Promise<VaultDocument | null>;
  /** Case-insensitive title lookup — how wikilinks resolve. */
  getDocumentByTitle(title: string): Promise<VaultDocument | null>;
  /** Documents whose bodies link to this title. */
  getBacklinks(title: string): Promise<VaultDocument[]>;
  listByType(type: DocumentType, limit?: number): Promise<VaultDocument[]>;
  listShelf(shelf: string): Promise<VaultDocument[]>;
  listShelves(): Promise<ShelfSummary[]>;
  search(query: string, limit?: number): Promise<SearchHit[]>;
  /** Stores the assistant's reply beside an entry + its citation links. */
  attachReply(ulid: string, replyMd: string, sourceTitles: string[]): Promise<void>;
  /** Titles of pages a document cites (links of the given kind). */
  getLinkTargets(ulid: string, kind: LinkKind): Promise<string[]>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  /** Outbox rows not yet accepted by the server. */
  listUnpushedOps(): Promise<
    { opUlid: string; docUlid: string; deviceId: string; hlc: string; payload: string }[]
  >;
  markOpsPushed(opUlids: string[]): Promise<void>;
  /**
   * Applies a document from another device: last-write-wins by HLC.
   * Writes documents/links only — no outbox echo, no ledger noise.
   * Returns true if the local copy changed.
   */
  applyRemoteDocument(doc: VaultDocument, hlc: string): Promise<boolean>;
  appendLedger(
    kind: LedgerKind,
    summary: string,
    docUlid?: string,
    ts?: number,
    diffRef?: string,
  ): Promise<void>;
  listLedger(limit?: number): Promise<LedgerEntry[]>;
  countDocuments(): Promise<number>;
}

const DEFAULT_LEDGER: Record<DocumentType, LedgerKind> = {
  journal: "journal",
  wiki: "held",
  person: "held",
  thread: "held",
};

/** Turns free text into a safe FTS5 query: quoted prefix-phrases, ANDed. */
export function toFtsQuery(query: string): string {
  return query
    .split(/\s+/)
    .map((token) => token.replace(/"/g, "").trim())
    .filter(Boolean)
    .map((token) => `"${token}"*`)
    .join(" ");
}

export class SqliteVault implements VaultApi {
  private clock: Hlc;

  constructor(
    private readonly db: VaultDb,
    deviceId: string,
    private readonly now: () => number = Date.now,
  ) {
    this.clock = { ms: 0, count: 0, device: deviceId };
  }

  private tick(): string {
    this.clock = hlcNext(this.clock, this.now());
    return encodeHlc(this.clock);
  }

  private async writeOp(doc: VaultDocument, hlc: string): Promise<void> {
    await this.db.insert(oplog).values({
      opUlid: ulid(),
      docUlid: doc.ulid,
      deviceId: this.clock.device,
      hlc,
      opKind: "put",
      payload: JSON.stringify(doc),
      createdAt: this.now(),
    });
  }

  private async writeLinks(doc: VaultDocument): Promise<void> {
    await this.db
      .delete(links)
      .where(and(eq(links.fromUlid, doc.ulid), eq(links.kind, "wikilink")));
    const targets = [...new Set(extractWikilinks(doc.bodyMd))];
    if (targets.length === 0) return;
    await this.db
      .insert(links)
      .values(
        targets.map((targetTitle) => ({ fromUlid: doc.ulid, targetTitle, kind: "wikilink" })),
      );
  }

  async createDocument(input: {
    type: DocumentType;
    title: string;
    bodyMd: string;
    shelf?: string | null;
    createdAt?: number;
    audioUri?: string | null;
    remindAt?: number | null;
    ledger?: { kind: LedgerKind; summary: string };
  }): Promise<VaultDocument> {
    const ts = input.createdAt ?? this.now();
    const hlc = this.tick();
    const doc: VaultDocument = {
      ulid: ulid(),
      type: input.type,
      title: input.title,
      bodyMd: input.bodyMd,
      shelf: input.shelf ?? null,
      createdAt: ts,
      updatedAt: ts,
      audioUri: input.audioUri ?? null,
      replyMd: null,
      remindAt: input.remindAt ?? null,
    };
    await this.db.insert(documents).values({ ...doc, hlc });
    await this.writeLinks(doc);
    await this.writeOp(doc, hlc);
    const entry = input.ledger ?? { kind: DEFAULT_LEDGER[input.type], summary: input.title };
    await this.appendLedger(entry.kind, entry.summary, doc.ulid, ts);
    return doc;
  }

  async updateDocument(
    docUlid: string,
    patch: { title?: string; bodyMd?: string; shelf?: string | null },
    ledgerEntry?: { kind: LedgerKind; summary: string },
  ): Promise<VaultDocument> {
    const existing = await this.getDocument(docUlid);
    if (!existing) throw new Error(`No document ${docUlid}`);
    const hlc = this.tick();
    const updated: VaultDocument = {
      ...existing,
      ...("title" in patch && patch.title !== undefined ? { title: patch.title } : {}),
      ...("bodyMd" in patch && patch.bodyMd !== undefined ? { bodyMd: patch.bodyMd } : {}),
      ...("shelf" in patch ? { shelf: patch.shelf ?? null } : {}),
      updatedAt: this.now(),
    };
    await this.db
      .update(documents)
      .set({
        title: updated.title,
        bodyMd: updated.bodyMd,
        shelf: updated.shelf,
        updatedAt: updated.updatedAt,
        hlc,
      })
      .where(eq(documents.ulid, docUlid));
    await this.writeLinks(updated);
    await this.writeOp(updated, hlc);
    if (ledgerEntry) await this.appendLedger(ledgerEntry.kind, ledgerEntry.summary, docUlid);
    return updated;
  }

  async getDocument(docUlid: string): Promise<VaultDocument | null> {
    const rows = await this.db.select().from(documents).where(eq(documents.ulid, docUlid)).limit(1);
    return rows[0] ? toDoc(rows[0]) : null;
  }

  async getDocumentByTitle(title: string): Promise<VaultDocument | null> {
    const rows = await this.db
      .select()
      .from(documents)
      .where(sql`${documents.title} = ${title} COLLATE NOCASE`)
      .limit(1);
    return rows[0] ? toDoc(rows[0]) : null;
  }

  async getBacklinks(title: string): Promise<VaultDocument[]> {
    const rows = await this.db
      .select({ doc: documents })
      .from(links)
      .innerJoin(documents, eq(documents.ulid, links.fromUlid))
      .where(sql`${links.targetTitle} = ${title} COLLATE NOCASE`)
      .orderBy(documents.title);
    return rows.map((r) => toDoc(r.doc));
  }

  async listByType(type: DocumentType, limit = 100): Promise<VaultDocument[]> {
    const rows = await this.db
      .select()
      .from(documents)
      .where(eq(documents.type, type))
      .orderBy(desc(documents.updatedAt))
      .limit(limit);
    return rows.map(toDoc);
  }

  async listShelf(shelf: string): Promise<VaultDocument[]> {
    const rows = await this.db
      .select()
      .from(documents)
      .where(eq(documents.shelf, shelf))
      .orderBy(documents.title);
    return rows.map(toDoc);
  }

  async listShelves(): Promise<ShelfSummary[]> {
    const rows = await this.db
      .select({ shelf: documents.shelf, count: sql<number>`count(*)` })
      .from(documents)
      .where(sql`${documents.shelf} IS NOT NULL`)
      .groupBy(documents.shelf)
      .orderBy(documents.shelf);
    return rows.flatMap((r) => (r.shelf ? [{ shelf: r.shelf, count: Number(r.count) }] : []));
  }

  async search(query: string, limit = 20): Promise<SearchHit[]> {
    const fts = toFtsQuery(query);
    if (!fts) return [];
    const rows = (await this.db.all(sql`
      SELECT d.ulid AS ulid, d.type AS type, d.title AS title, d.shelf AS shelf,
             snippet(documents_fts, 1, '»', '«', '…', 12) AS snippet
      FROM documents_fts
      JOIN documents d ON d.rowid = documents_fts.rowid
      WHERE documents_fts MATCH ${fts}
      ORDER BY rank
      LIMIT ${limit}
    `)) as SearchHit[];
    return rows;
  }

  async listUnpushedOps(): Promise<
    { opUlid: string; docUlid: string; deviceId: string; hlc: string; payload: string }[]
  > {
    const rows = await this.db
      .select({
        opUlid: oplog.opUlid,
        docUlid: oplog.docUlid,
        deviceId: oplog.deviceId,
        hlc: oplog.hlc,
        payload: oplog.payload,
      })
      .from(oplog)
      .where(eq(oplog.pushed, 0))
      .orderBy(oplog.createdAt, oplog.hlc);
    return rows;
  }

  async markOpsPushed(opUlids: string[]): Promise<void> {
    for (const opUlid of opUlids) {
      await this.db.update(oplog).set({ pushed: 1 }).where(eq(oplog.opUlid, opUlid));
    }
  }

  async applyRemoteDocument(doc: VaultDocument, hlc: string): Promise<boolean> {
    const existing = await this.db
      .select({ hlc: documents.hlc })
      .from(documents)
      .where(eq(documents.ulid, doc.ulid))
      .limit(1);
    if (existing[0] && existing[0].hlc >= hlc) return false; // ours is newer or same
    const row = {
      type: doc.type,
      title: doc.title,
      bodyMd: doc.bodyMd,
      shelf: doc.shelf,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      audioUri: doc.audioUri ?? null,
      replyMd: doc.replyMd ?? null,
      remindAt: doc.remindAt ?? null,
      hlc,
    };
    if (existing[0]) {
      await this.db.update(documents).set(row).where(eq(documents.ulid, doc.ulid));
    } else {
      await this.db.insert(documents).values({ ulid: doc.ulid, ...row });
    }
    await this.writeLinks(doc);
    return true;
  }

  async attachReply(docUlid: string, replyMd: string, sourceTitles: string[]): Promise<void> {
    await this.db.update(documents).set({ replyMd }).where(eq(documents.ulid, docUlid));
    await this.db.delete(links).where(and(eq(links.fromUlid, docUlid), eq(links.kind, "reply")));
    const unique = [...new Set(sourceTitles)];
    if (unique.length > 0) {
      await this.db
        .insert(links)
        .values(unique.map((targetTitle) => ({ fromUlid: docUlid, targetTitle, kind: "reply" })));
    }
  }

  async getLinkTargets(docUlid: string, kind: LinkKind): Promise<string[]> {
    const rows = await this.db
      .select({ targetTitle: links.targetTitle })
      .from(links)
      .where(and(eq(links.fromUlid, docUlid), eq(links.kind, kind)))
      .orderBy(links.targetTitle);
    return rows.map((r) => r.targetTitle);
  }

  async appendLedger(
    kind: LedgerKind,
    summary: string,
    docUlid?: string,
    ts?: number,
    diffRef?: string,
  ): Promise<void> {
    await this.db.insert(ledger).values({
      ts: ts ?? this.now(),
      kind,
      summary,
      docUlid: docUlid ?? null,
      diffRef: diffRef ?? null,
    });
  }

  async listLedger(limit = 100): Promise<LedgerEntry[]> {
    const rows = await this.db.select().from(ledger).orderBy(desc(ledger.id)).limit(limit);
    return rows.map((r) => ({
      id: r.id,
      ts: r.ts,
      kind: r.kind as LedgerKind,
      summary: r.summary,
      docUlid: r.docUlid,
      diffRef: r.diffRef,
    }));
  }

  async countDocuments(): Promise<number> {
    const rows = await this.db.select({ count: sql<number>`count(*)` }).from(documents);
    return Number(rows[0]?.count ?? 0);
  }

  async getSetting(key: string): Promise<string | null> {
    const rows = await this.db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return rows[0]?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
}

function toDoc(row: {
  ulid: string;
  type: string;
  title: string;
  bodyMd: string;
  shelf: string | null;
  createdAt: number;
  updatedAt: number;
  audioUri?: string | null;
  replyMd?: string | null;
  remindAt?: number | null;
}): VaultDocument {
  return {
    ulid: row.ulid,
    type: row.type as DocumentType,
    title: row.title,
    bodyMd: row.bodyMd,
    shelf: row.shelf,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    audioUri: row.audioUri ?? null,
    replyMd: row.replyMd ?? null,
    remindAt: row.remindAt ?? null,
  };
}
