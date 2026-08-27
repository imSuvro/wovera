import { listThreads } from "@wovera/core";
import type { LedgerEntry, VaultDocument } from "@wovera/core";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { QuickCapture } from "../../components/QuickCapture";
import { Screen } from "../../components/Screen";
import { Tappable } from "../../components/Tappable";
import { TopRow } from "../../components/TopRow";
import { daysSince, shortDate } from "../../lib/dates";
import { fonts, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";
import { useVault } from "../../vault/VaultProvider";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const AWAY_MS = 8 * 60 * 60 * 1000;
const LAST_OPEN_KEY = "today_last_open_at";

function greetingForHour(hour: number): string {
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** A note counts in words, not digits — "two things", "three days ago". */
const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];
function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** "the 28th" — a note says the date the way a person would. */
function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

/** "today · 7:20 PM" / "3 Sep · 7:20 PM" — the clock chip's words. */
function clockLabel(remindAt: number, now: number): string {
  if (remindAt <= now) return "its moment has come";
  const d = new Date(remindAt);
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  const mins = String(d.getMinutes()).padStart(2, "0");
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  const time = `${h12}:${mins} ${ampm}`;
  const today = new Date(now);
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  return sameDay ? `today · ${time}` : `${shortDate(remindAt)} · ${time}`;
}

/** First substantial prose line of a page — for the daily line from the shelves. */
function firstLine(bodyMd: string): string {
  for (const raw of bodyMd.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("-") || line.startsWith("|")) continue;
    if (line.startsWith("[[") || line.startsWith("!") || line.startsWith(">")) continue;
    // Metadata lines ("Date: …", "Source: …", "Tags: …") are filing, not prose —
    // a short word before a colon at the line's start gives them away.
    if (/^[\w /-]{1,18}:\s/.test(line)) continue;
    return line.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_m, t: string, a?: string) => a ?? t);
  }
  return "";
}

/** A pull-quote is a breath, not a chapter — clamp at a sentence boundary. */
function clampQuote(text: string): string {
  if (text.length <= 200) return text;
  const cut = text.slice(0, 200);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return end > 60 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

interface Thread {
  doc: VaultDocument;
  clock: string | null;
}

/**
 * Today — the composed note (Pattern Book, Plate V). A note left on the
 * kitchen table: a salutation that owns the date, a quiet mouth to put
 * things down, continuity as prose on the ground, threads as tactile rows
 * with ember dots and clock chips, one real pull-quote, and doors at the
 * bottom. Cards are abolished here — everything lives on the room's floor.
 */
export default function TodayScreen() {
  const { theme } = useTheme();
  const vault = useVault();
  const [latest, setLatest] = useState<VaultDocument | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [line, setLine] = useState<{ text: string; from: VaultDocument } | null>(null);
  const [away, setAway] = useState<LedgerEntry[] | null>(null); // null = not shown
  const [awayOpen, setAwayOpen] = useState(false);
  const [filedChip, setFiledChip] = useState<string | null>(null);
  const chipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!vault) return;
    let cancelled = false;
    void (async () => {
      const [entries, wiki, openThreads] = await Promise.all([
        vault.listByType("journal", 1),
        vault.listByType("wiki", 200),
        listThreads(vault),
      ]);
      if (cancelled) return;
      setLatest(entries[0] ?? null);
      const now = Date.now();
      const withClocks: Thread[] = openThreads.map((doc) => ({
        doc,
        clock: doc.remindAt ? clockLabel(doc.remindAt, now) : null,
      }));
      // Soonest clock first; clockless threads wait at the end.
      withClocks.sort((a, b) => (a.doc.remindAt ?? Infinity) - (b.doc.remindAt ?? Infinity));
      setThreads(withClocks);
      if (wiki.length > 0) {
        // Deterministic daily pick: same page all LOCAL day, a different one
        // tomorrow. Anchored to local midnight (not UTC), and the candidates
        // are ordered by ulid so tending a page mid-day can't reshuffle the pick.
        const localMidnight = new Date(now);
        localMidnight.setHours(0, 0, 0, 0);
        const dayIndex = Math.floor(localMidnight.getTime() / 86_400_000);
        const candidates = wiki
          .map((doc) => ({ doc, text: firstLine(doc.bodyMd) }))
          .filter((c) => c.text.length > 20)
          .sort((a, b) => (a.doc.ulid < b.doc.ulid ? -1 : 1));
        const pick = candidates[dayIndex % Math.max(1, candidates.length)];
        if (pick) setLine({ text: clampQuote(pick.text), from: pick.doc });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vault, reloadKey]);

  // While you were away — shown only when true: gone > 8h AND the vault
  // changed in the meantime. "Gone" is real absence, so the clock is stamped
  // when the app slips to the background and re-checked when it returns —
  // a long-lived process that naps for a day still gets its welcome back.
  useEffect(() => {
    if (!vault) return;
    let cancelled = false;
    const check = async () => {
      const prevRaw = await vault.getSetting(LAST_OPEN_KEY);
      const now = Date.now();
      await vault.setSetting(LAST_OPEN_KEY, String(now));
      if (cancelled || !prevRaw) return;
      const prev = Number(prevRaw);
      if (!Number.isFinite(prev) || now - prev < AWAY_MS) return;
      const rows = (await vault.listLedger(80)).filter((r) => r.ts > prev);
      if (!cancelled && rows.length > 0) setAway(rows);
    };
    void check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
      else if (state === "background") void vault.setSetting(LAST_OPEN_KEY, String(Date.now()));
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [vault]);

  const onFiled = useCallback(
    (_applied: unknown, chip: string) => {
      // The filing chip lands in the threads list itself — already home.
      setFiledChip(`✦ ${chip}`);
      refresh();
      if (chipTimer.current) clearTimeout(chipTimer.current);
      chipTimer.current = setTimeout(() => setFiledChip(null), 4000);
    },
    [refresh],
  );
  useEffect(() => {
    return () => {
      if (chipTimer.current) clearTimeout(chipTimer.current);
    };
  }, []);

  const now = new Date();
  const gap = latest ? daysSince(latest.createdAt) : null;
  const lastWhen =
    gap === null
      ? ""
      : gap === 0
        ? "today"
        : gap === 1
          ? "yesterday"
          : `${numberWord(gap)} days ago`;

  return (
    <Screen>
      <TopRow minimal />
      <Text style={[styles.greet, { color: theme.ink }]}>{greetingForHour(now.getHours())}.</Text>
      <Text style={[styles.greetSub, { color: theme.inkSoft }]}>
        {DAYS[now.getDay()]}, the {ordinal(now.getDate())}.
      </Text>

      <QuickCapture onFiled={onFiled} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Continuity is prose on the ground, links inline in amber. */}
        <Text style={[styles.prose, { color: theme.inkSoft }]}>
          {away ? (
            <>
              While you were away, I held{" "}
              <Text
                style={{ color: theme.held }}
                onPress={() => setAwayOpen((o) => !o)}
                suppressHighlighting
              >
                {away.length === 1 ? "one thing" : `${numberWord(away.length)} things`}
              </Text>
              .{" "}
            </>
          ) : null}
          {latest ? (
            <>
              Your last entry —{" "}
              <Text
                style={{ color: theme.accentDeep }}
                onPress={() => router.push(`/page/${latest.ulid}`)}
                suppressHighlighting
              >
                {latest.title}
              </Text>
              , {lastWhen}.
            </>
          ) : (
            "The house is new. Your first words will start its memory — the lamp is waiting."
          )}
        </Text>
        {away && awayOpen ? (
          <Animated.View entering={FadeIn.duration(220)} style={styles.awayList}>
            {away.slice(0, 12).map((row) => (
              <Pressable
                key={row.id}
                onPress={() => row.docUlid && router.push(`/page/${row.docUlid}`)}
                style={styles.awayRow}
              >
                <Text style={[styles.awayText, { color: theme.held }]} numberOfLines={2}>
                  ✦ {row.summary}
                </Text>
              </Pressable>
            ))}
            {away.length > 12 ? (
              <Pressable onPress={() => router.push("/ledger")} style={styles.awayRow}>
                <Text style={[styles.awayText, { color: theme.inkFaint }]}>
                  …the rest are in the Ledger ›
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}

        <Text style={[styles.eyebrow, { color: theme.inkFaint }]}>THREADS BEING HELD</Text>
        {filedChip ? (
          <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(400)}>
            <Text style={[styles.filedChip, { color: theme.held }]}>{filedChip}</Text>
          </Animated.View>
        ) : null}
        {threads.length === 0 && !filedChip ? (
          <Text style={[styles.prose, { color: theme.inkFaint }]}>
            Nothing held yet. Tell the lamp to remind you of something and it will wait here with a
            clock.
          </Text>
        ) : (
          threads.map((t) => (
            <Tappable
              key={t.doc.ulid}
              onPress={() => router.push(`/page/${t.doc.ulid}`)}
              style={styles.threadRow}
              accessibilityLabel={t.doc.title}
            >
              <View
                style={[styles.dot, { backgroundColor: theme.accent, opacity: t.clock ? 1 : 0.45 }]}
              />
              <Text style={[styles.threadTitle, { color: theme.ink }]} numberOfLines={1}>
                {t.doc.title}
              </Text>
              {t.clock ? (
                <View style={[styles.clockChip, { borderColor: theme.line }]}>
                  <Text style={[styles.clockText, { color: theme.accentDeep }]}>{t.clock}</Text>
                </View>
              ) : null}
            </Tappable>
          ))
        )}

        {line ? (
          <Pressable
            onPress={() => router.push(`/page/${line.from.ulid}`)}
            style={styles.quoteBlock}
          >
            <Text style={[styles.quoteMark, { color: theme.accent }]}>“</Text>
            <Text style={[styles.quote, { color: theme.inkSoft }]}>{line.text}</Text>
            <Text style={[styles.quoteSource, { color: theme.inkFaint }]}>— {line.from.title}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Doors, not links — one centred row above the bar. */}
      <View style={styles.doorRow}>
        <Tappable onPress={() => router.push("/journal")} accessibilityLabel="The Journal">
          <Text style={[styles.door, { color: theme.inkSoft }]}>The Journal</Text>
        </Tappable>
        <Text style={[styles.doorSep, { color: theme.inkFaint }]}>·</Text>
        <Tappable onPress={() => router.push("/ledger")} accessibilityLabel="The Ledger">
          <Text style={[styles.door, { color: theme.inkSoft }]}>The Ledger</Text>
        </Tappable>
        <Text style={[styles.doorSep, { color: theme.inkFaint }]}>·</Text>
        <Tappable onPress={() => router.push("/rules")} accessibilityLabel="House Rules">
          <Text style={[styles.door, { color: theme.inkSoft }]}>House Rules</Text>
        </Tappable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greet: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38 },
  greetSub: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24, marginTop: 2 },
  scroll: { paddingBottom: space.l },
  prose: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, marginTop: space.m },
  awayList: { marginTop: space.s, paddingLeft: 2 },
  awayRow: { paddingVertical: 3 },
  awayText: { fontFamily: fonts.uiMedium, fontSize: 13, lineHeight: 19 },
  eyebrow: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    marginTop: space.l,
    marginBottom: 2,
  },
  filedChip: { fontFamily: fonts.uiMedium, fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  threadRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    gap: 10,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  threadTitle: { flex: 1, fontFamily: fonts.uiMedium, fontSize: 15 },
  clockChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  clockText: { fontFamily: fonts.uiMedium, fontSize: 11.5 },
  quoteBlock: { marginTop: space.xl, paddingLeft: 24, paddingRight: 2 },
  quoteMark: {
    position: "absolute",
    left: -2,
    top: -14,
    fontFamily: fonts.displaySemi,
    fontSize: 46,
  },
  quote: { fontFamily: fonts.bodyItalic, fontSize: 18, lineHeight: 28 },
  quoteSource: {
    fontFamily: fonts.ui,
    fontSize: 12,
    marginTop: 8,
    textAlign: "right",
  },
  doorRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingVertical: space.m,
  },
  door: { fontFamily: fonts.uiMedium, fontSize: 13, letterSpacing: 0.3 },
  doorSep: { fontFamily: fonts.ui, fontSize: 13 },
});
