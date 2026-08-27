import { isQuestionShaped } from "@wovera/core";
import type { SearchHit, ShelfSummary, VaultDocument } from "@wovera/core";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AskPanel } from "../../components/AskPanel";
import { PersonMark } from "../../components/PersonMark";
import { Screen } from "../../components/Screen";
import { SnippetText } from "../../components/SnippetText";
import { Tappable } from "../../components/Tappable";
import { TopRow } from "../../components/TopRow";
import { shortDate } from "../../lib/dates";
import { fonts, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";
import { useVault } from "../../vault/VaultProvider";

/** "met 27 Aug · designer, Pune" — a person's one-line essence. */
function personEssence(bodyMd: string): string {
  for (const raw of bodyMd.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("[[")) continue;
    return line.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_m, t: string, a?: string) => a ?? t);
  }
  return "";
}

interface ShelfPage {
  doc: VaultDocument;
  /** Journal entries linking here — the library shows its sources. */
  wovenFrom: number;
}

/**
 * Shelves — find, or ask, anything (Pattern Book, Plate VI). The vault as
 * a small library: one field with two powers (instant search; questions
 * offer an answer), the Journal as the first door, bookplate shelf
 * headers, provenance under every title. Everything sits on the ground —
 * the only rules are hairlines (PB-5).
 */
export default function ShelvesScreen() {
  const { theme } = useTheme();
  const vault = useVault();
  const [shelves, setShelves] = useState<ShelfSummary[]>([]);
  const [pages, setPages] = useState<Map<string, ShelfPage[]>>(new Map());
  const [journalCount, setJournalCount] = useState(0);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [asking, setAsking] = useState<string | null>(null);

  useEffect(() => {
    if (!vault) return;
    let cancelled = false;
    void (async () => {
      const [shelfList, journal] = await Promise.all([
        vault.listShelves(),
        vault.listByType("journal", 500),
      ]);
      const byShelf = new Map<string, ShelfPage[]>();
      for (const s of shelfList) {
        const docs = await vault.listShelf(s.shelf);
        const rows: ShelfPage[] = [];
        for (const doc of docs) {
          const linked = await vault.getBacklinks(doc.title);
          rows.push({ doc, wovenFrom: linked.filter((b) => b.type === "journal").length });
        }
        byShelf.set(s.shelf, rows);
      }
      if (!cancelled) {
        setShelves(shelfList);
        setPages(byShelf);
        setJournalCount(journal.length);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vault]);

  useEffect(() => {
    if (!vault) return;
    const trimmed = query.trim();
    let cancelled = false;
    // Search-as-you-type: local FTS is instant; a tiny debounce keeps typing smooth.
    const id = setTimeout(() => {
      if (cancelled) return;
      if (!trimmed) {
        setHits(null);
        return;
      }
      void vault.search(trimmed).then((results) => {
        if (!cancelled) setHits(results);
      });
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [vault, query]);

  const trimmed = query.trim();
  const questionShaped = trimmed.length > 2 && isQuestionShaped(trimmed);
  const pageCount = shelves.reduce((sum, s) => sum + s.count, 0);

  return (
    <Screen>
      <TopRow minimal />
      <Text style={[styles.title, { color: theme.ink }]}>Shelves</Text>
      <Text style={[styles.sub, { color: theme.inkSoft }]}>
        {pageCount} pages · {shelves.length} shelves · {journalCount} journal entries
      </Text>

      <View style={[styles.field, { borderColor: theme.line }]}>
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setAsking(null);
          }}
          placeholder="Find — or ask — anything…"
          placeholderTextColor={theme.inkFaint}
          style={[styles.fieldInput, { color: theme.ink }]}
          accessibilityLabel="Find — or ask — anything"
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {questionShaped && !asking ? (
          <Tappable
            onPress={() => setAsking(trimmed)}
            style={styles.askRow}
            accessibilityLabel="Ask Wovera"
          >
            <Text style={[styles.askText, { color: theme.accentDeep }]}>Ask Wovera ›</Text>
            <Text style={[styles.askSub, { color: theme.inkFaint }]} numberOfLines={1}>
              “{trimmed}”
            </Text>
          </Tappable>
        ) : null}
        {asking ? (
          <View style={styles.askPanelWrap}>
            <AskPanel question={asking} />
          </View>
        ) : null}

        {hits !== null ? (
          hits.length === 0 && !asking ? (
            <Text style={[styles.empty, { color: theme.inkSoft }]}>
              Nothing on the shelves matches “{trimmed}” yet.
            </Text>
          ) : (
            hits.map((hit) => (
              <Pressable
                key={hit.ulid}
                onPress={() => router.push(`/page/${hit.ulid}`)}
                style={[styles.pageRow, { borderBottomColor: theme.line }]}
              >
                <Text style={[styles.pageTitle, { color: theme.ink }]}>{hit.title}</Text>
                <SnippetText
                  snippet={hit.snippet}
                  style={[styles.snippet, { color: theme.inkSoft }]}
                />
              </Pressable>
            ))
          )
        ) : (
          <>
            {/* The Journal is the first shelf — a door, not a card. */}
            <Tappable
              onPress={() => router.push("/journal")}
              style={styles.journalDoor}
              accessibilityLabel="The Journal"
            >
              <View style={styles.journalRow}>
                <Text style={[styles.journalTitle, { color: theme.accentDeep }]}>
                  The Journal ›
                </Text>
              </View>
              <Text style={[styles.pageMeta, { color: theme.inkFaint }]}>
                {journalCount} entries, word for word
              </Text>
            </Tappable>

            {shelves.length === 0 ? (
              <Text style={[styles.empty, { color: theme.inkSoft }]}>
                The shelves are built as you live. Pages grow here from what you put down — each one
                showing where it came from.
              </Text>
            ) : (
              shelves.map((shelf) => (
                <View key={shelf.shelf} style={styles.shelfBlock}>
                  {/* A bookplate: small caps, a hairline running to the count. */}
                  <View style={styles.bookplate}>
                    <Text style={[styles.bookplateTitle, { color: theme.accentDeep }]}>
                      {shelf.shelf.toUpperCase()}
                    </Text>
                    <View style={[styles.bookplateRule, { backgroundColor: theme.line }]} />
                    <Text style={[styles.bookplateCount, { color: theme.inkFaint }]}>
                      {shelf.count}
                    </Text>
                  </View>
                  {(pages.get(shelf.shelf) ?? []).map(({ doc, wovenFrom }, i, arr) => (
                    <Pressable
                      key={doc.ulid}
                      onPress={() => router.push(`/page/${doc.ulid}`)}
                      style={[
                        styles.pageRow,
                        doc.type === "person" && styles.personRow,
                        i < arr.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: theme.line,
                        },
                      ]}
                    >
                      {doc.type === "person" ? <PersonMark name={doc.title} size={30} /> : null}
                      <View style={styles.pageText}>
                        <Text style={[styles.pageTitle, { color: theme.ink }]}>{doc.title}</Text>
                        <Text
                          style={[styles.pageMeta, { color: theme.inkFaint }]}
                          numberOfLines={1}
                        >
                          {doc.type === "person"
                            ? `met ${shortDate(doc.createdAt)}${
                                personEssence(doc.bodyMd)
                                  ? ` · ${personEssence(doc.bodyMd).slice(0, 60)}`
                                  : ""
                              }`
                            : `last tended ${shortDate(doc.updatedAt)}${
                                wovenFrom > 0
                                  ? ` · woven from ${wovenFrom} ${wovenFrom === 1 ? "entry" : "entries"}`
                                  : ""
                              }`}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38 },
  sub: { fontFamily: fonts.ui, fontSize: 13, letterSpacing: 0.3, marginTop: 2 },
  field: {
    borderWidth: 1,
    borderRadius: 22,
    marginTop: space.m,
    marginBottom: space.s,
  },
  fieldInput: {
    fontFamily: fonts.ui,
    fontSize: 15,
    paddingHorizontal: space.m + 2,
    paddingVertical: 12,
  },
  scroll: { paddingBottom: space.xl },
  askRow: { paddingVertical: 10 },
  askText: { fontFamily: fonts.uiBold, fontSize: 15 },
  askSub: { fontFamily: fonts.bodyItalic, fontSize: 13, marginTop: 2 },
  askPanelWrap: { marginTop: space.s, marginBottom: space.m },
  journalDoor: { paddingVertical: 10, marginBottom: space.s },
  journalRow: { flexDirection: "row", alignItems: "center" },
  journalTitle: { fontFamily: fonts.bodyMedium, fontSize: 17 },
  shelfBlock: { marginTop: space.m },
  bookplate: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
  bookplateTitle: { fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.6 },
  bookplateRule: { flex: 1, height: StyleSheet.hairlineWidth },
  bookplateCount: { fontFamily: fonts.ui, fontSize: 11 },
  pageRow: { paddingVertical: 11 },
  personRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pageText: { flex: 1 },
  pageTitle: { fontFamily: fonts.bodyMedium, fontSize: 16 },
  pageMeta: { fontFamily: fonts.ui, fontSize: 11, letterSpacing: 0.3, marginTop: 2 },
  snippet: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginTop: 4 },
  empty: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 21, marginTop: space.m },
});
