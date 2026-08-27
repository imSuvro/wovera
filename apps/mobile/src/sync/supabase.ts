import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

/**
 * The Supabase client — auth + the ciphertext store. Config comes from env;
 * when absent (contributor checkout, no project yet), auth and sync simply
 * stay off and the app runs fully local.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Session storage: browser localStorage on web; MMKV on native. */
function sessionStorage() {
  if (Platform.OS === "web") return undefined; // supabase-js defaults to localStorage
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require("react-native-mmkv") as {
      createMMKV: (c: { id: string }) => {
        getString(k: string): string | undefined;
        set(k: string, v: string): void;
        remove(k: string): void;
      };
    };
    const mmkv = createMMKV({ id: "wovera-auth" });
    return {
      getItem: (k: string) => mmkv.getString(k) ?? null,
      setItem: (k: string, v: string) => {
        mmkv.set(k, v);
      },
      removeItem: (k: string) => {
        mmkv.remove(k);
      },
    };
  } catch {
    return undefined;
  }
}

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, storage: sessionStorage(), autoRefreshToken: true },
      })
    : null;

export const authConfigured = supabase !== null;
