import { ulid } from "ulidx";
import type { DocumentType, LedgerKind, VaultDocument } from "./index";
import type { LedgerEntry, SearchHit, ShelfSummary, VaultApi } from "./vault";

const DEFAULT_LEDGER: Record<DocumentType, LedgerKind> = {
  journal: "journal",
  wiki: "held",
  person: "held",
  thread: "held",
};

/**
 * In-memory VaultApi. Two jobs: the web build's fallback until
 * sqlite-on-web graduates from alpha (Phase 7), and instant test doubles.
 * Search is a naive substring match — fine at fallback scale.
 */
export class MemoryVault implements VaultApi {
  private docs = new Map<string, VaultDocument>();
  private ledgerRows: LedgerEntry[] = [];
  private nextLedgerId = 1;

  async createDocument(input: {
    type: DocumentType;
    title: string;
    bodyMd: string;
    shelf?: string | null;
    ledger?: { kind: LedgerKind; summary: string };
  }): Promise<VaultDocument> {
    const now = Date.now();
    const doc: VaultDocument = {
      ulid: ulid(),
      type: input.type,
      title: input.title,
      bodyMd: input.bodyMd,
      shelf: input.shelf ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.docs.set(doc.ulid, doc);
    const entry = input.ledger ?? { kind: DEFAULT_LEDGER[input.type], summary: input.title };
    await this.appendLedger(entry.kind, entry.summary, doc.ulid);
    return doc;
  }

  async updateDocument(
    docUlid: string,
    patch: { title?: string; bodyMd?: string; shelf?: string | null },
    ledgerEntry?: { kind: LedgerKind; summary: string },
  ): Promise<VaultDocument> {
    const existing = this.docs.get(docUlid);
    if (!existing) throw new Error(`No document ${docUlid}`);
    const updated: VaultDocument = {
      ...existing,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.bodyMd !== undefined ? { bodyMd: patch.bodyMd } : {}),
      ...("shelf" in patch ? { shelf: patch.shelf ?? null } : {}),
      updatedAt: Date.now(),
    };
    this.docs.set(docUlid, updated);
    if (ledgerEntry) await this.appendLedger(ledgerEntry.kind, ledgerEntry.summary, docUlid);
    return updated;
  }

  async getDocument(docUlid: string): Promise<VaultDocument | null> {
    return this.docs.get(docUlid) ?? null;
  }

  async listByType(type: DocumentType, limit = 100): Promise<VaultDocument[]> {
    return [...this.docs.values()]
      .filter((d) => d.type === type)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  async listShelf(shelf: string): Promise<VaultDocument[]> {
    return [...this.docs.values()]
      .filter((d) => d.shelf === shelf)
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async listShelves(): Promise<ShelfSummary[]> {
    const counts = new Map<string, number>();
    for (const doc of this.docs.values()) {
      if (doc.shelf) counts.set(doc.shelf, (counts.get(doc.shelf) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([shelf, count]) => ({ shelf, count }))
      .sort((a, b) => a.shelf.localeCompare(b.shelf));
  }

  async search(query: string, limit = 20): Promise<SearchHit[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];
    for (const doc of this.docs.values()) {
      const inTitle = doc.title.toLowerCase().includes(q);
      const bodyIdx = doc.bodyMd.toLowerCase().indexOf(q);
      if (!inTitle && bodyIdx < 0) continue;
      const start = Math.max(0, bodyIdx - 40);
      const snippet =
        bodyIdx >= 0 ? `…${doc.bodyMd.slice(start, bodyIdx + q.length + 40)}…` : doc.title;
      hits.push({ ulid: doc.ulid, type: doc.type, title: doc.title, shelf: doc.shelf, snippet });
      if (hits.length >= limit) break;
    }
    return hits;
  }

  async appendLedger(kind: LedgerKind, summary: string, docUlid?: string): Promise<void> {
    this.ledgerRows.push({
      id: this.nextLedgerId++,
      ts: Date.now(),
      kind,
      summary,
      docUlid: docUlid ?? null,
    });
  }

  async listLedger(limit = 100): Promise<LedgerEntry[]> {
    return [...this.ledgerRows].reverse().slice(0, limit);
  }

  async countDocuments(): Promise<number> {
    return this.docs.size;
  }
}
