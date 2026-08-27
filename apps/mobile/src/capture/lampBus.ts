/**
 * One quiet wire between the NavLamp (in the tab bar) and the Lamp room:
 * tapping the lamp while already inside the room means "start talking".
 * A module-level bus keeps this out of navigation params — the bar and the
 * room live in different parts of the navigator tree.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

/** The Lamp room listens; returns the unsubscribe. */
export function onLampTap(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The NavLamp announces a tap that happened while the room was already open. */
export function emitLampTap(): void {
  for (const listener of [...listeners]) listener();
}
