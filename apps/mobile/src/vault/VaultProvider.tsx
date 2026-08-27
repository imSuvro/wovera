import { ensureWelcomeLetter } from "@wovera/core";
import type { VaultApi } from "@wovera/core";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { openVault } from "./openVault";

/**
 * Owns the app's vault instance.
 *
 * The implementation is platform-split (openVault.native / openVault.web) so
 * the web bundle never touches the native SQLite module. Opening is async but
 * fast; screens render from `vault === null` (a quiet beat, no spinner) to
 * ready.
 */
const VaultContext = createContext<VaultApi | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vault, setVault] = useState<VaultApi | null>(null);
  useEffect(() => {
    let cancelled = false;
    openVault().then(
      async (v) => {
        // The house leaves its letter before anyone walks in (create-once).
        await ensureWelcomeLetter(v).catch(() => undefined);
        if (!cancelled) setVault(v);
      },
      (err) => console.error("vault open failed", err),
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return <VaultContext.Provider value={vault}>{children}</VaultContext.Provider>;
}

/** Null while the vault is opening — screens render their quiet beat. */
export function useVault(): VaultApi | null {
  return useContext(VaultContext);
}
