import { MemoryVault } from "@wovera/core";
import type { VaultApi } from "@wovera/core";
import { seedExampleVault } from "./seed";

/**
 * Web vault: in-memory until expo-sqlite's web (WASM/OPFS) support graduates
 * from alpha — Phase 7 of the build plan faces that risk deliberately.
 * Same VaultApi, so every screen behaves identically.
 */
export async function openVault(): Promise<VaultApi> {
  const vault = new MemoryVault();
  await seedExampleVault(vault);
  return vault;
}
