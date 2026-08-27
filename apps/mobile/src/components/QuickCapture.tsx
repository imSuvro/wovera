import { applyRoute, parseRouteResult } from "@wovera/core";
import type { AppliedRoute } from "@wovera/core";
import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { routeCapture } from "../assistant/gemini";
import { remindersAvailable, scheduleReminder } from "../capture/notifications";
import { fonts, space } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import { useVault } from "../vault/VaultProvider";

/**
 * Quick capture — a quiet mouth, not a form (Pattern Book, Plate V).
 * A ghost pill on the ground; on focus it grows to 96pt and "Hold it"
 * fades in. The assistant files what's said (reminder / person / thread);
 * the filing chip lands in the threads list itself — already home — so
 * this component reports it upward instead of showing it.
 */
export function QuickCapture({
  onFiled,
}: {
  onFiled?: (applied: AppliedRoute, chip: string) => void;
}) {
  const { theme } = useTheme();
  const vault = useVault();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = focused || text.length > 0;

  const submit = async () => {
    const capture = text.trim();
    if (!vault || !capture || busy) return;
    setBusy(true);
    Keyboard.dismiss();
    try {
      const raw = await routeCapture(capture);
      const route = parseRouteResult(raw ?? "", capture);
      const applied = await applyRoute(vault, capture, route);
      let chipText = applied.chip;
      if (applied.kind === "reminder" && applied.remindAtMs) {
        const rang = await scheduleReminder(applied.remindAtMs, applied.doc.title, capture);
        if (!rang && !remindersAvailable) chipText += " · no bell on this phone yet";
        else if (!rang) chipText += " · the bell is silenced on this phone";
      }
      setText("");
      onFiled?.(applied, chipText);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Animated.View
      style={[
        styles.pill,
        { borderColor: theme.line },
        {
          // The mouth opens: 46 → 96pt, gently.
          height: open ? 96 : 46,
          transitionProperty: "height",
          transitionDuration: "200ms",
        },
      ]}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        multiline
        placeholder="Put something down…"
        placeholderTextColor={theme.inkFaint}
        style={[styles.input, { color: theme.ink }]}
        accessibilityLabel="Put something down"
      />
      {open ? (
        <Animated.View entering={FadeInDown.duration(360)} style={styles.holdWrap}>
          <Pressable onPress={() => void submit()} disabled={busy || !text.trim()} hitSlop={10}>
            {/* The plate's exact words, always — busy just dims the light. */}
            <Text
              style={[
                styles.hold,
                { color: theme.accentDeep, opacity: busy || !text.trim() ? 0.45 : 1 },
              ]}
            >
              Hold it
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: 22,
    marginTop: space.m,
    marginBottom: space.s,
  },
  input: {
    flex: 1,
    fontFamily: fonts.ui,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: space.m + 2,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: "top",
  },
  holdWrap: { position: "absolute", right: space.m, bottom: 10 },
  hold: { fontFamily: fonts.uiBold, fontSize: 13 },
});
