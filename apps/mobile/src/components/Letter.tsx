import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ViewStyle } from "react-native";
import { fonts } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";

/**
 * The Letter — the assistant's only surface (Pattern Book, PB-5 / Plate IV).
 * Warm-dark ground, a 2pt amber left edge like a wax-sealed margin, the
 * label in quiet small caps. Everything Wovera says arrives on this paper;
 * source chips live inside the letter, never appended after it.
 */
export function Letter({
  label,
  children,
  style,
}: {
  label: string;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const { name, theme } = useTheme();
  const ground = name === "dusk" ? "#241d24" : "#f6eee1";
  return (
    <View
      style={[styles.letter, { backgroundColor: ground, borderLeftColor: theme.accent }, style]}
    >
      <Text style={[styles.label, { color: theme.accentDeep }]}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  letter: {
    borderRadius: 12,
    borderLeftWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  label: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
});
