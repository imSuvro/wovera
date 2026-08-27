import { parsePccEntry } from "@wovera/core";
import type { PccEntry, VaultDocument } from "@wovera/core";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from "react-native-svg";
import { Letter } from "../../components/Letter";
import { MarkdownBody } from "../../components/MarkdownBody";
import { PersonMark } from "../../components/PersonMark";
import { Screen } from "../../components/Screen";
import { shortDate } from "../../lib/dates";
import { fonts, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";
import { useVault } from "../../vault/VaultProvider";

/** "2026-08-26" → "26 Aug 2026", or the raw value when it won't parse. */
function readableDate(raw: string): string {
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? shortDate(ms) : raw;
}

/**
 * A page from the vault — and for journal transcripts, a reading room
 * (Pattern Book, Plate VII). The parser reads the shape, never trusts it:
 * entries in the vault's transcript form are decomposed into a date
 * eyebrow, an italic summary lede, the user's words on the ground in the
 * book voice, and the assistant's old replies wearing the Letter. Anything
 * else takes the generic path — which, after the typographic upgrade,
 * also reads like a book. Raw scaffolding never reaches the reader's eye.
 */
export default function PageScreen() {
  const { theme } = useTheme();
  const vault = useVault();
  const { ulid } = useLocalSearchParams<{ ulid: string }>();
  const [doc, setDoc] = useState<VaultDocument | null>(null);
  const [backlinks, setBacklinks] = useState<VaultDocument[]>([]);
  const [replySources, setReplySources] = useState<string[]>([]);
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

  const parsed: PccEntry | null = doc && doc.type === "journal" ? parsePccEntry(doc.bodyMd) : null;
  const repliedWhen = parsed?.date ? readableDate(parsed.date) : null;

  const eyebrow = doc
    ? doc.type === "journal"
      ? `JOURNAL · ${parsed?.date ? readableDate(parsed.date) : shortDate(doc.createdAt)}${doc.audioUri ? " · SPOKEN" : ""}`
      : doc.type === "person"
        ? `PEOPLE · MET ${shortDate(doc.createdAt)}`
        : `${(doc.shelf ?? "THE SHELVES").toUpperCase()} · LAST TENDED ${shortDate(doc.updatedAt)}`
    : "";

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
        <Text style={[styles.back, { color: theme.inkFaint }]}>‹ Back</Text>
      </Pressable>
      {missing ? (
        <Text style={[styles.missing, { color: theme.inkSoft }]}>
          This page isn't in the vault. It may not have been written yet.
        </Text>
      ) : doc ? (
        <View style={styles.readerWrap}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {doc.type === "person" ? (
              <View style={styles.personHeader}>
                <PersonMark name={doc.title} size={52} />
              </View>
            ) : null}
            <Text style={[styles.eyebrow, { color: theme.accentDeep }]}>{eyebrow}</Text>
            <Text style={[styles.title, { color: theme.ink }]}>{doc.title}</Text>

            {parsed ? (
              <>
                {parsed.summary ? (
                  <Text style={[styles.lede, { color: theme.inkSoft }]}>{parsed.summary}</Text>
                ) : null}
                {parsed.turns.map((turn, i) =>
                  turn.speaker === "user" ? (
                    <Text key={i} style={[styles.turn, { color: theme.ink }]}>
                      {turn.text}
                    </Text>
                  ) : (
                    <Letter
                      key={i}
                      label={`Wovera replied${repliedWhen ? ` · ${repliedWhen}` : ""}`}
                      style={styles.turnLetter}
                    >
                      <Text style={[styles.letterBody, { color: theme.ink }]}>{turn.text}</Text>
                    </Letter>
                  ),
                )}
              </>
            ) : (
              <View style={styles.bodyBlock}>
                <MarkdownBody bodyMd={doc.bodyMd} onWikilink={openByTitle} />
              </View>
            )}

            {doc.replyMd ? (
              <Letter label="Wovera replied" style={styles.turnLetter}>
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
              </Letter>
            ) : null}

            {backlinks.length > 0 ? (
              <View style={styles.backlinksBlock}>
                <Text style={[styles.linkedEyebrow, { color: theme.inkFaint }]}>LINKED FROM</Text>
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
              </View>
            ) : null}
          </ScrollView>
          {/* Long reads stay soft-edged: the top of the scroll fades to ground. */}
          <View style={styles.topFade} pointerEvents="none">
            <Svg width="100%" height="24">
              <Defs>
                <SvgLinearGradient id="pagefade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={theme.ground} stopOpacity={1} />
                  <Stop offset="1" stopColor={theme.ground} stopOpacity={0} />
                </SvgLinearGradient>
              </Defs>
              <Rect width="100%" height="24" fill="url(#pagefade)" />
            </Svg>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    marginBottom: space.s,
  },
  readerWrap: { flex: 1 },
  eyebrow: {
    fontFamily: fonts.uiBold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 36,
    marginBottom: space.s,
  },
  lede: {
    fontFamily: fonts.bodyItalic,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: space.m,
  },
  turn: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 28,
    marginBottom: space.m,
  },
  turnLetter: { marginBottom: space.m },
  letterBody: { fontFamily: fonts.body, fontSize: 16, lineHeight: 26 },
  bodyBlock: { marginBottom: space.s },
  scroll: { paddingTop: 24, paddingBottom: space.xxl },
  topFade: { position: "absolute", top: 0, left: 0, right: 0, height: 24 },
  personHeader: { marginBottom: space.s },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.s },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fonts.uiMedium, fontSize: 12 },
  backlinksBlock: { marginTop: space.m },
  linkedEyebrow: { fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.4, marginBottom: 4 },
  backlinkRow: { paddingVertical: 8 },
  backlinkTitle: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  missing: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 21 },
});
