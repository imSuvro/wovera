/**
 * Hybrid Logical Clock — the ordering heart of the sync protocol.
 *
 * Every mutation gets an HLC stamp. Stamps are totally ordered (physical time,
 * then a counter for same-millisecond events, then device id as tiebreaker),
 * encode to sortable strings, and merge safely with stamps from other devices
 * even when wall clocks disagree. Last-write-wins per document compares these.
 */
export interface Hlc {
  /** Physical time in ms since epoch (the max seen, not necessarily "now"). */
  ms: number;
  /** Counter for events sharing the same millisecond. */
  count: number;
  /** Device id — final tiebreaker so two devices never produce equal stamps. */
  device: string;
}

/** 15 digits of ms (safe until year 33658), 5 base-36 digits of counter. */
export function encodeHlc(hlc: Hlc): string {
  const ms = hlc.ms.toString().padStart(15, "0");
  const count = hlc.count.toString(36).padStart(5, "0");
  return `${ms}-${count}-${hlc.device}`;
}

export function decodeHlc(encoded: string): Hlc {
  const [ms, count, ...device] = encoded.split("-");
  if (!ms || !count || device.length === 0) throw new Error(`Malformed HLC: ${encoded}`);
  return { ms: Number(ms), count: parseInt(count, 36), device: device.join("-") };
}

/** Advance the local clock for a new local event. */
export function hlcNext(prev: Hlc, nowMs: number): Hlc {
  if (nowMs > prev.ms) return { ms: nowMs, count: 0, device: prev.device };
  return { ms: prev.ms, count: prev.count + 1, device: prev.device };
}

/** Merge a stamp received from another device into the local clock. */
export function hlcMerge(local: Hlc, remote: Hlc, nowMs: number): Hlc {
  const ms = Math.max(local.ms, remote.ms, nowMs);
  let count: number;
  if (ms === local.ms && ms === remote.ms) count = Math.max(local.count, remote.count) + 1;
  else if (ms === local.ms) count = local.count + 1;
  else if (ms === remote.ms) count = remote.count + 1;
  else count = 0;
  return { ms, count, device: local.device };
}
