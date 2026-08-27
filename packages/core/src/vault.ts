import { and, desc, eq, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { ulid } from "ulidx";
import { encodeHlc, hlcNext } from "./hlc";
import type { Hlc } from "./hlc";
import type { DocumentType, LedgerKind, VaultDocument } from "./index";
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
    ledger?: { kind: LedgerKind; summary: string };
  }): Promise<VaultDocument>;
  updateDocument(
    ulid: string,
    patch: { title?: string; bodyMd?: string; shelf?: string | null },
    ledgerEntry?: { kind: LedgerKind; summary: string },
  ): Promise<VaultDocument>;
  getDocument(ulid: string): Promise<VaultDocument | null>;
  listByType(type: DocumentType, limit?: number): Promise<VaultDocument[]>;
  listShelf(shelf: string): Promise<VaultDocument[]>;
  listShelves(): Promise<ShelfSummary[]>;
  search(query: string, limit?: number): Promise<SearchHit[]>;
  appendLedger(kind: LedgerKind, summary: string, docUlid?: string): Promise<void>;
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
    ledger?: { kind: LedgerKind; summary: string };
  }): Promise<VaultDocument> {
    const ts = this.now();
    const hlc = this.tick();
    const doc: VaultDocument = {
      ulid: ulid(),
      type: input.type,
      title: input.title,
      bodyMd: input.bodyMd,
      shelf: input.shelf ?? null,
      createdAt: ts,
      updatedAt: ts,
    };
    await this.db.insert(documents).values({ ...doc, hlc });
    await this.writeLinks(doc);
    await this.writeOp(doc, hlc);
    const entry = input.ledger ?? { kind: DEFAULT_LEDGER[input.type], summary: input.title };
    await this.appendLedger(entry.kind, entry.summary, doc.ulid);
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

  async appendLedger(kind: LedgerKind, summary: string, docUlid?: string): Promise<void> {
    await this.db
      .insert(ledger)
      .values({ ts: this.now(), kind, summary, docUlid: docUlid ?? null });
  }

  async listLedger(limit = 100): Promise<LedgerEntry[]> {
    const rows = await this.db.select().from(ledger).orderBy(desc(ledger.id)).limit(limit);
    return rows.map((r) => ({
      id: r.id,
      ts: r.ts,
      kind: r.kind as LedgerKind,
      summary: r.summary,
      docUlid: r.docUlid,
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
}): VaultDocument {
  return {
    ulid: row.ulid,
    type: row.type as DocumentType,
    title: row.title,
    bodyMd: row.bodyMd,
    shelf: row.shelf,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
