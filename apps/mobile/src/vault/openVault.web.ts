import { MemoryVault } from "@wovera/core";
import type { LedgerKind, MemoryVaultState, VaultApi } from "@wovera/core";
import { loadWebVault, persistWebVault } from "./webPersistence";

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

  // What this browser already holds wins: a returning visitor picks up
  // exactly where they left off, even without durable SQLite.
  const kept = await loadWebVault();
  if (kept) {
    vault.restore(kept);
    return watched(vault);
  }

  const snapshot = await loadLocalSnapshot();
  // No snapshot, no examples — a fresh vault starts empty but for the
  // house's welcome letter, which VaultProvider leaves (Plate VIII).
  if (snapshot) {
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
  }
  return watched(vault);
}

/**
 * Every write lands in the browser's own storage a beat later, so a reload
 * — or a closed tab — never costs the keeper their words. The vault stays
 * the plain in-memory one; only its state is mirrored.
 */
function watched(vault: MemoryVault): VaultApi {
  let pending: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = null;
      void persistWebVault(vault.snapshot() as MemoryVaultState);
    }, 250);
  };
  const WRITES = new Set([
    "createDocument",
    "updateDocument",
    "attachReply",
    "appendLedger",
    "setSetting",
    "markOpsPushed",
    "applyRemoteDocument",
  ]);
  return new Proxy(vault, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value !== "function" || typeof prop !== "string") return value;
      const fn = value as (...args: unknown[]) => unknown;
      if (!WRITES.has(prop)) return fn.bind(target);
      return (...args: unknown[]) => {
        const result = fn.apply(target, args);
        if (result instanceof Promise) return result.then((r) => (save(), r));
        save();
        return result;
      };
    },
  }) as unknown as VaultApi;
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
