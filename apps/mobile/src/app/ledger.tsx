import { restoreFromLedger } from "@wovera/core";
import type { LedgerEntry, LedgerKind } from "@wovera/core";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { shortDate } from "../lib/dates";
import { fonts, space } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import { useVault } from "../vault/VaultProvider";

/**
 * The Ledger — every action taken on the vault, append-only, oldest to
 * newest history readable at a glance. The trust mechanism as a room.
 */
export default function LedgerScreen() {
  const { theme, name } = useTheme();
  const vault = useVault();
  const [rows, setRows] = useState<LedgerEntry[]>([]);
  const [restoring, setRestoring] = useState<number | null>(null);

  const reload = useCallback(() => {
    if (!vault) return;
    void vault.listLedger(200).then(setRows);
  }, [vault]);

  useEffect(() => {
    reload();
  }, [reload]);

  const restore = async (row: LedgerEntry) => {
    if (!vault || restoring !== null) return;
    setRestoring(row.id);
    try {
      await restoreFromLedger(vault, row);
      reload();
    } finally {
      setRestoring(null);
    }
  };

  const pillColors: Record<LedgerKind, { bg: string; fg: string }> =
    name === "dusk"
      ? {
          journal: { bg: "#33253a", fg: "#d3a1c9" },
          held: { bg: "#233320", fg: "#aec7a7" },
          woven: { bg: "#35301f", fg: "#d8bc7e" },
          tidy: { bg: "#232b3a", fg: "#9db4d8" },
          rule: { bg: "#2b2734", fg: "#a89fb3" },
        }
      : {
          journal: { bg: "#f0e0ec", fg: "#8a4f7d" },
          held: { bg: "#e6ecdf", fg: "#4a6b44" },
          woven: { bg: "#f1e8d6", fg: "#7d4f12" },
          tidy: { bg: "#e2e8f2", fg: "#3e5a80" },
          rule: { bg: "#eae5ef", fg: "#6f6579" },
        };

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
        <Text style={[styles.back, { color: theme.inkFaint }]}>‹ Back</Text>
      </Pressable>
      <Text style={[styles.title, { color: theme.ink }]}>The Ledger</Text>
      <Text style={[styles.sub, { color: theme.inkSoft }]}>
        Everything done on your behalf, in order, forever. Nothing here can be rewritten.
      </Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {rows.map((row) => {
          const pill = pillColors[row.kind];
          return (
            <View key={row.id} style={[styles.row, { borderBottomColor: theme.line }]}>
              <Text style={[styles.date, { color: theme.inkFaint }]}>{shortDate(row.ts)}</Text>
              <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                <Text style={[styles.pillText, { color: pill.fg }]}>{row.kind}</Text>
              </View>
              <View style={styles.summaryCol}>
                <Text style={[styles.summary, { color: theme.inkSoft }]} numberOfLines={2}>
                  {row.summary}
                </Text>
                {row.diffRef ? (
                  <Pressable onPress={() => void restore(row)} hitSlop={8}>
                    <Text style={[styles.restore, { color: theme.accentDeep }]}>
                      {restoring === row.id ? "Restoring…" : "Restore the page to before this"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: fonts.uiMedium, fontSize: 14, marginBottom: space.m },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 36 },
  sub: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: space.m },
  scroll: { paddingBottom: space.xxl },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  date: { fontFamily: fonts.ui, fontSize: 11, width: 78, marginTop: 3 },
  pill: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  pillText: {
    fontFamily: fonts.uiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  summaryCol: { flex: 1 },
  summary: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 19 },
  restore: { fontFamily: fonts.uiMedium, fontSize: 12, marginTop: 4 },
});
