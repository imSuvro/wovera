import { forwardRef, useImperativeHandle } from "react";
import type { ReactNode } from "react";
import { SWEEP_LINE, SWEEP_MS } from "./sweep";
import type { SweepAPI } from "./sweep";

const STYLE_ID = "wovera-sweep-style";

/**
 * Web implementation of the nightfall wipe, on the View Transitions API:
 * the browser snapshots old and new frames natively, and a clip-path
 * animation reveals the new theme from the top while the old one waits
 * below the lamplight line (the new snapshot's glowing bottom edge).
 * Browsers without the API — and reduced-motion users — switch instantly.
 */
function ensureSweepStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    ::view-transition-group(root) { animation-duration: ${SWEEP_MS}ms; }
    ::view-transition-old(root) { animation: none; }
    ::view-transition-new(root) {
      animation: wovera-wipe ${SWEEP_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both;
      border-bottom: 2px solid ${SWEEP_LINE};
      box-shadow: 0 8px 34px 2px rgba(224, 164, 88, 0.5);
    }
    @keyframes wovera-wipe {
      from { clip-path: inset(0 0 100% 0); }
      to { clip-path: inset(0 0 0 0); }
    }
    @media (prefers-reduced-motion: reduce) {
      ::view-transition-old(root), ::view-transition-new(root) { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}

export const SweepHost = forwardRef<SweepAPI, { children: ReactNode }>(function SweepHost(
  { children },
  ref,
) {
  useImperativeHandle(ref, () => ({
    sweep(apply: () => void) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (typeof document.startViewTransition !== "function" || reduced) {
        apply();
        return;
      }
      ensureSweepStyles();
      // flushSync makes the theme change land inside the transition's
      // captured update, so the browser diffs old frame vs new frame.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { flushSync } = require("react-dom") as { flushSync: (cb: () => void) => void };
      document.startViewTransition(() => {
        flushSync(apply);
      });
    },
  }));

  return <>{children}</>;
});
