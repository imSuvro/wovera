import type { VaultApi } from "../vault";
import type { VaultDocument } from "../index";

/**
 * Quick capture routing — "one capture stream, four destinations."
 *
 * The user puts something down; the assistant decides where it belongs and
 * SHOWS its filing (the chip in the UI + a ledger row). No new machinery:
 * a reminder is a thread with a clock, a person is a person page, a loose
 * note is a thread without a clock.
 */

export interface RouteResult {
  kind: "reminder" | "person" | "note" | "question";
  /** Short display title for the routed item. */
  title: string;
  /** Local time "YYYY-MM-DD HH:mm" for reminders; null otherwise. */
  remindAtLocal: string | null;
  /** The person's name, for person captures. */
  personName: string | null;
}

/** Parses the model's routing JSON. Malformed → a safe plain note. */
export function parseRouteResult(raw: string, fallbackTitle: string): RouteResult {
  const safe: RouteResult = {
    kind: "note",
    title: fallbackTitle.slice(0, 60),
    remindAtLocal: null,
    personName: null,
  };
  try {
    const cleaned = raw.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "");
    const p = JSON.parse(cleaned) as Record<string, unknown>;
    const kind =
      p.kind === "reminder" || p.kind === "person" || p.kind === "note" || p.kind === "question"
        ? p.kind
        : "note";
    const title =
      typeof p.title === "string" && p.title.trim() ? p.title.trim().slice(0, 60) : safe.title;
    const remindAtLocal =
      kind === "reminder" &&
      typeof p.remindAtLocal === "string" &&
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(p.remindAtLocal.trim())
        ? p.remindAtLocal.trim()
        : null;
    const personName =
      kind === "person" && typeof p.personName === "string" && p.personName.trim()
        ? p.personName.trim().slice(0, 60)
        : null;
    // A reminder without a parseable time degrades honestly to a note.
    if (kind === "reminder" && !remindAtLocal) return { ...safe, title };
    if (kind === "person" && !personName) return { ...safe, title };
    return { kind, title, remindAtLocal, personName };
  } catch {
    return safe;
  }
}

const INTERROGATIVE_OPENERS = [
  "what",
  "why",
  "how",
  "when",
  "where",
  "who",
  "whom",
  "whose",
  "which",
  "can",
  "could",
  "should",
  "would",
  "will",
  "is",
  "are",
  "was",
  "were",
  "do",
  "does",
  "did",
  "am",
  "have",
  "has",
  "had",
];

const OPENER_RE = new RegExp(`^(?:${INTERROGATIVE_OPENERS.join("|")})\\b`, "i");

/**
 * Heuristic for the Shelves field: does this capture read as a question
 * addressed to the assistant rather than something to keep?
 * True when the trimmed text ends with "?" or starts with an interrogative
 * opener (word-boundary, case-insensitive — "whatever" does not count).
 */
export function isQuestionShaped(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.endsWith("?")) return true;
  return OPENER_RE.test(trimmed);
}

/** "YYYY-MM-DD HH:mm" in the device's local time → ms epoch. */
export function localStampToMs(stamp: string): number {
  const [date, time] = stamp.split(" ");
  const [y, m, d] = (date ?? "").split("-").map(Number);
  const [hh, mm] = (time ?? "").split(":").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0).getTime();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function clockLabel(ms: number): string {
  const d = new Date(ms);
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${h12}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`;
}

export interface AppliedRoute {
  doc: VaultDocument;
  kind: RouteResult["kind"];
  /** Human label for the chip: where it went. */
  chip: string;
  remindAtMs: number | null;
}

/** Files the capture where the route says, ledgering the filing. */
export async function applyRoute(
  vault: VaultApi,
  captureText: string,
  route: RouteResult,
  now = Date.now(),
): Promise<AppliedRoute> {
  if (route.kind === "reminder" && route.remindAtLocal) {
    const remindAtMs = localStampToMs(route.remindAtLocal);
    const doc = await vault.createDocument({
      type: "thread",
      title: route.title,
      bodyMd: captureText,
      remindAt: remindAtMs,
      ledger: { kind: "held", summary: `Held with a clock — ${route.title}` },
    });
    return {
      doc,
      kind: "reminder",
      chip: `Held with a clock — ${clockLabel(remindAtMs)}`,
      remindAtMs,
    };
  }

  if (route.kind === "person" && route.personName) {
    const existing = await vault.getDocumentByTitle(route.personName);
    if (existing && existing.type === "person") {
      const section = `\n\n## ${clockLabel(now)}\n\n${captureText}`;
      await vault.updateDocument(existing.ulid, { bodyMd: existing.bodyMd + section });
      await vault.appendLedger(
        "held",
        `${existing.title} — noted from quick capture`,
        existing.ulid,
        now,
        JSON.stringify({ prevBodyMd: existing.bodyMd }),
      );
      return {
        doc: existing,
        kind: "person",
        chip: `Noted on ${existing.title} · People`,
        remindAtMs: null,
      };
    }
    const doc = await vault.createDocument({
      type: "person",
      title: route.personName,
      bodyMd: captureText,
      shelf: "People",
      ledger: { kind: "held", summary: `New person — ${route.personName}` },
    });
    return { doc, kind: "person", chip: `New person — ${doc.title} · People`, remindAtMs: null };
  }

  // Everything else — plain notes, degraded reminders/persons, and (defensively)
  // "question" routes the UI didn't intercept — files as a note. Never throws.
  const doc = await vault.createDocument({
    type: "thread",
    title: route.title,
    bodyMd: captureText,
    ledger: { kind: "held", summary: `Thread held — ${route.title}` },
  });
  return { doc, kind: "note", chip: "Held as a thread", remindAtMs: null };
}

/** Open threads for Today, soonest clock first, clockless after. */
export async function listThreads(vault: VaultApi, limit = 6): Promise<VaultDocument[]> {
  const threads = await vault.listByType("thread", 50);
  return threads
    .sort((a, b) => {
      const ar = a.remindAt ?? Number.MAX_SAFE_INTEGER;
      const br = b.remindAt ?? Number.MAX_SAFE_INTEGER;
      return ar - br || b.updatedAt - a.updatedAt;
    })
    .slice(0, limit);
}
