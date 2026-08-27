import { SqliteVault, runMigrations } from "@wovera/core";
import type { VaultApi, VaultDb } from "@wovera/core";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import { ulid } from "ulidx";
import { seedExampleVault } from "./seed";

/**
 * Native vault: expo-sqlite in WAL mode, core migrations, a persistent
 * device id for the HLC, and example seed on first open.
 */
export async function openVault(): Promise<VaultApi> {
  const raw = openDatabaseSync("wovera.db", { enableChangeListener: true });
  raw.execSync("PRAGMA journal_mode = WAL;");
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
  if ((await vault.countDocuments()) === 0) await seedExampleVault(vault);
  return vault;
}
