import { ASK_SYSTEM_PROMPT, significantTerms } from "@wovera/core";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { geminiKey, streamReply } from "../assistant/gemini";
import { fonts } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import { useVault } from "../vault/VaultProvider";
import { Letter } from "./Letter";
import { MarkdownBody } from "./MarkdownBody";

/**
 * Ask is a power, not a place (Pattern Book PB-2 / Plate VI). Hand this
 * panel a question and the answer slides in as a Letter: grounded in the
 * vault's own pages first, sources chipped inside, anything beyond them
 * fenced by the prompt as "Beyond your pages:". Lives inline wherever a
 * question is asked — the Shelves field, the Lamp.
 */
export function AskPanel({ question, onDone }: { question: string; onDone?: () => void }) {
  const { theme } = useTheme();
  const vault = useVault();
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<{ ulid: string; title: string }[]>([]);
  const [status, setStatus] = useState<"answering" | "done" | "error">("answering");
  // Latest callback without re-asking the question when its identity shifts.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (!vault) return;
    let cancelled = false;
    void (async () => {
      if (!geminiKey()) {
        if (!cancelled) {
          setStatus("error");
          setAnswer("The assistant isn't connected yet.");
          onDoneRef.current?.();
        }
        return;
      }
      try {
        const seen = new Map<string, { ulid: string; title: string; body: string }>();
        for (const term of significantTerms(question)) {
          for (const hit of await vault.search(term, 3)) {
            if (seen.has(hit.ulid)) continue;
            const doc = await vault.getDocument(hit.ulid);
            if (doc) seen.set(doc.ulid, { ulid: doc.ulid, title: doc.title, body: doc.bodyMd });
            if (seen.size >= 4) break;
          }
          if (seen.size >= 4) break;
        }
        if (cancelled) return;
        setSources([...seen.values()].map(({ ulid, title }) => ({ ulid, title })));
        const pages = [...seen.values()]
          .map((p) => `PAGE "${p.title}":\n${p.body.slice(0, 1400)}`)
          .join("\n\n---\n\n");
        const prompt = `${pages || "(no matching pages found in the vault)"}\n\n---\n\nQUESTION:\n${question}`;
        const text = await streamReply(
          prompt,
          (soFar) => {
            if (!cancelled) setAnswer(soFar);
          },
          undefined,
          ASK_SYSTEM_PROMPT,
        );
        if (!cancelled) {
          setAnswer(text);
          setStatus("done");
          onDoneRef.current?.();
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setAnswer("The answer couldn't come through. Ask again in a moment.");
          onDoneRef.current?.();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vault, question]);

  // The Letter is the assistant speaking; when it couldn't, say so on the
  // ground instead of dressing an apology in the letter's paper.
  if (status === "error") {
    return (
      <Animated.View entering={FadeInDown.duration(360)}>
        <Text style={[styles.quiet, { color: theme.inkSoft }]}>{answer}</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(360)}>
      <Letter label={answer ? "Wovera answers" : "reading your pages…"}>
        {answer ? (
          <MarkdownBody
            bodyMd={answer}
            onWikilink={(title) => {
              void vault?.getDocumentByTitle(title).then((doc) => {
                if (doc) router.push(`/page/${doc.ulid}`);
              });
            }}
          />
        ) : null}
        {answer && sources.length > 0 ? (
          <View style={styles.chipRow}>
            {sources.map((s) => (
              <Pressable
                key={s.ulid}
                onPress={() => router.push(`/page/${s.ulid}`)}
                style={[styles.chip, { borderColor: theme.line, backgroundColor: theme.surface2 }]}
              >
                <Text style={[styles.chipText, { color: theme.accentDeep }]}>{s.title}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Letter>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  quiet: { fontFamily: fonts.ui, fontSize: 13.5, lineHeight: 20, textAlign: "center" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fonts.uiMedium, fontSize: 12 },
});
