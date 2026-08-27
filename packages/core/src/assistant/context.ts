import type { VaultApi } from "../vault";

/**
 * Context assembly — the vault's original Query rule as code:
 * read the indexes first, then the relevant pages, then recent entries.
 * The reply is grounded in what the vault actually holds, and every page
 * offered to the model is returned as a source for citation chips.
 */

const STOPWORDS = new Set(
  (
    "a an and are as at be been but by for from had has have i if in into is it its " +
    "me my not of on or our so that the their then there they this to was we were what " +
    "when which will with you your am do did don't its it's just like really very much " +
    "going get got know think thing things today yesterday tomorrow day days now going want"
  ).split(" "),
);

/** The most telling words of an entry — what we search the shelves with. */
export function significantTerms(text: string, limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9₹']+/)) {
    const word = raw.replace(/^'+|'+$/g, "");
    if (word.length < 4 || STOPWORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

export interface ReplyContext {
  /** The pages the model was grounded in — become the citation chips. */
  sources: { ulid: string; title: string }[];
  /** Ready-to-send user prompt (entry + grounded material). */
  userPrompt: string;
}

const PAGE_CHARS = 1400;
const RECENT_CHARS = 900;

export async function buildReplyContext(
  vault: VaultApi,
  entry: { ulid: string; bodyMd: string },
): Promise<ReplyContext> {
  const terms = significantTerms(entry.bodyMd);
  const seen = new Map<string, { ulid: string; title: string; body: string }>();

  // Relevant pages: search the vault with the entry's own words.
  for (const term of terms) {
    for (const hit of await vault.search(term, 3)) {
      if (hit.ulid === entry.ulid || seen.has(hit.ulid) || hit.type === "journal") continue;
      const doc = await vault.getDocument(hit.ulid);
      if (doc) seen.set(hit.ulid, { ulid: doc.ulid, title: doc.title, body: doc.bodyMd });
      if (seen.size >= 4) break;
    }
    if (seen.size >= 4) break;
  }

  // Recent life: the two entries before this one.
  const recent = (await vault.listByType("journal", 3)).filter((d) => d.ulid !== entry.ulid);

  const shelves = await vault.listShelves();
  const parts: string[] = [];
  parts.push(
    "THE VAULT'S SHELVES (titles only):\n" +
      shelves.map((s) => `- ${s.shelf} (${s.count} pages)`).join("\n"),
  );
  for (const page of seen.values()) {
    parts.push(`PAGE "${page.title}":\n${page.body.slice(0, PAGE_CHARS)}`);
  }
  for (const doc of recent.slice(0, 2)) {
    parts.push(`EARLIER ENTRY "${doc.title}":\n${doc.bodyMd.slice(0, RECENT_CHARS)}`);
  }
  parts.push(`TONIGHT'S ENTRY (verbatim — reply to this):\n${entry.bodyMd}`);

  return {
    sources: [...seen.values()].map(({ ulid, title }) => ({ ulid, title })),
    userPrompt: parts.join("\n\n---\n\n"),
  };
}
