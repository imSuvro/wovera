/**
 * @wovera/importer — turns an existing Personal-Command-Center-style vault
 * (Obsidian markdown: journal/, wiki/, crm/, wiki/log.md) into Wovera
 * documents, links, and ledger rows.
 *
 * Contract: the source vault is READ-ONLY. The importer never writes to it.
 * Full parsing lands in Phase 3 of the build plan.
 */
import type { DocumentType } from "@wovera/core";

export { extractWikilinks } from "@wovera/core";
export {
  parseJournalFile,
  parseLog,
  parsePersonFile,
  parseVault,
  parseWikiFile,
  parseWikiIndex,
} from "./parse";
export type {
  ImportParseResult,
  ParsedDocument,
  ParsedLedgerRow,
  SkippedFile,
  VaultFile,
} from "./parse";

/** Maps a vault directory name to the Wovera document type it holds. */
export function documentTypeForVaultDir(dir: string): DocumentType | null {
  switch (dir) {
    case "journal":
      return "journal";
    case "wiki":
      return "wiki";
    case "crm":
      return "person";
    default:
      return null;
  }
}
