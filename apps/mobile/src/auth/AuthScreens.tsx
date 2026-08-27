import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { TalkCircle } from "../components/TalkCircle";
import { Tappable } from "../components/Tappable";
import { fonts, radius, space } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import { useSync } from "../sync/SyncProvider";

/**
 * The gate (product decision: sign-in required at first launch), the
 * twelve words shown once, and the restore path — all in the house style.
 */

export function AuthGate() {
  const { theme } = useTheme();
  const { signIn, signUp } = useSync();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy || !email.trim() || password.length < 8) {
      setError(password.length < 8 ? "Password needs at least 8 characters." : null);
      return;
    }
    setBusy(true);
    setError(null);
    const err =
      mode === "in" ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <TalkCircle label="WOVERA" />
        <Text style={[styles.title, { color: theme.ink }]}>
          {mode === "in" ? "Welcome back." : "A house for everything."}
        </Text>
        <Text style={[styles.sub, { color: theme.inkSoft }]}>
          {mode === "in"
            ? "Sign in and the lamp comes on."
            : "Your second brain — private, yours, everywhere you are."}
        </Text>
      </View>

      <Card label={mode === "in" ? "Sign in" : "Create your account"}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.inkFaint}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.input, { color: theme.ink, borderColor: theme.line }]}
          accessibilityLabel="Email"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password (8+ characters)"
          placeholderTextColor={theme.inkFaint}
          secureTextEntry
          style={[styles.input, { color: theme.ink, borderColor: theme.line }]}
          accessibilityLabel="Password"
        />
        {error ? <Text style={[styles.error, { color: theme.inkSoft }]}>{error}</Text> : null}
        <Tappable onPress={() => void submit()} disabled={busy}>
          <View style={[styles.primary, { backgroundColor: theme.accent }]}>
            <Text style={styles.primaryText}>
              {busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}
            </Text>
          </View>
        </Tappable>
        <Tappable onPress={() => setMode(mode === "in" ? "up" : "in")} hitSlop={8}>
          <Text style={[styles.switch, { color: theme.accentDeep }]}>
            {mode === "in" ? "New here? Create an account" : "Already have one? Sign in"}
          </Text>
        </Tappable>
      </Card>

      <Text style={[styles.promise, { color: theme.inkFaint }]}>
        Your words are encrypted on this device before they ever leave it. Nobody — including us —
        can read your vault.
      </Text>
    </Screen>
  );
}

export function RecoveryPhraseScreen() {
  const { theme } = useTheme();
  const { mnemonic, confirmPhraseSaved } = useSync();
  const words = (mnemonic ?? "").split(" ");
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.ink }]}>Your twelve words.</Text>
        <Text style={[styles.sub, { color: theme.inkSoft }]}>
          These words are the only key to your vault on a new device. Write them down on paper, in
          order, and keep them somewhere real. They are shown only once — and if they're ever lost
          along with your devices, nobody can recover your vault. Not even us. That's what private
          means.
        </Text>
        <Card label="Write these down">
          <View style={styles.wordGrid}>
            {words.map((word, i) => (
              <View
                key={i}
                style={[styles.word, { borderColor: theme.line, backgroundColor: theme.surface2 }]}
              >
                <Text style={[styles.wordIndex, { color: theme.inkFaint }]}>{i + 1}</Text>
                <Text style={[styles.wordText, { color: theme.ink }]}>{word}</Text>
              </View>
            ))}
          </View>
        </Card>
        <Tappable onPress={confirmPhraseSaved}>
          <View style={[styles.primary, { backgroundColor: theme.accent }]}>
            <Text style={styles.primaryText}>I've written them down</Text>
          </View>
        </Tappable>
      </ScrollView>
    </Screen>
  );
}

export function RestorePhraseScreen() {
  const { theme } = useTheme();
  const { restoreFromPhrase, signOut } = useSync();
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = await restoreFromPhrase(words);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <Screen>
      <Text style={[styles.title, { color: theme.ink }]}>Welcome back.</Text>
      <Text style={[styles.sub, { color: theme.inkSoft }]}>
        This account already holds a vault. Enter your twelve words to open it on this device.
      </Text>
      <Card label="Your twelve words">
        <TextInput
          value={words}
          onChangeText={setWords}
          placeholder="twelve words, separated by spaces"
          placeholderTextColor={theme.inkFaint}
          multiline
          autoCapitalize="none"
          style={[styles.phraseInput, { color: theme.ink }]}
          accessibilityLabel="Recovery phrase"
        />
        {error ? <Text style={[styles.error, { color: theme.inkSoft }]}>{error}</Text> : null}
        <Tappable onPress={() => void submit()} disabled={busy}>
          <View style={[styles.primary, { backgroundColor: theme.accent }]}>
            <Text style={styles.primaryText}>{busy ? "Opening…" : "Open my vault"}</Text>
          </View>
        </Tappable>
      </Card>
      <Tappable onPress={() => void signOut()} hitSlop={8}>
        <Text style={[styles.switch, { color: theme.inkFaint }]}>Sign out instead</Text>
      </Tappable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", marginTop: space.l, marginBottom: space.l },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 36,
    marginTop: space.m,
    textAlign: "center",
  },
  sub: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 21,
    marginTop: space.s,
    marginBottom: space.m,
    textAlign: "center",
  },
  input: {
    fontFamily: fonts.ui,
    fontSize: 15,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: space.m,
    paddingVertical: 11,
    marginBottom: space.s,
  },
  phraseInput: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 90,
    textAlignVertical: "top",
    marginBottom: space.s,
  },
  primary: {
    borderRadius: radius.card,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: space.s,
  },
  primaryText: { fontFamily: fonts.uiBold, fontSize: 14, letterSpacing: 0.6, color: "#241a0c" },
  switch: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: space.m,
  },
  error: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 18, marginBottom: 4 },
  promise: {
    fontFamily: fonts.ui,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
    marginTop: "auto",
    marginBottom: space.l,
  },
  wordGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  word: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  wordIndex: { fontFamily: fonts.ui, fontSize: 11 },
  wordText: { fontFamily: fonts.bodyMedium, fontSize: 15 },
});
