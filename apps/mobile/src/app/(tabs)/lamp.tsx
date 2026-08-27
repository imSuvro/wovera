import type { VaultDocument } from "@wovera/core";
import { router } from "expo-router";
import { useState } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { TalkCircle } from "../../components/TalkCircle";
import { TopRow } from "../../components/TopRow";
import { Waveform } from "../../components/Waveform";
import { useSpeechCapture } from "../../capture/useSpeechCapture";
import { fonts, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";
import { useVault } from "../../vault/VaultProvider";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Placeholder title until the AI names entries in Phase 5. */
function entryTitle(now = new Date()): string {
  const part =
    now.getHours() < 5
      ? "Night"
      : now.getHours() < 12
        ? "Morning"
        : now.getHours() < 17
          ? "Afternoon"
          : "Evening";
  return `${part} entry · ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

/**
 * The Lamp — capture, live. Three moments: the lamp waiting; listening with
 * the live transcript in the book voice; and "kept" — saved verbatim with
 * the raw audio beside it. Typing is the quiet fallback, always available.
 */
export default function LampScreen() {
  const { theme } = useTheme();
  const vault = useVault();
  const { supported, state, start, stop } = useSpeechCapture();
  const [typed, setTyped] = useState<string | null>(null); // null = not typing
  const [kept, setKept] = useState<VaultDocument | null>(null);
  const [saving, setSaving] = useState(false);

  const listening = state.status === "listening" || state.status === "stopping";
  const liveText = [state.finalText, state.interimText].filter(Boolean).join(" ");

  const keepEntry = async (bodyMd: string, audioUri: string | null) => {
    if (!vault || !bodyMd.trim() || saving) return;
    setSaving(true);
    try {
      const doc = await vault.createDocument({
        type: "journal",
        title: entryTitle(),
        bodyMd: bodyMd.trim(),
        audioUri,
      });
      setKept(doc);
      setTyped(null);
    } finally {
      setSaving(false);
    }
  };

  const onCirclePress = () => {
    setKept(null);
    if (!supported) {
      // Voice needs the build that carries the speech module — typing works now.
      setTyped((t) => t ?? "");
      return;
    }
    if (listening) {
      stop();
      // Save on the next tick with whatever was stitched; audio uri arrives
      // via audioend just before end — state already holds it by then.
      setTimeout(() => {
        void keepEntry(
          [state.finalText, state.interimText].filter(Boolean).join(" "),
          state.audioUri,
        );
      }, 350);
    } else {
      void start();
    }
  };

  return (
    <Screen>
      <TopRow />
      <Text style={[styles.greet, { color: theme.ink }]}>The lamp is on.</Text>
      <Text style={[styles.sub, { color: theme.inkSoft }]}>
        {listening
          ? "Listening. Take all the time you need."
          : "Talk whenever you're ready. Or type, if the house is quiet."}
      </Text>

      <View style={styles.middle}>
        {typed === null ? (
          <>
            <TalkCircle
              onPress={onCirclePress}
              listening={listening}
              label={listening ? "TAP TO FINISH" : "TAP AND TALK"}
            />
            {listening ? <Waveform volume={state.volume} /> : null}
          </>
        ) : null}

        {listening && liveText ? (
          <ScrollView style={styles.liveWrap} showsVerticalScrollIndicator={false}>
            <Card label="Your words, as spoken">
              <Text style={[styles.live, { color: theme.ink }]}>
                {state.finalText}
                {state.interimText ? (
                  <Text style={{ color: theme.inkSoft }}> {state.interimText}</Text>
                ) : null}
              </Text>
            </Card>
          </ScrollView>
        ) : null}

        {typed !== null ? (
          <View style={styles.typedWrap}>
            <Card label="Write it down">
              <TextInput
                value={typed}
                onChangeText={setTyped}
                multiline
                autoFocus
                placeholder="However it comes out is right."
                placeholderTextColor={theme.inkFaint}
                style={[styles.typedInput, { color: theme.ink }]}
              />
            </Card>
            <View style={styles.typedActions}>
              <Pressable onPress={() => setTyped(null)} hitSlop={8}>
                <Text style={[styles.quietAction, { color: theme.inkFaint }]}>Not now</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  void keepEntry(typed, null);
                }}
                hitSlop={8}
                disabled={saving || !typed.trim()}
              >
                <Text style={[styles.keepAction, { color: theme.accentDeep }]}>
                  {saving ? "Keeping…" : "Keep this"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {kept ? (
          <Pressable onPress={() => router.push(`/page/${kept.ulid}`)} style={styles.keptWrap}>
            <Card label="Kept exactly">
              <Text style={[styles.keptTitle, { color: theme.ink }]}>{kept.title}</Text>
              <Text style={[styles.keptSub, { color: theme.inkSoft }]}>
                Word for word{kept.audioUri ? ", audio beside it" : ""}. Written in the Ledger. Tap
                to read.
              </Text>
            </Card>
          </Pressable>
        ) : null}

        {state.error ? (
          <Text style={[styles.error, { color: theme.inkSoft }]}>{state.error}</Text>
        ) : null}
      </View>

      {typed === null && !listening ? (
        <Pressable onPress={() => setTyped("")} hitSlop={8}>
          <Text style={[styles.typeInstead, { color: theme.inkFaint }]}>type instead</Text>
        </Pressable>
      ) : null}
      <Text style={[styles.promise, { color: theme.inkFaint }]}>
        Your words are kept exactly. Nothing is cleaned up unless you ask.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greet: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38 },
  sub: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 21, marginTop: space.s },
  middle: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.m },
  liveWrap: { alignSelf: "stretch", maxHeight: 220 },
  live: { fontFamily: fonts.body, fontSize: 17, lineHeight: 27 },
  typedWrap: { alignSelf: "stretch" },
  typedInput: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 26,
    minHeight: 140,
    textAlignVertical: "top",
  },
  typedActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: space.s,
  },
  quietAction: { fontFamily: fonts.uiMedium, fontSize: 14, padding: space.s },
  keepAction: { fontFamily: fonts.uiBold, fontSize: 14, padding: space.s },
  keptWrap: { alignSelf: "stretch" },
  keptTitle: { fontFamily: fonts.bodyMedium, fontSize: 16 },
  keptSub: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 19, marginTop: 4 },
  error: { fontFamily: fonts.ui, fontSize: 13, textAlign: "center" },
  typeInstead: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 6,
  },
  promise: {
    fontFamily: fonts.ui,
    fontSize: 12.5,
    textAlign: "center",
    marginBottom: space.l,
  },
});
