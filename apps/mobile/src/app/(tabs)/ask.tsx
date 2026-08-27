import { ASK_SYSTEM_PROMPT, significantTerms } from "@wovera/core";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { geminiKey, streamReply } from "../../assistant/gemini";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { TopRow } from "../../components/TopRow";
import { fonts, radius, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";
import { useVault } from "../../vault/VaultProvider";

/**
 * Ask — vault-first answers. The question's own words search the shelves;
 * matching pages ground the streamed answer, cited as chips. Anything
 * beyond the vault is visibly fenced ("Beyond your pages:").
 */
export default function AskScreen() {
  const { theme } = useTheme();
  const vault = useVault();
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<{ ulid: string; title: string }[]>([]);
  const [status, setStatus] = useState<"idle" | "answering" | "done" | "error">("idle");
  const busy = useRef(false);

  const ask = async () => {
    const q = question.trim();
    if (!vault || !q || busy.current) return;
    if (!geminiKey()) {
      setStatus("error");
      setAsked(q);
      setAnswer("The assistant isn't connected yet.");
      return;
    }
    busy.current = true;
    Keyboard.dismiss();
    setAsked(q);
    setAnswer("");
    setSources([]);
    setStatus("answering");
    try {
      const seen = new Map<string, { ulid: string; title: string; body: string }>();
      for (const term of significantTerms(q)) {
        for (const hit of await vault.search(term, 3)) {
          if (seen.has(hit.ulid)) continue;
          const doc = await vault.getDocument(hit.ulid);
          if (doc) seen.set(doc.ulid, { ulid: doc.ulid, title: doc.title, body: doc.bodyMd });
          if (seen.size >= 4) break;
        }
        if (seen.size >= 4) break;
      }
      setSources([...seen.values()].map(({ ulid, title }) => ({ ulid, title })));
      const pages = [...seen.values()]
        .map((p) => `PAGE "${p.title}":\n${p.body.slice(0, 1400)}`)
        .join("\n\n---\n\n");
      const prompt = `${pages || "(no matching pages found in the vault)"}\n\n---\n\nQUESTION:\n${q}`;
      const text = await streamReply(
        prompt,
        (soFar) => setAnswer(soFar),
        undefined,
        ASK_SYSTEM_PROMPT,
      );
      setAnswer(text);
      setStatus("done");
    } catch {
      setStatus("error");
      setAnswer("The answer couldn't come through. Ask again in a moment.");
    } finally {
      busy.current = false;
    }
  };

  return (
    <Screen>
      <TopRow />
      <Text style={[styles.title, { color: theme.ink }]}>Ask</Text>

      <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="Ask anything…"
          placeholderTextColor={theme.inkFaint}
          style={[styles.input, { color: theme.ink }]}
          onSubmitEditing={() => void ask()}
          returnKeyType="search"
          accessibilityLabel="Ask your vault"
        />
        {question.trim() ? (
          <Pressable onPress={() => void ask()} hitSlop={8}>
            <Text style={[styles.go, { color: theme.accentDeep }]}>
              {status === "answering" ? "…" : "Ask"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {asked ? (
          <Card label="You asked">
            <Text style={[styles.question, { color: theme.ink }]}>{asked}</Text>
          </Card>
        ) : (
          <Card label="How answers work">
            <Text style={[styles.body, { color: theme.inkSoft }]}>
              Answers come from your own pages first — always cited, always yours. Anything beyond
              them is clearly marked as general knowledge.
            </Text>
          </Card>
        )}

        {answer ? (
          <Card label={status === "answering" ? "Reading your pages…" : "From your vault"}>
            <Text style={[styles.answer, { color: theme.ink }]}>{answer}</Text>
            {sources.length > 0 ? (
              <View style={styles.chipRow}>
                {sources.map((s) => (
                  <Pressable
                    key={s.ulid}
                    onPress={() => router.push(`/page/${s.ulid}`)}
                    style={[
                      styles.chip,
                      { borderColor: theme.line, backgroundColor: theme.surface2 },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: theme.accentDeep }]}>{s.title}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 38,
    marginBottom: space.m,
  },
  box: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.card,
    paddingRight: space.m,
    marginBottom: space.m,
  },
  input: {
    flex: 1,
    fontFamily: fonts.ui,
    fontSize: 15,
    paddingHorizontal: space.m,
    paddingVertical: 12,
  },
  go: { fontFamily: fonts.uiBold, fontSize: 14 },
  scroll: { paddingBottom: space.xl },
  question: { fontFamily: fonts.bodyItalic, fontSize: 16, lineHeight: 24 },
  answer: { fontFamily: fonts.body, fontSize: 16, lineHeight: 25 },
  body: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 21 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.s },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fonts.uiMedium, fontSize: 12 },
});
