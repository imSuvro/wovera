import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, space } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import type { ThemeMode } from "../theme/ThemeProvider";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function nowLabel(): string {
  const d = new Date();
  const h24 = d.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mins = String(d.getMinutes()).padStart(2, "0");
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${DAYS[d.getDay()]} · ${h12}:${mins} ${ampm}`;
}

const NEXT_MODE: Record<ThemeMode, ThemeMode> = { sky: "dusk", dusk: "linen", linen: "sky" };

/**
 * The quiet dated row every screen in the design opens with — day and time on
 * the left, the current skin on the right. Tapping the skin cycles
 * sky → dusk → linen (the House Rules theme override, persisted).
 */
export function TopRow() {
  const { theme, name, mode, setMode } = useTheme();
  const tag = mode === "sky" ? name : `${name} · pinned`;
  return (
    <View style={styles.row}>
      <Text style={[styles.text, { color: theme.inkFaint }]}>{nowLabel()}</Text>
      <Pressable
        onPress={() => setMode(NEXT_MODE[mode])}
        accessibilityRole="button"
        accessibilityLabel={`Theme: ${tag}. Tap to change.`}
        hitSlop={12}
      >
        <Text style={[styles.text, { color: theme.inkFaint }]}>{tag}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: space.l,
  },
  text: {
    fontFamily: fonts.ui,
    fontSize: 12,
    letterSpacing: 0.6,
  },
});
