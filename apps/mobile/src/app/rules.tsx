import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "../components/Card";
import { PersonMark } from "../components/PersonMark";
import { Screen } from "../components/Screen";
import { Tappable } from "../components/Tappable";
import { shortDate } from "../lib/dates";
import { recoverMnemonic } from "../sync/keyStore";
import { useSync } from "../sync/SyncProvider";
import { fonts, radius, space } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import type { ThemeMode } from "../theme/ThemeProvider";
import { useVault } from "../vault/VaultProvider";

const TONES = ["Gentle", "Straight", "Coach"] as const;
export type Tone = (typeof TONES)[number];

const THEME_CHOICES: { mode: ThemeMode; label: string }[] = [
  { mode: "sky", label: "Follows the sky" },
  { mode: "dusk", label: "Always dusk" },
  { mode: "linen", label: "Always linen" },
];

/**
 * House Rules — the skeleton shown proudly and locked; everything grown
 * from use is yours to shape. (The founding artifact's chapter eleven.)
 */
export default function RulesScreen() {
  const { theme, mode, setMode } = useTheme();
  const vault = useVault();
  const { account, status, lastSync, syncNow, signOut, error: syncError } = useSync();
  const [tone, setTone] = useState<Tone>("Gentle");
  // Leaving is easy to do by accident, so the door asks once.
  const [leaving, setLeaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // The twelve words, fetched only when deliberately asked for.
  const [words, setWords] = useState<string[] | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  const askToLeave = () => {
    if (!leaving) {
      setLeaving(true);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
      leaveTimer.current = setTimeout(() => setLeaving(false), 4000);
      return;
    }
    setLeaving(false);
    void signOut();
  };

  const syncLine =
    status === "off"
      ? "This house keeps everything on this phone alone."
      : lastSync
        ? `${lastSync.pushed} sent up · ${lastSync.pulled} brought down, last time`
        : "Nothing carried yet — it happens quietly as you write.";

  useEffect(() => {
    if (!vault) return;
    void vault.getSetting("voice_tone").then((v) => {
      if (v === "Straight" || v === "Coach" || v === "Gentle") setTone(v);
    });
  }, [vault]);

  const chooseTone = (next: Tone) => {
    setTone(next);
    if (vault) {
      void vault.setSetting("voice_tone", next);
      void vault.appendLedger("rule", `How Wovera speaks — now ${next}`);
    }
  };

  const chooseTheme = (next: ThemeMode) => {
    setMode(next);
    if (vault) void vault.appendLedger("rule", `Theme — set to ${next}`);
  };

  return (
    <Screen>
      <Tappable onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.back, { color: theme.inkFaint }]}>‹ Back</Text>
      </Tappable>
      <Text style={[styles.title, { color: theme.ink }]}>House Rules</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {account ? (
          <Card label="Whose house this is" index={0}>
            <View style={styles.youRow}>
              {account.avatarUrl ? (
                <Image source={{ uri: account.avatarUrl }} style={styles.avatar} />
              ) : (
                <PersonMark name={account.name ?? account.email ?? "You"} size={44} />
              )}
              <View style={styles.youText}>
                <Text style={[styles.youName, { color: theme.ink }]} numberOfLines={1}>
                  {account.name ?? account.email ?? "You"}
                </Text>
                <Text style={[styles.youMeta, { color: theme.inkFaint }]} numberOfLines={1}>
                  {account.name && account.email ? `${account.email} · ` : ""}
                  {account.provider === "google" ? "came in with Google" : "came in by email"}
                  {account.since ? ` · here since ${shortDate(account.since)}` : ""}
                </Text>
              </View>
            </View>
            <Text style={[styles.hint, { color: theme.inkSoft }]}>{syncLine}</Text>
            {syncError ? (
              <Text style={[styles.hint, { color: theme.accentDeep }]}>{syncError}</Text>
            ) : null}
            <View style={styles.accountActions}>
              <Tappable
                onPress={() => {
                  if (syncing) return;
                  setSyncing(true);
                  void syncNow().finally(() => setSyncing(false));
                }}
                hitSlop={8}
              >
                <Text
                  style={[styles.action, { color: theme.accentDeep, opacity: syncing ? 0.45 : 1 }]}
                >
                  Carry it up now
                </Text>
              </Tappable>
              <Tappable onPress={askToLeave} hitSlop={8}>
                <Text
                  style={[styles.action, { color: leaving ? theme.accentDeep : theme.inkFaint }]}
                >
                  {leaving ? "Tap again to leave" : "Leave this house"}
                </Text>
              </Tappable>
            </View>
            <Text style={[styles.hint, { color: theme.inkFaint }]}>
              Leaving signs you out on this phone. Your words stay where they are, and your twelve
              words bring them back.
            </Text>
          </Card>
        ) : null}

        {status !== "off" ? (
          <Card label="The twelve words" index={1}>
            {words ? (
              <>
                <View style={styles.wordGrid}>
                  {words.map((word, i) => (
                    <View
                      key={i}
                      style={[
                        styles.word,
                        { borderColor: theme.line, backgroundColor: theme.surface2 },
                      ]}
                    >
                      <Text style={[styles.wordIndex, { color: theme.inkFaint }]}>{i + 1}</Text>
                      <Text style={[styles.wordText, { color: theme.ink }]}>{word}</Text>
                    </View>
                  ))}
                </View>
                <Tappable onPress={() => setWords(null)} hitSlop={8}>
                  <Text style={[styles.action, { color: theme.inkFaint }]}>Put them away</Text>
                </Tappable>
              </>
            ) : (
              <>
                <Text style={[styles.hint, { color: theme.inkSoft, marginTop: 0 }]}>
                  These twelve words are the only key to your vault on another device. Nobody can
                  recover them for you — not us, not anyone. Write them on paper.
                </Text>
                <Tappable
                  onPress={() => {
                    void recoverMnemonic().then((phrase) => {
                      if (phrase) setWords(phrase.split(" "));
                    });
                  }}
                  hitSlop={8}
                >
                  <Text style={[styles.action, { color: theme.accentDeep }]}>
                    Show me my twelve words
                  </Text>
                </Tappable>
              </>
            )}
          </Card>
        ) : null}

        <Card label="The skeleton — how this house stands" index={2}>
          {[
            "Your words are kept verbatim",
            "Sources are never edited",
            "The Ledger is append-only",
            "Everything Wovera does is visible and undoable",
          ].map((rule) => (
            <View key={rule} style={[styles.lockRow, { borderBottomColor: theme.line }]}>
              <Text style={[styles.lockText, { color: theme.inkSoft }]}>{rule}</Text>
              <Text style={[styles.lockTag, { color: theme.inkFaint }]}>locked</Text>
            </View>
          ))}
          <Text style={[styles.lockNote, { color: theme.inkFaint }]}>
            These cannot be changed — they are what makes Wovera trustworthy.
          </Text>
        </Card>

        <Card label="How Wovera speaks" index={3}>
          <View style={styles.choiceRow}>
            {TONES.map((t) => (
              <Tappable key={t} onPress={() => chooseTone(t)}>
                <View
                  style={[
                    styles.choice,
                    { borderColor: tone === t ? theme.accent : theme.line },
                    tone === t && { backgroundColor: theme.surface2 },
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      { color: tone === t ? theme.accentDeep : theme.inkSoft },
                    ]}
                  >
                    {t}
                  </Text>
                </View>
              </Tappable>
            ))}
          </View>
          <Text style={[styles.hint, { color: theme.inkFaint }]}>
            Gentle like a friend · Straight like a mirror · Coach like a corner-man.
          </Text>
        </Card>

        <Card label="The light in the house" index={4}>
          <View style={styles.choiceRow}>
            {THEME_CHOICES.map((c) => (
              <Tappable key={c.mode} onPress={() => chooseTheme(c.mode)}>
                <View
                  style={[
                    styles.choice,
                    { borderColor: mode === c.mode ? theme.accent : theme.line },
                    mode === c.mode && { backgroundColor: theme.surface2 },
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      { color: mode === c.mode ? theme.accentDeep : theme.inkSoft },
                    ]}
                  >
                    {c.label}
                  </Text>
                </View>
              </Tappable>
            ))}
          </View>
          <Text style={[styles.hint, { color: theme.inkFaint }]}>
            Dusk after seven, linen by day — or pin the one you love.
          </Text>
        </Card>

        <Card label="Rule changes are remembered" index={5}>
          <Text style={[styles.hint, { color: theme.inkSoft }]}>
            Every change you make here is written in the Ledger — the house remembers how you asked
            it to behave.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: fonts.uiMedium, fontSize: 14, marginBottom: space.m },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38, marginBottom: space.m },
  scroll: { paddingBottom: space.xxl },
  lockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  lockText: { fontFamily: fonts.ui, fontSize: 14, flex: 1 },
  lockTag: { fontFamily: fonts.uiBold, fontSize: 10, letterSpacing: 1.2 },
  lockNote: { fontFamily: fonts.ui, fontSize: 12, marginTop: 10, lineHeight: 17 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  choiceText: { fontFamily: fonts.uiMedium, fontSize: 13 },
  hint: { fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  youRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  youText: { flex: 1 },
  youName: { fontFamily: fonts.bodyMedium, fontSize: 17 },
  youMeta: { fontFamily: fonts.ui, fontSize: 11.5, marginTop: 2 },
  accountActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: space.s,
  },
  action: { fontFamily: fonts.uiBold, fontSize: 13, paddingVertical: 6 },
  wordGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  word: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  wordIndex: { fontFamily: fonts.ui, fontSize: 10 },
  wordText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
});
