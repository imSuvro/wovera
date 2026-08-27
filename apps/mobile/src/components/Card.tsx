import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import type { ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { radius, space } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import { Eyebrow } from "./Eyebrow";

/**
 * The design system's card: soft surface, hairline border, optional eyebrow —
 * and it ARRIVES rather than appears: a small rise-and-settle on mount,
 * staggered by `index` when several share a screen. Reanimated entering
 * animations run on the UI thread and respect reduced motion globally.
 */
export function Card({
  label,
  children,
  style,
  index = 0,
}: {
  label?: string;
  children: ReactNode;
  style?: ViewStyle;
  /** Position among siblings — staggers the entrance (60ms per step). */
  index?: number;
}) {
  const { theme } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(360).delay(index * 60)}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }, style]}
    >
      {label ? <Eyebrow>{label}</Eyebrow> : null}
      {children}
    </Animated.View>
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
