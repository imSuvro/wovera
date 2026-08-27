import type { VaultDocument } from "@wovera/core";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { TopRow } from "../../components/TopRow";
import { daysSince, shortDate } from "../../lib/dates";
import { fonts, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";
import { useVault } from "../../vault/VaultProvider";

function greetingForHour(hour: number): string {
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** First substantial prose line of a page — for the daily line from the shelves. */
function firstLine(bodyMd: string): string {
  for (const raw of bodyMd.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("-") || line.startsWith("|")) continue;
    if (line.startsWith("Date:") || line.startsWith("[[") || line.startsWith("!")) continue;
    return line.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_m, t: string, a?: string) => a ?? t);
  }
  return "";
}

/**
 * Today — the note left on the kitchen table, now drawn from the real vault:
 * quiet continuity from the latest entry, a daily line from the shelves, and
 * the door to the Ledger. Threads arrive with quick capture (Phase 6).
 */
export default function TodayScreen() {
  const { theme } = useTheme();
  const vault = useVault();
  const [latest, setLatest] = useState<VaultDocument | null>(null);
  const [line, setLine] = useState<{ text: string; from: VaultDocument } | null>(null);
  const [ledgerCount, setLedgerCount] = useState(0);

  useEffect(() => {
    if (!vault) return;
    let cancelled = false;
    void (async () => {
      const [entries, wiki, ledgerRows] = await Promise.all([
        vault.listByType("journal", 1),
        vault.listByType("wiki", 200),
        vault.listLedger(200),
      ]);
      if (cancelled) return;
      setLatest(entries[0] ?? null);
      setLedgerCount(ledgerRows.length);
      if (wiki.length > 0) {
        // Deterministic daily pick: same page all day, a different one tomorrow.
        const dayIndex = Math.floor(Date.now() / 86_400_000);
        const candidates = wiki
          .map((doc) => ({ doc, text: firstLine(doc.bodyMd) }))
          .filter((c) => c.text.length > 20);
        const pick = candidates[dayIndex % Math.max(1, candidates.length)];
        if (pick) setLine({ text: pick.text, from: pick.doc });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vault]);

  const hour = new Date().getHours();
  const gap = latest ? daysSince(latest.createdAt) : null;

  return (
    <Screen>
      <TopRow />
      <Text style={[styles.greet, { color: theme.ink }]}>{greetingForHour(hour)}.</Text>

      <Card label="Quiet continuity">
        {latest ? (
          <Pressable onPress={() => router.push(`/page/${latest.ulid}`)}>
            <Text style={[styles.body, { color: theme.inkSoft }]}>
              Your last entry — <Text style={{ color: theme.ink }}>{latest.title}</Text>,{" "}
              {shortDate(latest.createdAt)}
              {gap !== null && gap > 0 ? ` · ${gap} ${gap === 1 ? "day" : "days"} ago` : " · today"}
              .
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.body, { color: theme.inkSoft }]}>
            This space fills as your days do — gently, and only with what you tell it.
          </Text>
        )}
      </Card>

      <Card label="Threads being held">
        <Text style={[styles.body, { color: theme.inkSoft }]}>
          Nothing yet. When you put things down, the ones that matter will wait for you here.
        </Text>
      </Card>

      {line ? (
        <Card label="From your shelves">
          <Pressable onPress={() => router.push(`/page/${line.from.ulid}`)}>
            <Text style={[styles.quote, { color: theme.inkSoft }]}>“{line.text}”</Text>
            <Text style={[styles.quoteSource, { color: theme.inkFaint }]}>— {line.from.title}</Text>
          </Pressable>
        </Card>
      ) : null}

      <Pressable onPress={() => router.push("/ledger")} accessibilityRole="link">
        <Text style={[styles.ledgerLink, { color: theme.inkFaint }]}>
          The Ledger — {ledgerCount} entries, nothing hidden ›
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greet: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 38,
    marginBottom: space.l,
  },
  body: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 21 },
  quote: { fontFamily: fonts.bodyItalic, fontSize: 16, lineHeight: 24 },
  quoteSource: { fontFamily: fonts.ui, fontSize: 12, marginTop: 6 },
  ledgerLink: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    marginTop: space.s,
    paddingVertical: 8,
  },
});
