import { createRecovery, deriveVaultKey, mnemonicToRootEntropy, runSync } from "@wovera/core";
import type { SyncResult } from "@wovera/core";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { hasRootEntropy, loadVaultKey, saveRootEntropy } from "./keyStore";
import { SupabaseTransport } from "./transport";
import { authConfigured, supabase } from "./supabase";
import { useVault } from "../vault/VaultProvider";

/**
 * Orchestrates the account: session state, the vault key's lifecycle
 * (create + show the twelve words once, or restore from them), and sync.
 *
 * status:
 *  off         — no Supabase config; the app runs fully local
 *  loading     — resolving session/key
 *  signedOut   — the gate (product decision: sign-in required)
 *  showPhrase  — fresh key created; the twelve words are on screen ONCE
 *  needsPhrase — account has a remote vault; this device needs the words
 *  ready       — signed in, key present, syncing
 */
export type SyncStatus = "off" | "loading" | "signedOut" | "showPhrase" | "needsPhrase" | "ready";

interface SyncContextValue {
  status: SyncStatus;
  email: string | null;
  mnemonic: string | null;
  error: string | null;
  lastSync: SyncResult | null;
  signIn(email: string, password: string): Promise<string | null>;
  signUp(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
  confirmPhraseSaved(): void;
  restoreFromPhrase(mnemonic: string): Promise<string | null>;
  syncNow(): Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const NO_ACCOUNT_YET =
  "This build can't reach your account yet — everything you keep stays here on this device.";

/**
 * The provider's words never reach the door. Auth failures are translated
 * into the house's voice; anything unrecognized becomes a plain, honest
 * line rather than a raw server string.
 */
function houseVoice(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials"))
    return "That email and password don't open this door. Try again.";
  if (m.includes("already registered") || m.includes("already exists"))
    return "There's already a house at this email — sign in instead.";
  if (m.includes("confirm") && m.includes("email"))
    return "Check your email to confirm the address, then sign in.";
  if (m.includes("rate") || m.includes("too many"))
    return "Too many tries just now — wait a moment and try again.";
  if (m.includes("network") || m.includes("fetch") || m.includes("timeout"))
    return "The house couldn't reach your account just now. Try again in a moment.";
  if (m.includes("password"))
    return "Your password needs eight characters or more — it guards the door.";
  return "That didn't open the door. Try again in a moment — nothing here has been lost.";
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const vault = useVault();
  const [status, setStatus] = useState<SyncStatus>(authConfigured ? "loading" : "off");
  const [email, setEmail] = useState<string | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const keyRef = useRef<Uint8Array | null>(null);
  const syncing = useRef(false);

  const syncNow = useCallback(async () => {
    if (!supabase || !vault || !keyRef.current || syncing.current) return;
    syncing.current = true;
    try {
      const transport = new SupabaseTransport(supabase);
      const result = await runSync(vault, transport, keyRef.current);
      setLastSync(result);
    } catch (err) {
      if (__DEV__) console.warn("sync failed:", err);
    } finally {
      syncing.current = false;
    }
  }, [vault]);

  /** After sign-in: decide between ready / showPhrase / needsPhrase. */
  const resolveKeyState = useCallback(async () => {
    if (!supabase || !vault) return;
    const existing = await loadVaultKey();
    if (existing) {
      keyRef.current = existing;
      setStatus("ready");
      void syncNow();
      return;
    }
    const transport = new SupabaseTransport(supabase);
    if (await transport.hasRemoteOps()) {
      setStatus("needsPhrase"); // existing vault elsewhere — words required
      return;
    }
    try {
      const { entropy, mnemonic: words } = createRecovery();
      await saveRootEntropy(entropy);
      keyRef.current = deriveVaultKey(entropy);
      setMnemonic(words);
      setStatus("showPhrase"); // shown once; confirm → ready + first upload
    } catch {
      setError(
        "This build can't cut your twelve words yet. Everything you keep stays safe on this device until it can.",
      );
      setStatus("ready"); // signed in, local-only until the new build
    }
  }, [vault, syncNow]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setEmail(data.session?.user.email ?? null);
      if (data.session) void resolveKeyState();
      else setStatus("signedOut");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      if (session) void resolveKeyState();
      else setStatus("signedOut");
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [resolveKeyState]);

  const signIn = useCallback(async (mail: string, password: string) => {
    if (!supabase) return NO_ACCOUNT_YET;
    const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password });
    return err ? houseVoice(err.message) : null;
  }, []);

  const signUp = useCallback(async (mail: string, password: string) => {
    if (!supabase) return NO_ACCOUNT_YET;
    const { error: err } = await supabase.auth.signUp({ email: mail, password });
    return err ? houseVoice(err.message) : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const confirmPhraseSaved = useCallback(() => {
    setMnemonic(null);
    setStatus("ready");
    void syncNow(); // first upload: the local vault becomes the account's vault
  }, [syncNow]);

  const restoreFromPhrase = useCallback(
    async (words: string) => {
      const entropy = mnemonicToRootEntropy(words);
      if (!entropy)
        return "Those aren't the twelve words — check the spelling and the order, then try again.";
      await saveRootEntropy(entropy);
      keyRef.current = deriveVaultKey(entropy);
      setStatus("ready");
      await syncNow();
      // Wrong words decrypt nothing: surface it honestly.
      if ((await hasRootEntropy()) && lastSync && lastSync.undecryptable > 0) {
        return "Those words don't open this vault — nothing came through with them. Check the order and try again; nothing here has been lost.";
      }
      return null;
    },
    [syncNow, lastSync],
  );

  return (
    <SyncContext.Provider
      value={{
        status,
        email,
        mnemonic,
        error,
        lastSync,
        signIn,
        signUp,
        signOut,
        confirmPhraseSaved,
        restoreFromPhrase,
        syncNow,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used inside SyncProvider");
  return ctx;
}
