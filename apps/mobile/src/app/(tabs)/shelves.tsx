import type { SearchHit, ShelfSummary, VaultDocument } from "@wovera/core";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Card } from "../../components/Card";
import { Eyebrow } from "../../components/Eyebrow";
import { Screen } from "../../components/Screen";
import { TopRow } from "../../components/TopRow";
import { fonts, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";
import { useVault } from "../../vault/VaultProvider";

/**
 * The Shelves — the vault as a small library. Groups pages by shelf (the
 * sections of the vault's index) and searches the whole vault as you type.
 */
export default function ShelvesScreen() {
  const { theme } = useTheme();
  const vault = useVault();
  const [shelves, setShelves] = useState<ShelfSummary[]>([]);
  const [pages, setPages] = useState<Map<string, VaultDocument[]>>(new Map());
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);

  useEffect(() => {
    if (!vault) return;
    let cancelled = false;
    void (async () => {
      const shelfList = await vault.listShelves();
      const byShelf = new Map<string, VaultDocument[]>();
      for (const s of shelfList) byShelf.set(s.shelf, await vault.listShelf(s.shelf));
      if (!cancelled) {
        setShelves(shelfList);
        setPages(byShelf);
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

  return (
    <Screen>
      <TopRow />
      <Text style={[styles.title, { color: theme.ink }]}>Shelves</Text>

      <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Find a page…"
          placeholderTextColor={theme.inkFaint}
          style={[styles.searchInput, { color: theme.ink }]}
          accessibilityLabel="Search your vault"
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {hits !== null ? (
          hits.length === 0 ? (
            <Card>
              <Text style={[styles.empty, { color: theme.inkSoft }]}>
                Nothing on the shelves matches “{query.trim()}” yet.
              </Text>
            </Card>
          ) : (
            hits.map((hit) => (
              <Card key={hit.ulid}>
                <Text style={[styles.pageTitle, { color: theme.ink }]}>{hit.title}</Text>
                <Text style={[styles.snippet, { color: theme.inkSoft }]}>{hit.snippet}</Text>
              </Card>
            ))
          )
        ) : shelves.length === 0 ? (
          <Card label="Your library">
            <Text style={[styles.empty, { color: theme.inkSoft }]}>
              The shelves are built as you live. Pages grow here from what you put down — each one
              showing where it came from.
            </Text>
          </Card>
        ) : (
          shelves.map((shelf) => (
            <View key={shelf.shelf} style={styles.shelfBlock}>
              <Eyebrow>{shelf.shelf}</Eyebrow>
              <Card style={styles.shelfCard}>
                {(pages.get(shelf.shelf) ?? []).map((page, i, arr) => (
                  <View
                    key={page.ulid}
                    style={[
                      styles.pageRow,
                      i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.line },
                    ]}
                  >
                    <Text style={[styles.pageTitle, { color: theme.ink }]}>{page.title}</Text>
                  </View>
                ))}
              </Card>
            </View>
          ))
        )}
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
  searchBox: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: space.m,
  },
  searchInput: {
    fontFamily: fonts.ui,
    fontSize: 15,
    paddingHorizontal: space.m,
    paddingVertical: 12,
  },
  scroll: { paddingBottom: space.xl },
  shelfBlock: { marginBottom: space.s },
  shelfCard: { paddingVertical: 4 },
  pageRow: { paddingVertical: 12 },
  pageTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  snippet: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  empty: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 21,
  },
});
