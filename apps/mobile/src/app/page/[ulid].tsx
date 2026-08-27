import type { VaultDocument } from "@wovera/core";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { cloudTranscribe } from "../../assistant/transcribe";
import { Card } from "../../components/Card";
import { MarkdownBody } from "../../components/MarkdownBody";
import { PersonMark } from "../../components/PersonMark";
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
  const [replySources, setReplySources] = useState<string[]>([]);
  const [missing, setMissing] = useState(false);
  // SPIKE (this branch only): cloud re-transcription of the stored audio.
  const [cloudText, setCloudText] = useState<string | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const runCloudTranscribe = async () => {
    if (!doc?.audioUri || !vault || cloudBusy) return;
    setCloudBusy(true);
    setCloudError(null);
    try {
      // Bias recognition toward the vault's own names — the model's
      // custom-vocabulary list, fed from what this user actually writes.
      const people = await vault.listByType("person");
      const vocab = ["Wovera", ...people.map((p) => p.title)];
      setCloudText(await cloudTranscribe(doc.audioUri, vocab));
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : "transcription failed");
    } finally {
      setCloudBusy(false);
    }
  };

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
      const [linked, sources] = await Promise.all([
        vault.getBacklinks(found.title),
        vault.getLinkTargets(found.ulid, "reply"),
      ]);
      if (!cancelled) {
        setBacklinks(linked.filter((d) => d.ulid !== found.ulid));
        setReplySources(sources);
      }
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
          {doc.type === "person" ? (
            <View style={styles.personHeader}>
              <PersonMark name={doc.title} size={52} />
            </View>
          ) : null}
          <Text style={[styles.title, { color: theme.ink }]}>{doc.title}</Text>
          <Text style={[styles.provenance, { color: theme.inkFaint }]}>{provenance}</Text>
          <MarkdownBody bodyMd={doc.bodyMd} onWikilink={openByTitle} />
          {doc.replyMd ? (
            <View style={styles.replyBlock}>
              <Card label="Wovera replied">
                <MarkdownBody bodyMd={doc.replyMd} onWikilink={openByTitle} />
                {replySources.length > 0 ? (
                  <View style={styles.chipRow}>
                    {replySources.map((title) => (
                      <Pressable
                        key={title}
                        onPress={() => openByTitle(title)}
                        style={[
                          styles.chip,
                          { borderColor: theme.line, backgroundColor: theme.surface2 },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: theme.accentDeep }]}>{title}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </Card>
            </View>
          ) : null}
          {doc.audioUri ? (
            <View style={styles.replyBlock}>
              <Card label="Cloud transcription — test branch only">
                <Text style={[styles.cloudWarn, { color: theme.inkSoft }]}>
                  Sends this entry's raw audio to Google's gemini-3.5-transcribe. Free tier: Google
                  may train on it. Nothing runs unless you tap.
                </Text>
                {cloudText ? (
                  <Text style={[styles.cloudText, { color: theme.ink }]}>{cloudText}</Text>
                ) : null}
                {cloudError ? (
                  <Text style={[styles.cloudWarn, { color: theme.inkSoft }]}>{cloudError}</Text>
                ) : null}
                <Pressable
                  onPress={() => void runCloudTranscribe()}
                  hitSlop={8}
                  disabled={cloudBusy}
                  accessibilityRole="button"
                >
                  <Text style={[styles.cloudAction, { color: theme.accentDeep }]}>
                    {cloudBusy
                      ? "Transcribing in the cloud…"
                      : cloudText
                        ? "Run it again"
                        : "Transcribe this audio in the cloud"}
                  </Text>
                </Pressable>
              </Card>
            </View>
          ) : null}
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
  personHeader: { marginBottom: space.s },
  replyBlock: { marginTop: space.l },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.s },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fonts.uiMedium, fontSize: 12 },
  backlinksBlock: { marginTop: space.l },
  backlinkRow: { paddingVertical: 8 },
  backlinkTitle: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  missing: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 21 },
  cloudWarn: { fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 18 },
  cloudText: { fontFamily: fonts.body, fontSize: 16, lineHeight: 25, marginTop: space.s },
  cloudAction: { fontFamily: fonts.uiBold, fontSize: 14, marginTop: space.s },
});
