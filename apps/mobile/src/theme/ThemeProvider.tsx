import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { dusk, linen } from "./tokens";
import type { ThemeTokens } from "./tokens";
import { getStoredThemeMode, storeThemeMode } from "./themeStorage";

/**
 * "sky" follows the clock — dusk in the evening and night, linen by day.
 * Users can pin either skin in House Rules; the choice persists via MMKV and
 * is readable before first render, so the theme never flickers.
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => getStoredThemeMode());
  const [hour, setHour] = useState(() => new Date().getHours());

  // Re-check the sky once a minute — cheap, and the hour flip lands within 60s.
  useEffect(() => {
    if (mode !== "sky") return;
    const id = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    storeThemeMode(next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const name = resolveTheme(mode, hour);
    return { theme: name === "dusk" ? dusk : linen, name, mode, setMode };
  }, [mode, hour, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
