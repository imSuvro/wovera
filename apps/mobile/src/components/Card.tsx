import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { ViewStyle } from "react-native";
import { radius, space } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import { Eyebrow } from "./Eyebrow";

/**
 * The design system's card: soft surface, hairline border, optional eyebrow.
 * Every composed screen in the founding artifact is built from these.
 */
export function Card({
  label,
  children,
  style,
}: {
  label?: string;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }, style]}>
      {label ? <Eyebrow>{label}</Eyebrow> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.m,
    marginBottom: space.s + 4,
  },
});
