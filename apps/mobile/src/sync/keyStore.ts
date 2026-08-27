import { Platform } from "react-native";
import { deriveVaultKey, entropyToHex, hexToEntropy } from "@wovera/core";

/**
 * Where the root entropy lives on this device.
 *
 * Native: expo-secure-store (Android Keystore / iOS Keychain) once the
 * binary carries it; MMKV as the dev-window fallback. Web: localStorage —
 * honest limitation of the platform, documented, acceptable for the vault's
 * threat model (the SERVER being blind is the promise; a device you unlock
 * is trusted).
 */
const ENTROPY_KEY = "wovera.vault_entropy_v1";

interface StoreLike {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
}

function createStore(): StoreLike {
  if (Platform.OS === "web") {
    return {
      get: async () => {
        try {
          return localStorage.getItem(ENTROPY_KEY);
        } catch {
          return null;
        }
      },
      set: async (v) => {
        try {
          localStorage.setItem(ENTROPY_KEY, v);
        } catch {
          // storage unavailable — key lives only in memory this session
        }
      },
    };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const secure = require("expo-secure-store") as {
      getItemAsync(key: string): Promise<string | null>;
      setItemAsync(key: string, value: string): Promise<void>;
    };
    return {
      get: () => secure.getItemAsync(ENTROPY_KEY),
      set: (v) => secure.setItemAsync(ENTROPY_KEY, v),
    };
  } catch {
    // Binary predates expo-secure-store — MMKV bridge until build 4 installs.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require("react-native-mmkv") as {
      createMMKV: (c: { id: string }) => {
        getString(k: string): string | undefined;
        set(k: string, v: string): void;
      };
    };
    const mmkv = createMMKV({ id: "wovera-keys" });
    return {
      get: async () => mmkv.getString(ENTROPY_KEY) ?? null,
      set: async (v) => {
        mmkv.set(ENTROPY_KEY, v);
      },
    };
  }
}

const store = createStore();

export async function loadVaultKey(): Promise<Uint8Array | null> {
  const hex = await store.get();
  if (!hex) return null;
  try {
    return deriveVaultKey(hexToEntropy(hex));
  } catch {
    return null;
  }
}

export async function saveRootEntropy(entropy: Uint8Array): Promise<void> {
  await store.set(entropyToHex(entropy));
}

export async function hasRootEntropy(): Promise<boolean> {
  return (await store.get()) !== null;
}
