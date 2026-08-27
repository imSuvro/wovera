/**
 * @wovera/core — the vault's domain model.
 *
 * The skeleton mirrors the Karpathy LLM-Wiki pattern the product grew from:
 * raw words are immutable, compiled knowledge lives on shelves, every action
 * the assistant takes lands in an append-only ledger.
 */

/** Every document in the vault is one of these. One table, typed. */
export const DOCUMENT_TYPES = ["journal", "wiki", "person", "thread"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Ledger kinds — the user-facing names for the vault's operations.
 * journal = an entry was written · held = a writeback the assistant kept
 * woven = a source compiled in · tidy = maintenance · rule = House Rules change
 */
export const LEDGER_KINDS = ["journal", "held", "woven", "tidy", "rule"] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

/** Link kinds between documents — the [[wikilink]] graph plus provenance. */
export const LINK_KINDS = ["wikilink", "provenance", "reply"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export interface VaultDocument {
  /** ULID — sortable, unique across devices; the sync protocol depends on it. */
  ulid: string;
  type: DocumentType;
  title: string;
  /** Markdown. For journal entries this is verbatim — never rewritten. */
  bodyMd: string;
  /** Shelf name (wiki index section). Null for journal entries and threads. */
  shelf: string | null;
  createdAt: number;
  updatedAt: number;
}

export const CORE_VERSION = "0.0.1";
