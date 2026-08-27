import type { VaultApi } from "@wovera/core";

/**
 * Example pages for a fresh vault — the UX contract's "shelves start with a
 * few pages marked example that quietly fade as real life fills in".
 * Generic by design: never personal data, never fake personal data.
 */
export async function seedExampleVault(vault: VaultApi): Promise<void> {
  await vault.createDocument({
    type: "wiki",
    title: "Welcome to your Shelves",
    bodyMd:
      "This is an example page. Pages grow here from what you put down — journal entries, " +
      "people you mention, things you paste in. Each page shows where it came from.\n\n" +
      "Example pages like this one quietly disappear as your own life fills the shelves.",
    shelf: "Orientation",
    ledger: { kind: "tidy", summary: "Example pages placed on the shelves" },
  });
  await vault.createDocument({
    type: "wiki",
    title: "How the Ledger works",
    bodyMd:
      "Every action taken on your behalf — an entry kept, a page woven, a tidy-up — lands in " +
      "the Ledger, append-only. Nothing is ever silently rewritten. See [[Welcome to your Shelves]].",
    shelf: "Orientation",
    ledger: { kind: "tidy", summary: "Ledger explainer placed" },
  });
  await vault.createDocument({
    type: "wiki",
    title: "Your words are kept exactly",
    bodyMd:
      "Journal entries are verbatim — dictation stays as spoken, raw audio preserved. " +
      "Anything compiled from your words links back to them.",
    shelf: "Orientation",
    ledger: { kind: "tidy", summary: "Verbatim promise explainer placed" },
  });
}
