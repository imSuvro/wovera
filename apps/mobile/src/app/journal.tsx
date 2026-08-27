import type { VaultDocument } from "@wovera/core";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { Tappable } from "../components/Tappable";
import { shortDate } from "../lib/dates";
import { fonts, space } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import { useVault } from "../vault/VaultProvider";

/** First words of the entry — the verbatim voice, as its own preview. */
function preview(bodyMd: string): string {
  const text = bodyMd.replace(/^#.*$/gm, "").replace(/\s+/g, " ").trim();
  return text.length > 110 ? `${text.slice(0, 110)}…` : text;
}

/**
 * The Journal — every entry, newest first, each in its own words.
 * Verbatim previews in the book voice; dates as quiet eyebrows.
 */
export default function JournalScreen() {
  const { theme } = useTheme();
  const vault = useVault();
  const [entries, setEntries] = useState<VaultDocument[]>([]);

  useEffect(() => {
    if (!vault) return;
    let cancelled = false;
    void vault.listByType("journal", 100).then((docs) => {
      if (!cancelled) setEntries([...docs].sort((a, b) => b.createdAt - a.createdAt));
    });
    return () => {
      cancelled = true;
    };
  }, [vault]);

  return (
    <Screen>
      <Tappable onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.back, { color: theme.inkFaint }]}>‹ Back</Text>
      </Tappable>
      <Text style={[styles.title, { color: theme.ink }]}>Journal</Text>
      <Text style={[styles.sub, { color: theme.inkSoft }]}>
        {entries.length} {entries.length === 1 ? "entry" : "entries"}, word for word.
      </Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {entries.map((entry, i) => (
          <Tappable key={entry.ulid} onPress={() => router.push(`/page/${entry.ulid}`)}>
            <Card index={Math.min(i, 6)}>
              <Text style={[styles.date, { color: theme.inkFaint }]}>
                {shortDate(entry.createdAt).toUpperCase()}
                {entry.audioUri ? "  ·  SPOKEN" : ""}
              </Text>
              <Text style={[styles.entryTitle, { color: theme.ink }]}>{entry.title}</Text>
              <Text style={[styles.preview, { color: theme.inkSoft }]} numberOfLines={2}>
                {preview(entry.bodyMd)}
              </Text>
            </Card>
          </Tappable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: fonts.uiMedium, fontSize: 14, marginBottom: space.m },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38 },
  sub: { fontFamily: fonts.ui, fontSize: 13, marginTop: 2, marginBottom: space.m },
  scroll: { paddingBottom: space.xxl },
  date: { fontFamily: fonts.uiBold, fontSize: 10, letterSpacing: 1.4, marginBottom: 6 },
  entryTitle: { fontFamily: fonts.bodyMedium, fontSize: 17, marginBottom: 4 },
  preview: { fontFamily: fonts.bodyItalic, fontSize: 14, lineHeight: 21 },
});
