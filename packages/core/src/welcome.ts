import type { VaultApi } from "./vault";

/**
 * The First Evening (Pattern Book, Plate VIII).
 *
 * A brand-new vault has no return trip to offer, so the first hour makes one
 * honestly: the lamp is lit first, and the only pre-written thing in the
 * house is a letter from the lamp itself. Never fake user data — this is
 * house content, shelved like any page, and the append-only vault simply
 * keeps it. It also earns its place: it grounds the first Ask, and it is
 * the only prose in an empty vault, so Today can quote it on night one.
 */

export const WELCOME_SHELF = "The House";
export const WELCOME_TITLE = "A letter from the lamp";

const WELCOME_BODY = `Welcome. This house has one job: to hold what you tell it, and to hand it back when it matters.

Everything you say is kept exactly as you said it. Nothing is cleaned up, shortened, or corrected unless you ask. Your words are encrypted on this phone before they ever leave it — nobody, including the people who built this, can read your vault.

When you talk to the lamp, three things happen. Your entry is kept, word for word. A reply comes back from something that has read all your pages. And anything durable — a rule you set, a decision you made, a pattern worth remembering — is woven into a page on your shelves, where it waits for the day it becomes useful.

You can ask this house anything. Questions are answered from your own pages first, always cited, and anything from beyond them is clearly marked.

Every single thing the house does is written down in the Ledger, and anything it wove can be undone from there.

the lamp is ready when you are.`;

/**
 * Shelves the welcome letter if the house has never written one. Safe to
 * call on every open: it is a create-once, checked by title.
 */
export async function ensureWelcomeLetter(vault: VaultApi): Promise<void> {
  const existing = await vault.getDocumentByTitle(WELCOME_TITLE);
  if (existing) return;
  await vault.createDocument({
    type: "wiki",
    title: WELCOME_TITLE,
    bodyMd: WELCOME_BODY,
    shelf: WELCOME_SHELF,
    ledger: { kind: "held", summary: `The house left you a letter — ${WELCOME_TITLE}` },
  });
}

/** True while the keeper has never kept an entry — a derived state, never a flag. */
export async function isFirstEvening(vault: VaultApi): Promise<boolean> {
  const entries = await vault.listByType("journal", 1);
  return entries.length === 0;
}

/**
 * Appended to the reply prompt on the very first entry: welcome a beginning
 * without pretending to a past that doesn't exist yet.
 */
export const FIRST_EVENING_REPLY_NOTE = `

This is the keeper's FIRST entry — the vault was empty until now. Do not
imply you remember anything about them, and do not cite pages beyond the
house's own welcome letter. Welcome them warmly and briefly, reflect what
they actually said, and end by naming one concrete thing you are keeping
for them. Do not explain the app's features.`;

/**
 * Appended to the writeback prompt on the first entry: an empty vault has
 * nothing to weave into, so the restraint rule is relaxed exactly once —
 * the keeper should watch their first page appear.
 */
export const FIRST_EVENING_WRITEBACK_NOTE = `

This is the keeper's FIRST entry and their shelves are empty. Propose one
or two starter pages for the most durable things they said (a person, a
place, a rule, an intention, a thread of their life) so their library
begins. Titles must be nouns a person would look for later. Give each new
page a shelf named for its subject — never "The House", which belongs to
the house's own letter. If they truly said nothing durable, propose
nothing.`;
