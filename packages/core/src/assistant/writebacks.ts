import type { LedgerEntry, VaultApi } from "../vault";
import type { VaultDocument } from "../index";

/**
 * The writeback ritual — "Held for you."
 *
 * After a reply, the assistant may propose weaving durable self-knowledge
 * from the entry into the wiki. The rules that keep it trustworthy:
 * - existing page text is NEVER rewritten: writebacks append a dated,
 *   provenance-linked section
 * - every writeback lands in the Ledger with a restore payload — one tap
 *   in the Ledger puts the page back exactly as it was
 * - at most two writebacks per entry; quiet beats busy
 */

export interface WritebackProposal {
  action: "update" | "create";
  pageTitle: string;
  /** Shelf for created pages (ignored on update). */
  shelf?: string;
  /** Markdown to hold — appended (update) or the new page's opening (create). */
  addition: string;
  reason: string;
}

export interface AppliedWriteback {
  ulid: string;
  title: string;
  created: boolean;
}

export const MAX_WRITEBACKS = 2;

/** Parses the model's JSON output into validated proposals. Bad shape → []. */
export function parseWritebackProposals(raw: string): WritebackProposal[] {
  try {
    const cleaned = raw.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "");
    const data: unknown = JSON.parse(cleaned);
    const list = Array.isArray(data)
      ? data
      : typeof data === "object" &&
          data !== null &&
          Array.isArray((data as { writebacks?: unknown[] }).writebacks)
        ? (data as { writebacks: unknown[] }).writebacks
        : [];
    const out: WritebackProposal[] = [];
    for (const item of list) {
      if (typeof item !== "object" || item === null) continue;
      const p = item as Record<string, unknown>;
      const action = p.action === "create" ? "create" : p.action === "update" ? "update" : null;
      if (!action) continue;
      if (typeof p.pageTitle !== "string" || !p.pageTitle.trim()) continue;
      if (typeof p.addition !== "string" || p.addition.trim().length < 10) continue;
      out.push({
        action,
        pageTitle: p.pageTitle.trim().slice(0, 80),
        shelf: typeof p.shelf === "string" && p.shelf.trim() ? p.shelf.trim() : undefined,
        addition: p.addition.trim(),
        reason: typeof p.reason === "string" ? p.reason.trim() : "",
      });
      if (out.length >= MAX_WRITEBACKS) break;
    }
    return out;
  } catch {
    return [];
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dateLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Applies one proposal. Returns null if it can't be applied safely. */
export async function applyWriteback(
  vault: VaultApi,
  proposal: WritebackProposal,
  entry: { ulid: string; title: string },
  now = Date.now(),
): Promise<AppliedWriteback | null> {
  const section = `\n\n## Held from [[${entry.title}]] · ${dateLabel(now)}\n\n${proposal.addition}`;

  if (proposal.action === "update") {
    const page = await vault.getDocumentByTitle(proposal.pageTitle);
    if (!page || page.type === "journal") return null;
    const restore = JSON.stringify({ prevBodyMd: page.bodyMd });
    await vault.updateDocument(page.ulid, { bodyMd: page.bodyMd + section });
    await vault.appendLedger(
      "held",
      `${page.title} — held from ${entry.title}`,
      page.ulid,
      now,
      restore,
    );
    return { ulid: page.ulid, title: page.title, created: false };
  }

  // create — but never shadow an existing page by the same title.
  if (await vault.getDocumentByTitle(proposal.pageTitle)) return null;
  const body = `${proposal.addition}\n\n_First held from [[${entry.title}]] · ${dateLabel(now)}._`;
  const doc = await vault.createDocument({
    type: "wiki",
    title: proposal.pageTitle,
    bodyMd: body,
    shelf: proposal.shelf ?? "Personal Operating Knowledge",
    ledger: { kind: "held", summary: `New page — ${proposal.pageTitle}, from ${entry.title}` },
  });
  return { ulid: doc.ulid, title: doc.title, created: true };
}

/** Restores a page to its pre-writeback body, from a Ledger row's payload. */
export async function restoreFromLedger(
  vault: VaultApi,
  row: LedgerEntry,
): Promise<VaultDocument | null> {
  if (!row.docUlid || !row.diffRef) return null;
  try {
    const { prevBodyMd } = JSON.parse(row.diffRef) as { prevBodyMd?: string };
    if (typeof prevBodyMd !== "string") return null;
    const doc = await vault.getDocument(row.docUlid);
    if (!doc) return null;
    const restored = await vault.updateDocument(row.docUlid, { bodyMd: prevBodyMd });
    await vault.appendLedger("tidy", `Restored ${doc.title} to before "${row.summary}"`, doc.ulid);
    return restored;
  } catch {
    return null;
  }
}
