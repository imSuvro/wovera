import { SqliteVault, runMigrations } from "@wovera/core";
import type { VaultApi, VaultDb } from "@wovera/core";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import { Platform } from "react-native";
import { newUlid as ulid } from "@wovera/core";
import { seedExampleVault } from "./seed";

/** Same-origin on web (served beside the app); USB bridge on device. */
const SNAPSHOT_URL =
  Platform.OS === "web"
    ? "/vault-import.local.json"
    : "http://localhost:8317/vault-import.local.json";

/**
 * Native vault: expo-sqlite in WAL mode, core migrations, a persistent
 * device id for the HLC, and example seed on first open.
 */
/**
 * Singleton: fast refresh remounts the provider on every save, and each
 * remount used to open ANOTHER native connection — stacked handles
 * eventually NPE inside expo-sqlite. One open per JS runtime, reused.
 */
let vaultPromise: Promise<VaultApi> | null = null;

export function openVault(): Promise<VaultApi> {
  if (!vaultPromise) {
    vaultPromise = openVaultOnce().catch(async (err) => {
      // One retry on a fresh handle — the native layer can be mid-teardown
      // right after a reload. A second failure is real; surface it.
      if (__DEV__) console.warn("vault open retrying after:", err);
      await new Promise((r) => setTimeout(r, 300));
      return openVaultOnce();
    });
    vaultPromise.catch(() => {
      vaultPromise = null; // allow a later attempt instead of caching failure
    });
  }
  return vaultPromise;
}

async function openVaultOnce(): Promise<VaultApi> {
  // No options: enableChangeListener spins up native machinery we don't use
  // yet, and was implicated in initSync NPEs on Android dev-client reloads.
  const raw = openDatabaseSync("wovera.db");
  try {
    raw.execSync("PRAGMA journal_mode = WAL;");
  } catch {
    // OPFS on web manages its own journaling; WAL is a native nicety.
  }
  await runMigrations({
    exec: (sql) => raw.execSync(sql),
    getUserVersion: () =>
      raw.getFirstSync<{ user_version: number }>("PRAGMA user_version")?.user_version ?? 0,
    setUserVersion: (v) => raw.execSync(`PRAGMA user_version = ${v}`),
  });
  let deviceId = raw.getFirstSync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'device_id'",
  )?.value;
  if (!deviceId) {
    deviceId = ulid();
    raw.runSync("INSERT INTO settings (key, value) VALUES ('device_id', ?)", [deviceId]);
  }
  const vault = new SqliteVault(drizzle(raw) as unknown as VaultDb, deviceId);
  if ((await vault.countDocuments()) === 0) {
    if (!(__DEV__ && (await loadDevSnapshot(vault)))) await seedExampleVault(vault);
  }
  if (__DEV__)
    console.log(`vault ready (${Platform.OS}-sqlite): ${await vault.countDocuments()} documents`);
  return vault;
}

/**
 * Dev-only: on first open, try the importer snapshot served by the local
 * static server (reachable over USB via `adb reverse tcp:8317 tcp:8317`).
 * Real users never hit this path; production first-open seeds examples.
 */
async function loadDevSnapshot(vault: SqliteVault): Promise<boolean> {
  try {
    const res = await fetch(SNAPSHOT_URL);
    if (!res.ok) return false;
    const data = (await res.json()) as {
      documents: {
        type: "journal" | "wiki" | "person" | "thread";
        title: string;
        bodyMd: string;
        shelf: string | null;
        createdAt?: number;
      }[];
      ledger: {
        ts: number;
        kind: "journal" | "held" | "woven" | "tidy" | "rule";
        summary: string;
      }[];
    };
    if (!Array.isArray(data.documents)) return false;
    for (const row of data.ledger)
      await vault.appendLedger(row.kind, row.summary, undefined, row.ts);
    for (const doc of data.documents) {
      await vault.createDocument({
        type: doc.type,
        title: doc.title,
        bodyMd: doc.bodyMd,
        shelf: doc.shelf,
        createdAt: doc.createdAt,
        ledger: { kind: "woven", summary: `Imported: ${doc.title}` },
      });
    }
    return true;
  } catch {
    return false;
  }
}
