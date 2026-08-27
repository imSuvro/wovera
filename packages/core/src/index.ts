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
  /** Raw dictation audio file, when the entry was spoken. */
  audioUri?: string | null;
  /** The assistant's reply — beside the entry, never inside the verbatim body. */
  replyMd?: string | null;
  /** Threads with a clock: when this document should resurface (ms epoch). */
  remindAt?: number | null;
}

export const CORE_VERSION = "0.0.1";

export { decodeHlc, encodeHlc, hlcMerge, hlcNext } from "./hlc";
export type { Hlc } from "./hlc";
export { MIGRATIONS, runMigrations } from "./migrations";
export type { MigrationIO } from "./migrations";
export * as schema from "./schema";
export { SqliteVault, toFtsQuery } from "./vault";
export type { LedgerEntry, SearchHit, ShelfSummary, VaultApi, VaultDb } from "./vault";
export { MemoryVault } from "./memoryVault";
export { newUlid } from "./ids";
export { extractWikilinks } from "./wikilinks";
export { buildReplyContext, significantTerms } from "./assistant/context";
export type { ReplyContext } from "./assistant/context";
export {
  ASK_SYSTEM_PROMPT,
  GENTLE_SYSTEM_PROMPT,
  ROUTE_SYSTEM_PROMPT,
  TITLE_SYSTEM_PROMPT,
  WRITEBACK_SYSTEM_PROMPT,
} from "./assistant/prompts";
export {
  applyRoute,
  isQuestionShaped,
  listThreads,
  localStampToMs,
  parseRouteResult,
} from "./assistant/routing";
export type { AppliedRoute, RouteResult } from "./assistant/routing";
export {
  createRecovery,
  decryptJson,
  deriveVaultKey,
  encryptJson,
  entropyToHex,
  entropyToMnemonic,
  hexToEntropy,
  mnemonicToRootEntropy,
  randomMnemonic,
} from "./crypto";
export type { VaultCipherEnvelope } from "./crypto";
export { runSync } from "./sync";
export type { RemoteOp, SyncResult, SyncTransport } from "./sync";
export {
  MAX_WRITEBACKS,
  applyWriteback,
  parseWritebackProposals,
  restoreFromLedger,
} from "./assistant/writebacks";
export type { AppliedWriteback, WritebackProposal } from "./assistant/writebacks";
