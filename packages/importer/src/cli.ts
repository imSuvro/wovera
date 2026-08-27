/**
 * Importer CLI.
 *
 *   pnpm import --vault "C:\path\to\vault" --dry-run
 *   pnpm import --vault "C:\path\to\vault" --json apps/mobile/public/vault-import.local.json
 *
 * READ-ONLY against the source vault, always. `--json` writes a local
 * snapshot (gitignored — never commit vault content to the public repo).
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { parseVault } from "./parse";
import type { VaultFile } from "./parse";

const SKIP_DIRS = new Set([".git", ".obsidian", ".agents", "node_modules"]);
/** Only the skeleton is imported; raw/ stays where it lives (immutable source). */
const IMPORT_DIRS = new Set(["journal", "wiki", "crm"]);

function collectFiles(root: string): VaultFile[] {
  const files: VaultFile[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = relative(root, full).replace(/\\/g, "/");
      const top = rel.split("/")[0] ?? "";
      if (statSync(full).isDirectory()) {
        if (!SKIP_DIRS.has(name) && IMPORT_DIRS.has(top)) walk(full);
        else if (rel === top && IMPORT_DIRS.has(top)) walk(full);
        continue;
      }
      if (IMPORT_DIRS.has(top) && rel.toLowerCase().endsWith(".md")) {
        files.push({ path: rel, content: readFileSync(full, "utf8") });
      }
    }
  };
  for (const top of readdirSync(root)) {
    if (IMPORT_DIRS.has(top) && statSync(join(root, top)).isDirectory()) walk(join(root, top));
  }
  return files;
}

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

const vaultPath = arg("vault");
if (!vaultPath) {
  console.error('Usage: pnpm import --vault "C:\\path\\to\\vault" [--dry-run] [--json out.json]');
  process.exit(1);
}

const files = collectFiles(vaultPath);
const result = parseVault(files);

console.log("\n— Wovera vault import (read-only) —\n");
console.log(`  files scanned:   ${files.length}`);
console.log(`  journal entries: ${result.report.journal}`);
console.log(`  wiki pages:      ${result.report.wiki} (${result.report.shelved} shelved)`);
console.log(`  people:          ${result.report.person}`);
console.log(`  ledger rows:     ${result.report.ledgerRows}`);
console.log(`  skipped:         ${result.report.skipped}`);
if (result.skipped.length > 0) {
  console.log("\n  skipped detail:");
  for (const s of result.skipped) console.log(`    - ${s.path} (${s.reason})`);
}

const shelfCounts = new Map<string, number>();
for (const d of result.documents) {
  if (d.shelf) shelfCounts.set(d.shelf, (shelfCounts.get(d.shelf) ?? 0) + 1);
}
console.log("\n  shelves:");
for (const [shelf, count] of [...shelfCounts.entries()].sort()) {
  console.log(`    ${shelf}: ${count}`);
}

const jsonOut = arg("json");
if (jsonOut && !process.argv.includes("--dry-run")) {
  mkdirSync(dirname(jsonOut), { recursive: true });
  writeFileSync(
    jsonOut,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), documents: result.documents, ledger: result.ledger },
      null,
      2,
    ),
  );
  console.log(`\n  snapshot written: ${jsonOut} (local only — gitignored)`);
}
console.log("");
