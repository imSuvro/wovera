import type { ThemeMode } from "./ThemeProvider";

const KEY = "wovera.themeMode";

/**
 * MMKV gives a synchronous read before first render — the reason the theme
 * never flickers on open. It is a native module (and localStorage-backed on
 * web); if it ever fails to load (e.g. an unsupported preview context), we
 * degrade to in-memory so the app still opens.
 */
interface KVLike {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
}

function createStorage(): KVLike {
  try {
    // Lazy require so a platform without the native module degrades gracefully.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mmkv = require("react-native-mmkv") as {
      createMMKV: (config: { id: string }) => KVLike;
    };
    return mmkv.createMMKV({ id: "wovera-prefs" });
  } catch {
    const mem = new Map<string, string>();
    return {
      getString: (k) => mem.get(k),
      set: (k, v) => {
        mem.set(k, v);
      },
    };
  }
}

const storage = createStorage();

export function getStoredThemeMode(): ThemeMode {
  const raw = storage.getString(KEY);
  return raw === "dusk" || raw === "linen" || raw === "sky" ? raw : "sky";
}

export function storeThemeMode(mode: ThemeMode): void {
  storage.set(KEY, mode);
}
