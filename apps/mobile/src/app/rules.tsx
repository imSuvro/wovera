import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { Tappable } from "../components/Tappable";
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
  const [tone, setTone] = useState<Tone>("Gentle");

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
      void vault.appendLedger("rule", `How Wovera speaks — set to ${next}`);
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
        <Card label="The skeleton — how this house stands" index={0}>
          {[
            "Your words are kept verbatim",
            "Sources are never edited",
            "The Ledger is append-only",
            "Every AI action is visible and undoable",
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

        <Card label="How Wovera speaks" index={1}>
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

        <Card label="Theme" index={2}>
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

        <Card label="Rule changes are remembered" index={3}>
          <Text style={[styles.hint, { color: theme.inkSoft }]}>
            Every change on this screen is written in the Ledger — the house remembers how you asked
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
});
