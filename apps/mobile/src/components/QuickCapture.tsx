import { applyRoute, parseRouteResult } from "@wovera/core";
import type { AppliedRoute } from "@wovera/core";
import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { routeCapture } from "../assistant/gemini";
import { remindersAvailable, scheduleReminder } from "../capture/notifications";
import { fonts, radius, space } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import { useVault } from "../vault/VaultProvider";

/**
 * The second brain's front door — "Put something down." One field; the
 * assistant files it (reminder / person / thread), shows its filing as a
 * chip, and the Ledger records it. Reminders schedule a local ping.
 */
export function QuickCapture({ onRouted }: { onRouted?: (applied: AppliedRoute) => void }) {
  const { theme } = useTheme();
  const vault = useVault();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [chip, setChip] = useState<string | null>(null);

  const submit = async () => {
    const capture = text.trim();
    if (!vault || !capture || busy) return;
    setBusy(true);
    setChip(null);
    Keyboard.dismiss();
    try {
      const raw = await routeCapture(capture);
      const route = parseRouteResult(raw ?? "", capture);
      const applied = await applyRoute(vault, capture, route);
      let chipText = applied.chip;
      if (applied.kind === "reminder" && applied.remindAtMs) {
        const rang = await scheduleReminder(applied.remindAtMs, applied.doc.title, capture);
        if (!rang && !remindersAvailable) chipText += " · ping arrives with the next app update";
        else if (!rang) chipText += " · notifications are off in system settings";
      }
      setText("");
      setChip(`✦ ${chipText}`);
      onRouted?.(applied);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Put something down…"
          placeholderTextColor={theme.inkFaint}
          style={[styles.input, { color: theme.ink }]}
          onSubmitEditing={() => void submit()}
          returnKeyType="done"
          accessibilityLabel="Quick capture"
        />
        {text.trim() ? (
          <Pressable onPress={() => void submit()} disabled={busy} hitSlop={8}>
            <Text style={[styles.hold, { color: theme.accentDeep }]}>
              {busy ? "Filing…" : "Hold it"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {chip ? <Text style={[styles.chip, { color: theme.held }]}>{chip}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.m },
  box: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.card,
    paddingRight: space.m,
  },
  input: {
    flex: 1,
    fontFamily: fonts.ui,
    fontSize: 15,
    paddingHorizontal: space.m,
    paddingVertical: 12,
  },
  hold: { fontFamily: fonts.uiBold, fontSize: 13 },
  chip: { fontFamily: fonts.uiMedium, fontSize: 13, marginTop: 6, paddingHorizontal: 2 },
});
