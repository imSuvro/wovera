import { newUlid as ulid } from "./ids";
import type { DocumentType, LedgerKind, LinkKind, VaultDocument } from "./index";
import type { LedgerEntry, SearchHit, ShelfSummary, VaultApi } from "./vault";
import { extractWikilinks } from "./wikilinks";

const DEFAULT_LEDGER: Record<DocumentType, LedgerKind> = {
  journal: "journal",
  wiki: "held",
  person: "held",
  thread: "held",
};

/** A whole in-memory vault as plain, JSON-safe data. */
export interface MemoryVaultState {
  version: 1;
  docs: VaultDocument[];
  ledger: LedgerEntry[];
  nextLedgerId: number;
  links: { from: string; kinds: { kind: string; titles: string[] }[] }[];
  settings: { key: string; value: string }[];
}

/**
 * In-memory VaultApi. Two jobs: the web build's fallback until
 * sqlite-on-web graduates from alpha (Phase 7), and instant test doubles.
 * Search is a naive substring match — fine at fallback scale.
 */
export class MemoryVault implements VaultApi {
  private docs = new Map<string, VaultDocument>();
  private ledgerRows: LedgerEntry[] = [];
  private nextLedgerId = 1;
  /** fromUlid → kind → target titles. */
  private linkRows = new Map<string, Map<string, string[]>>();

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
    const now = input.createdAt ?? Date.now();
    const doc: VaultDocument = {
      ulid: ulid(),
      type: input.type,
      title: input.title,
      bodyMd: input.bodyMd,
      shelf: input.shelf ?? null,
      createdAt: now,
      updatedAt: now,
      audioUri: input.audioUri ?? null,
      remindAt: input.remindAt ?? null,
    };
    this.docs.set(doc.ulid, doc);
    const entry = input.ledger ?? { kind: DEFAULT_LEDGER[input.type], summary: input.title };
    await this.appendLedger(entry.kind, entry.summary, doc.ulid, now);
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

  async getDocumentByTitle(title: string): Promise<VaultDocument | null> {
    const lower = title.toLowerCase();
    for (const doc of this.docs.values()) {
      if (doc.title.toLowerCase() === lower) return doc;
    }
    return null;
  }

  async getBacklinks(title: string): Promise<VaultDocument[]> {
    const lower = title.toLowerCase();
    return [...this.docs.values()]
      .filter((d) => extractWikilinks(d.bodyMd).some((t) => t.toLowerCase() === lower))
      .sort((a, b) => a.title.localeCompare(b.title));
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

  async attachReply(docUlid: string, replyMd: string, sourceTitles: string[]): Promise<void> {
    const doc = this.docs.get(docUlid);
    if (!doc) throw new Error(`No document ${docUlid}`);
    this.docs.set(docUlid, { ...doc, replyMd });
    const byKind = this.linkRows.get(docUlid) ?? new Map<string, string[]>();
    byKind.set("reply", [...new Set(sourceTitles)].sort());
    this.linkRows.set(docUlid, byKind);
  }

  async getLinkTargets(docUlid: string, kind: LinkKind): Promise<string[]> {
    return this.linkRows.get(docUlid)?.get(kind) ?? [];
  }

  async appendLedger(
    kind: LedgerKind,
    summary: string,
    docUlid?: string,
    ts?: number,
    diffRef?: string,
  ): Promise<void> {
    this.ledgerRows.push({
      id: this.nextLedgerId++,
      ts: ts ?? Date.now(),
      kind,
      summary,
      docUlid: docUlid ?? null,
      diffRef: diffRef ?? null,
    });
  }

  async listLedger(limit = 100): Promise<LedgerEntry[]> {
    return [...this.ledgerRows].reverse().slice(0, limit);
  }

  async countDocuments(): Promise<number> {
    return this.docs.size;
  }

  private settings = new Map<string, string>();

  async getSetting(key: string): Promise<string | null> {
    return this.settings.get(key) ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.settings.set(key, value);
  }

  /** Memory vault keeps no outbox — it is the offline/fallback tier. */
  async listUnpushedOps(): Promise<
    { opUlid: string; docUlid: string; deviceId: string; hlc: string; payload: string }[]
  > {
    return [];
  }

  async markOpsPushed(): Promise<void> {}

  private remoteHlc = new Map<string, string>();

  /**
   * The whole vault as plain data — so a host without durable SQLite (the
   * web build today) can keep it somewhere real between visits. Structured
   * cloneable and JSON-safe: no Maps, no class instances.
   */
  snapshot(): MemoryVaultState {
    return {
      version: 1,
      docs: [...this.docs.values()],
      ledger: this.ledgerRows,
      nextLedgerId: this.nextLedgerId,
      links: [...this.linkRows].map(([from, kinds]) => ({
        from,
        kinds: [...kinds].map(([kind, titles]) => ({ kind, titles })),
      })),
      settings: [...this.settings].map(([key, value]) => ({ key, value })),
    };
  }

  /** Rehydrates a vault from `snapshot()`. Unknown versions are ignored. */
  restore(state: MemoryVaultState): void {
    if (!state || state.version !== 1) return;
    this.docs = new Map(state.docs.map((d) => [d.ulid, d]));
    this.ledgerRows = [...state.ledger];
    this.nextLedgerId = state.nextLedgerId;
    this.linkRows = new Map(
      state.links.map(({ from, kinds }) => [from, new Map(kinds.map((k) => [k.kind, k.titles]))]),
    );
    this.settings = new Map(state.settings.map((s) => [s.key, s.value]));
  }

  async applyRemoteDocument(doc: VaultDocument, hlc: string): Promise<boolean> {
    const known = this.remoteHlc.get(doc.ulid);
    if (known && known >= hlc) return false;
    this.remoteHlc.set(doc.ulid, hlc);
    this.docs.set(doc.ulid, { ...doc });
    return true;
  }
}
