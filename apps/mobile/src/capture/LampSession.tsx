import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

/**
 * The Lamp's three acts, visible to the whole house (Pattern Book, Plate IV).
 * The screen drives the phase; the tab bar reads it to recede while the
 * room listens. (The live mic level stays inside the Lamp room — the
 * flicker is the room's own affair.)
 */
export type LampPhase = "idle" | "listening" | "kept";

interface LampSessionValue {
  phase: LampPhase;
  setPhase(phase: LampPhase): void;
}

const LampSessionContext = createContext<LampSessionValue | null>(null);

export function LampSessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<LampPhase>("idle");
  return (
    <LampSessionContext.Provider value={{ phase, setPhase }}>
      {children}
    </LampSessionContext.Provider>
  );
}

export function useLampSession(): LampSessionValue {
  const ctx = useContext(LampSessionContext);
  if (!ctx) throw new Error("useLampSession must be used inside LampSessionProvider");
  return ctx;
}
