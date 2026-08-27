import type { VaultDocument } from "@wovera/core";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "../../components/Card";
import { MarkdownBody } from "../../components/MarkdownBody";
import { Screen } from "../../components/Screen";
import { shortDate } from "../../lib/dates";
import { fonts, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";
import { useVault } from "../../vault/VaultProvider";

/**
 * A page from the vault — journal entry, wiki page, or person. The book
 * voice, a provenance line, tappable wikilinks, and "linked from" at the
 * bottom so the graph is walkable in both directions.
 */
export default function PageScreen() {
  const { theme } = useTheme();
  const vault = useVault();
  const { ulid } = useLocalSearchParams<{ ulid: string }>();
  const [doc, setDoc] = useState<VaultDocument | null>(null);
  const [backlinks, setBacklinks] = useState<VaultDocument[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!vault || !ulid) return;
    let cancelled = false;
    void (async () => {
      const found = await vault.getDocument(ulid);
      if (cancelled) return;
      if (!found) {
        setMissing(true);
        return;
      }
      setDoc(found);
      const linked = await vault.getBacklinks(found.title);
      if (!cancelled) setBacklinks(linked.filter((d) => d.ulid !== found.ulid));
    })();
    return () => {
      cancelled = true;
    };
  }, [vault, ulid]);

  const openByTitle = (title: string) => {
    if (!vault) return;
    void vault.getDocumentByTitle(title).then((target) => {
      if (target) router.push(`/page/${target.ulid}`);
    });
  };

  const provenance = doc
    ? doc.type === "journal"
      ? `written ${shortDate(doc.createdAt)}`
      : `last tended ${shortDate(doc.updatedAt)}${doc.shelf ? ` · ${doc.shelf}` : ""}`
    : "";

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
        <Text style={[styles.back, { color: theme.inkFaint }]}>‹ Back</Text>
      </Pressable>
      {missing ? (
        <Card>
          <Text style={[styles.missing, { color: theme.inkSoft }]}>
            This page isn't in the vault. It may not have been written yet.
          </Text>
        </Card>
      ) : doc ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={[styles.title, { color: theme.ink }]}>{doc.title}</Text>
          <Text style={[styles.provenance, { color: theme.inkFaint }]}>{provenance}</Text>
          <MarkdownBody bodyMd={doc.bodyMd} onWikilink={openByTitle} />
          {backlinks.length > 0 ? (
            <View style={styles.backlinksBlock}>
              <Card label="Linked from">
                {backlinks.map((b) => (
                  <Pressable
                    key={b.ulid}
                    onPress={() => router.push(`/page/${b.ulid}`)}
                    accessibilityRole="link"
                    style={styles.backlinkRow}
                  >
                    <Text style={[styles.backlinkTitle, { color: theme.accentDeep }]}>
                      {b.title}
                    </Text>
                  </Pressable>
                ))}
              </Card>
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    marginBottom: space.m,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 36,
  },
  provenance: {
    fontFamily: fonts.ui,
    fontSize: 12,
    letterSpacing: 0.4,
    marginTop: 4,
    marginBottom: space.m,
  },
  scroll: { paddingBottom: space.xxl },
  backlinksBlock: { marginTop: space.l },
  backlinkRow: { paddingVertical: 8 },
  backlinkTitle: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  missing: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 21 },
});
