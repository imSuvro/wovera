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

/**
 * Web vault: in-memory until expo-sqlite's web (WASM/OPFS) support graduates
 * from alpha — Phase 7 of the build plan faces that risk deliberately.
 *
 * Dev nicety: if an importer snapshot exists (vault-import.local.json in
 * public/ — gitignored, local machine only), it becomes the vault, so the
 * real thing is browsable in a browser before the phone build exists.
 */
let vaultPromise: Promise<VaultApi> | null = null;

/** Singleton for symmetry with native — survives fast refresh remounts. */
export function openVault(): Promise<VaultApi> {
  vaultPromise ??= openVaultOnce();
  return vaultPromise;
}

async function openVaultOnce(): Promise<VaultApi> {
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
