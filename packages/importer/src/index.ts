/**
 * @wovera/importer — turns an existing Personal-Command-Center-style vault
 * (Obsidian markdown: journal/, wiki/, crm/, wiki/log.md) into Wovera
 * documents, links, and ledger rows.
 *
 * Contract: the source vault is READ-ONLY. The importer never writes to it.
 * Full parsing lands in Phase 3 of the build plan.
 */
import type { DocumentType } from "@wovera/core";

/** Extracts [[wikilink]] targets from a markdown body. */
export function extractWikilinks(bodyMd: string): string[] {
  const links: string[] = [];
  const pattern = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
  for (const match of bodyMd.matchAll(pattern)) {
    const target = match[1]?.trim();
    if (target) links.push(target);
  }
  return links;
}

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
