import { buildReplyContext } from "@wovera/core";
import type { VaultApi, VaultDocument } from "@wovera/core";
import { useCallback, useRef, useState } from "react";
import { generateTitle, geminiKey, streamReply } from "./gemini";

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
  error: string | null;
}

export function useReply(vault: VaultApi | null) {
  const [state, setState] = useState<ReplyState>({
    status: "idle",
    text: "",
    sources: [],
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
          error: "The assistant isn't connected yet — the entry is kept safely.",
        });
        return;
      }
      running.current = true;
      setState({ status: "thinking", text: "", sources: [], error: null });
      try {
        const ctx = await buildReplyContext(vault, entry);
        setState((s) => ({ ...s, status: "streaming", sources: ctx.sources }));
        const reply = await streamReply(ctx.userPrompt, (soFar) => {
          setState((s) => (s.status === "streaming" ? { ...s, text: soFar } : s));
        });
        await vault.attachReply(
          entry.ulid,
          reply,
          ctx.sources.map((s) => s.title),
        );
        setState((s) => ({ ...s, status: "done", text: reply }));
        // The entry's real name, quietly, on the cheapest model.
        const title = await generateTitle(entry.bodyMd);
        if (title) await vault.updateDocument(entry.ulid, { title });
      } catch (err) {
        const message =
          err instanceof Error && err.message === "gemini-429"
            ? "Resting a moment — your entry is already safe. Try again shortly."
            : "The reply couldn't come through — your entry is already safe.";
        setState((s) => ({ ...s, status: "error", error: message }));
      } finally {
        running.current = false;
      }
    },
    [vault],
  );

  const reset = useCallback(
    () => setState({ status: "idle", text: "", sources: [], error: null }),
    [],
  );

  return { state, run, reset };
}
