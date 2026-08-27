import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { fonts } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";

const SIZE = 128;

/**
 * The Lamp's talk circle. The breathing is a Reanimated CSS animation — it
 * runs entirely off the JS thread, costing the app zero frames (pillar 4).
 * With OS reduce-motion on, it holds a static warm glow instead.
 */
export function TalkCircle({ onPress }: { onPress?: () => void }) {
  const { theme, name } = useTheme();
  const reducedMotion = useReducedMotion();

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Tap and talk">
      <Animated.View
        style={[
          styles.circle,
          {
            backgroundColor: theme.accent,
            shadowColor: theme.accent,
            // Dusk lets the lamp glow harder than daylight does.
            shadowOpacity: name === "dusk" ? 0.55 : 0.3,
          },
          !reducedMotion && {
            animationName: {
              "0%": { transform: [{ scale: 1 }] },
              "50%": { transform: [{ scale: 1.045 }] },
              "100%": { transform: [{ scale: 1 }] },
            },
            animationDuration: "4.5s",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
          },
        ]}
      >
        <Text style={[styles.label, { color: "#241a0c" }]}>TAP AND TALK</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 28,
  },
  label: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 1.2,
  },
});
