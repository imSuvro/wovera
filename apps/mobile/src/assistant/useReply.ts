import {
  applyWriteback,
  buildReplyContext,
  parseWritebackProposals,
  FIRST_EVENING_REPLY_NOTE,
  FIRST_EVENING_WRITEBACK_NOTE,
} from "@wovera/core";
import type { AppliedWriteback, VaultApi, VaultDocument } from "@wovera/core";
import { useCallback, useRef, useState } from "react";
import { generateTitle, geminiKey, proposeWritebacks, streamReply } from "./gemini";

/**
 * Runs the reply ritual for a just-kept entry:
 * ground in the vault → stream the Gentle reply → store it beside the entry
 * with citation links → let Flash-Lite give the entry its real title.
 * The entry is already safe before any of this starts; failure here never
 * touches the user's words.
 */
export interface ReplyState {
  status: "idle" | "thinking" | "streaming" | "done" | "error";
  text: string;
  sources: { ulid: string; title: string }[];
  /** Pages woven from this entry — the "Held for you" cards. */
  held: AppliedWriteback[];
  /** The entry's real name once Flash-Lite files it — cross-fades in the seal row. */
  title: string | null;
  error: string | null;
}

export function useReply(vault: VaultApi | null) {
  const [state, setState] = useState<ReplyState>({
    status: "idle",
    text: "",
    sources: [],
    held: [],
    title: null,
    error: null,
  });
  const running = useRef(false);

  const run = useCallback(
    async (entry: VaultDocument): Promise<void> => {
      if (!vault || running.current) return;
      if (!geminiKey()) {
        setState({
          status: "error",
          text: "",
          sources: [],
          held: [],
          title: null,
          error: "The assistant isn't connected yet — the entry is kept safely.",
        });
        return;
      }
      running.current = true;
      setState({ status: "thinking", text: "", sources: [], held: [], title: null, error: null });
      try {
        // The first evening: this entry is the one that ends it, so the check
        // must happen before it counts (the vault already holds it).
        const firstEvening = (await vault.listByType("journal", 2)).length <= 1;
        const ctx = await buildReplyContext(vault, entry);
        // House Rules: how Wovera speaks.
        const tone = await vault.getSetting("voice_tone");
        const toneNote =
          tone === "Straight"
            ? "\n\nTone override for this reply: be straight — a clear mirror. Skip softening preambles; name things directly, still kind."
            : tone === "Coach"
              ? "\n\nTone override for this reply: corner-man energy — brisk, rallying, action-leaning, still grounded only in their pages."
              : "";
        const openingNote = firstEvening ? FIRST_EVENING_REPLY_NOTE : "";
        setState((s) => ({ ...s, status: "streaming", sources: ctx.sources }));
        const reply = await streamReply(
          ctx.userPrompt,
          (soFar) => {
            setState((s) => (s.status === "streaming" ? { ...s, text: soFar } : s));
          },
          undefined,
          undefined,
          toneNote + openingNote,
        );
        await vault.attachReply(
          entry.ulid,
          reply,
          ctx.sources.map((s) => s.title),
        );
        setState((s) => ({ ...s, status: "done", text: reply }));
        // The entry's real name, quietly, on the cheapest model.
        const title = await generateTitle(entry.bodyMd);
        if (title) {
          await vault.updateDocument(entry.ulid, { title });
          setState((s) => ({ ...s, title }));
        }
        // The writeback ritual: durable knowledge, held — visibly, undoably.
        const finalEntry = { ulid: entry.ulid, title: title ?? entry.title };
        const wiki = await vault.listByType("wiki", 200);
        const byShelf = new Map<string, string[]>();
        for (const page of wiki) {
          const shelf = page.shelf ?? "Unshelved";
          byShelf.set(shelf, [...(byShelf.get(shelf) ?? []), page.title]);
        }
        const pagesList = [...byShelf.entries()]
          .map(([shelf, titles]) => `${shelf}:\n${titles.map((t) => `- ${t}`).join("\n")}`)
          .join("\n\n");
        const raw = await proposeWritebacks(
          `EXISTING PAGES BY SHELF:\n${pagesList}\n\n---\n\nENTRY "${finalEntry.title}":\n${entry.bodyMd}\n\n---\n\nREPLY GIVEN:\n${reply}${
            firstEvening ? FIRST_EVENING_WRITEBACK_NOTE : ""
          }`,
        );
        if (raw) {
          for (const proposal of parseWritebackProposals(raw)) {
            const applied = await applyWriteback(vault, proposal, finalEntry);
            if (applied) setState((s) => ({ ...s, held: [...s.held, applied] }));
          }
        }
      } catch (err) {
        const code = err instanceof Error ? err.message : "";
        const message =
          code === "gemini-429"
            ? "Resting a moment — your entry is already safe. Try again shortly."
            : code === "gemini-filtered"
              ? "The reply was cut short by the model's content filter — your entry is kept whole. Trying again usually works."
              : "The reply couldn't come through — your entry is already safe.";
        setState((s) => ({ ...s, status: "error", error: message }));
      } finally {
        running.current = false;
      }
    },
    [vault],
  );

  const reset = useCallback(
    () => setState({ status: "idle", text: "", sources: [], held: [], title: null, error: null }),
    [],
  );

  return { state, run, reset };
}
