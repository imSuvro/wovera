/**
 * The nightfall wipe — Wovera's signature motion.
 *
 * When the theme changes (by hand, or when the sky itself flips at dawn and
 * dusk), a single horizon line of lamplight sweeps from the top of the screen
 * to the bottom: above the line, the arriving theme; below it, the departing
 * one. Always top-to-bottom — night falls, and morning light pours.
 *
 * Contract: `sweep(apply)` runs the visual transition around `apply()`, which
 * performs the actual theme state change. Implementations must fall back to
 * calling `apply()` directly when animation isn't possible or wanted
 * (reduced motion, mid-sweep re-entry, missing platform support).
 */
export interface SweepAPI {
  sweep(apply: () => void): void;
}

/** Duration of the wipe. One breath — noticeable, never in the way. */
export const SWEEP_MS = 850;

/** The horizon line's lamplight color (same in both directions). */
export const SWEEP_LINE = "#e8b46a";
