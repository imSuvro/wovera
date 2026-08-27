import { StyleSheet, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";

/**
 * The quiet "reading your story" indicator: three amber dots breathing in
 * sequence. CSS keyframes on the UI thread; still dots under reduced motion.
 */
export function ThinkingDots() {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  return (
    <View style={styles.row} accessibilityLabel="Thinking">
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: theme.accent },
            !reduced && {
              animationName: {
                "0%": { opacity: 0.25, transform: [{ scale: 0.85 }] },
                "30%": { opacity: 1, transform: [{ scale: 1 }] },
                "60%": { opacity: 0.25, transform: [{ scale: 0.85 }] },
                "100%": { opacity: 0.25, transform: [{ scale: 0.85 }] },
              },
              animationDuration: "1.4s",
              animationDelay: `${i * 0.18}s`,
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-in-out",
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, opacity: 0.4 },
});
