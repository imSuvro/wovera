import type { DocumentType, LedgerKind } from "@wovera/core";

/**
 * Pure parsing for a Personal-Command-Center-style Obsidian vault.
 * Everything here takes (path, content) pairs — no filesystem — so the
 * whole pipeline is unit-testable and the CLI stays a thin shell.
 *
 * Contract: journal bodies are VERBATIM — the whole file, untouched.
 */

export interface VaultFile {
  /** Path relative to the vault root, forward slashes. */
  path: string;
  content: string;
}

export interface ParsedDocument {
  type: DocumentType;
  title: string;
  bodyMd: string;
  shelf: string | null;
  createdAt?: number;
  sourcePath: string;
}

export interface ParsedLedgerRow {
  ts: number;
  kind: LedgerKind;
  summary: string;
}

export interface SkippedFile {
  path: string;
  reason: string;
}

export interface ImportParseResult {
  documents: ParsedDocument[];
  ledger: ParsedLedgerRow[];
  skipped: SkippedFile[];
  report: {
    journal: number;
    wiki: number;
    person: number;
    ledgerRows: number;
    shelved: number;
    skipped: number;
  };
}

/** Maps the source vault's log kinds to Wovera's ledger vocabulary. */
const LOG_KIND_MAP: Record<string, LedgerKind> = {
  journal: "journal",
  ingest: "woven",
  query: "held",
  crm: "held",
  lint: "tidy",
  setup: "rule",
};

function dateToMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  // Noon local time: immune to timezone edge-flips either side of midnight.
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12).getTime();
}

function fileTitle(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.md$/i, "");
}

const JOURNAL_NAME = /^(\d{4}-\d{2}-\d{2})\s+(.+)\.md$/i;

export function parseJournalFile(path: string, content: string): ParsedDocument | null {
  const base = path.split("/").pop() ?? "";
  const match = JOURNAL_NAME.exec(base);
  if (!match) return null;
  const [, date, title] = match;
  return {
    type: "journal",
    title: title ?? fileTitle(path),
    bodyMd: content, // verbatim — the whole file
    shelf: null,
    createdAt: dateToMs(date ?? "1970-01-01"),
    sourcePath: path,
  };
}

const INDEX_HEADING = /^##\s+(.+?)\s*$/;
const INDEX_ENTRY = /^-\s*\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/;

/**
 * Reads wiki/index.md: its `##` sections become shelves, and each listed
 * page is assigned to the section it sits under.
 */
export function parseWikiIndex(content: string): Map<string, string> {
  const shelves = new Map<string, string>();
  let currentShelf: string | null = null;
  for (const line of content.split(/\r?\n/)) {
    const heading = INDEX_HEADING.exec(line);
    if (heading?.[1]) {
      currentShelf = heading[1];
      continue;
    }
    if (!currentShelf) continue;
    const entry = INDEX_ENTRY.exec(line.trim());
    const target = entry?.[1]?.trim();
    if (!target) continue;
    const title = target.replace(/^wiki\//i, "").trim();
    if (title) shelves.set(title.toLowerCase(), currentShelf);
  }
  return shelves;
}

export function parseWikiFile(
  path: string,
  content: string,
  shelves: Map<string, string>,
): ParsedDocument {
  const title = fileTitle(path);
  return {
    type: "wiki",
    title,
    bodyMd: content,
    shelf: shelves.get(title.toLowerCase()) ?? null,
    sourcePath: path,
  };
}

export function parsePersonFile(path: string, content: string): ParsedDocument {
  return {
    type: "person",
    title: fileTitle(path),
    bodyMd: content,
    shelf: "People",
    sourcePath: path,
  };
}

const LOG_ENTRY = /^##\s*\[(\d{4}-\d{2}-\d{2})\]\s*([\w-]+)\s*\|\s*(.+?)\s*$/;

export function parseLog(content: string): ParsedLedgerRow[] {
  const rows: ParsedLedgerRow[] = [];
  for (const line of content.split(/\r?\n/)) {
    const match = LOG_ENTRY.exec(line.trim());
    if (!match) continue;
    const [, date, kind, title] = match;
    rows.push({
      ts: dateToMs(date ?? "1970-01-01"),
      kind: LOG_KIND_MAP[(kind ?? "").toLowerCase()] ?? "tidy",
      summary: title ?? "",
    });
  }
  return rows;
}

/** Parses a whole vault snapshot (list of files) into documents + ledger. */
export function parseVault(files: VaultFile[]): ImportParseResult {
  const documents: ParsedDocument[] = [];
  const ledger: ParsedLedgerRow[] = [];
  const skipped: SkippedFile[] = [];

  const indexFile = files.find((f) => f.path.toLowerCase() === "wiki/index.md");
  const shelves = indexFile ? parseWikiIndex(indexFile.content) : new Map<string, string>();

  for (const file of files) {
    const path = file.path.replace(/\\/g, "/");
    const lower = path.toLowerCase();
    const [dir] = lower.split("/");

    if (!lower.endsWith(".md")) {
      skipped.push({ path, reason: "not markdown" });
      continue;
    }
    if (lower === "wiki/index.md" || lower === "journal/index.md" || lower === "crm/index.md") {
      skipped.push({ path, reason: "index file (derived data — shelves carry it)" });
      continue;
    }
    if (lower === "wiki/log.md" || lower === "log.md") {
      ledger.push(...parseLog(file.content));
      continue;
    }

    switch (dir) {
      case "journal": {
        const doc = parseJournalFile(path, file.content);
        if (doc) documents.push(doc);
        else skipped.push({ path, reason: "journal filename not 'YYYY-MM-DD Title.md'" });
        break;
      }
      case "wiki":
        documents.push(parseWikiFile(path, file.content, shelves));
        break;
      case "crm":
        documents.push(parsePersonFile(path, file.content));
        break;
      default:
        skipped.push({ path, reason: `outside the skeleton (${dir ?? "root"}/)` });
    }
  }

  ledger.sort((a, b) => a.ts - b.ts);

  return {
    documents,
    ledger,
    skipped,
    report: {
      journal: documents.filter((d) => d.type === "journal").length,
      wiki: documents.filter((d) => d.type === "wiki").length,
      person: documents.filter((d) => d.type === "person").length,
      ledgerRows: ledger.length,
      shelved: documents.filter((d) => d.shelf !== null).length,
      skipped: skipped.length,
    },
  };
}
