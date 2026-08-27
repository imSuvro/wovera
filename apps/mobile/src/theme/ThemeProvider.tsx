import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { dusk, linen } from "./tokens";
import type { ThemeTokens } from "./tokens";
import type { SweepAPI } from "./sweep";
import { getStoredThemeMode, storeThemeMode } from "./themeStorage";

/**
 * "sky" follows the clock — dusk in the evening and night, linen by day.
 * Users can pin either skin in House Rules; the choice persists via MMKV and
 * is readable before first render, so the theme never flickers on open.
 *
 * Every change of the *resolved* skin — a tap on the theme tag or the sky
 * itself flipping at dawn/dusk — runs through the nightfall wipe (see
 * sweep.ts). Reduced motion and edge cases fall back to an instant switch.
 */
export type ThemeMode = "sky" | "dusk" | "linen";
export type ThemeName = "dusk" | "linen";

/** Linen from 06:00 to 18:59, dusk otherwise. Deliberately simple for v1. */
export function themeForHour(hour: number): ThemeName {
  return hour >= 6 && hour < 19 ? "linen" : "dusk";
}

export function resolveTheme(mode: ThemeMode, hour: number): ThemeName {
  return mode === "sky" ? themeForHour(hour) : mode;
}

interface ThemeContextValue {
  theme: ThemeTokens;
  name: ThemeName;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  getSweep,
}: {
  children: ReactNode;
  /** Late-bound: the SweepHost mounts inside this provider's subtree. */
  getSweep: () => SweepAPI | null;
}) {
  const [mode, setModeState] = useState<ThemeMode>(() => getStoredThemeMode());
  const [name, setName] = useState<ThemeName>(() =>
    resolveTheme(getStoredThemeMode(), new Date().getHours()),
  );

  const applyChange = useCallback(
    (change: () => void) => {
      const sweep = getSweep();
      if (sweep) sweep.sweep(change);
      else change();
    },
    [getSweep],
  );

  const setMode = useCallback(
    (next: ThemeMode) => {
      storeThemeMode(next);
      const nextName = resolveTheme(next, new Date().getHours());
      setModeState(next);
      if (nextName !== name) applyChange(() => setName(nextName));
    },
    [name, applyChange],
  );

  // The sky flips on its own at 06:00 and 19:00 — same wipe, no tap needed.
  useEffect(() => {
    if (mode !== "sky") return;
    const id = setInterval(() => {
      const skyName = themeForHour(new Date().getHours());
      if (skyName !== name) applyChange(() => setName(skyName));
    }, 30_000);
    return () => clearInterval(id);
  }, [mode, name, applyChange]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: name === "dusk" ? dusk : linen, name, mode, setMode }),
    [name, mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
