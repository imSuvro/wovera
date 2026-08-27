import { MemoryVault } from "@wovera/core";
import type { LedgerKind, VaultApi } from "@wovera/core";
import { seedExampleVault } from "./seed";

interface Snapshot {
  documents: {
    type: "journal" | "wiki" | "person" | "thread";
    title: string;
    bodyMd: string;
    shelf: string | null;
    createdAt?: number;
  }[];
  ledger: { ts: number; kind: LedgerKind; summary: string }[];
}

let vaultPromise: Promise<VaultApi> | null = null;

/**
 * Web vault — the Phase 7 experiment, faced.
 *
 * First choice: REAL SQLite. expo-sqlite's web build runs the engine in a
 * WASM worker with OPFS persistence, and its synchronous API works when
 * COOP/COEP headers grant SharedArrayBuffer (public/serve.json sets them).
 * When that holds, web runs the exact same vault code as the phone —
 * migrations, FTS5, ledger triggers, everything, persistent across reloads.
 *
 * Fallback: the in-memory vault with the dev snapshot, as before — for
 * browsers or hosts where the headers or OPFS aren't available.
 */
export function openVault(): Promise<VaultApi> {
  vaultPromise ??= (async () => {
    try {
      const sqlite = await import("./openVault.native");
      const vault = await sqlite.openVault();
      return vault;
    } catch (err) {
      console.warn("web sqlite unavailable — memory vault fallback:", err);
      return openMemoryVault();
    }
  })();
  return vaultPromise;
}

async function openMemoryVault(): Promise<VaultApi> {
  const vault = new MemoryVault();
  const snapshot = await loadLocalSnapshot();
  if (!snapshot) {
    await seedExampleVault(vault);
    return vault;
  }
  for (const row of snapshot.ledger) {
    await vault.appendLedger(row.kind, row.summary, undefined, row.ts);
  }
  for (const doc of snapshot.documents) {
    await vault.createDocument({
      type: doc.type,
      title: doc.title,
      bodyMd: doc.bodyMd,
      shelf: doc.shelf,
      createdAt: doc.createdAt,
      ledger: { kind: "woven", summary: `Imported: ${doc.title}` },
    });
  }
  return vault;
}

async function loadLocalSnapshot(): Promise<Snapshot | null> {
  try {
    const res = await fetch("/vault-import.local.json");
    if (!res.ok) return null;
    const data = (await res.json()) as Snapshot;
    return Array.isArray(data.documents) ? data : null;
  } catch {
    return null;
  }
}
