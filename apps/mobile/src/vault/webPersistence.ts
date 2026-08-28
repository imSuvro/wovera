import type { MemoryVaultState } from "@wovera/core";

/**
 * The browser's own cupboard.
 *
 * Until expo-sqlite's OPFS build is dependable, the web app runs the plain
 * in-memory vault — which would lose everything on reload. This keeps that
 * vault's state in IndexedDB (large, structured-clone, no string limits),
 * so a returning visitor finds the house exactly as they left it. It is
 * local to this browser and never leaves it; the phone remains the vault
 * of record until sync switches on.
 */

const DB_NAME = "wovera-web-vault";
const STORE = "vault";
const KEY = "state";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch {
      return resolve(null); // private mode, blocked storage
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

/** The vault this browser already holds, or null for a first visit. */
export async function loadWebVault(): Promise<MemoryVaultState | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      req.onsuccess = () => {
        const value = req.result as MemoryVaultState | undefined;
        resolve(value && value.version === 1 ? value : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    } finally {
      // The handle is cheap to reopen; holding it blocks version upgrades.
      setTimeout(() => db.close(), 0);
    }
  });
}

/** Mirrors the vault into the browser. Failure is silent by design: the
 *  in-memory vault is still whole, and nothing the keeper did is lost now. */
export async function persistWebVault(state: MemoryVaultState): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(state, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}
