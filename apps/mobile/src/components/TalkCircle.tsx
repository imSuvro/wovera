import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { fonts } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";

/** Halo canvas size; the glowing core sits in its center. */
const HALO = 300;
const CORE = 148;

/**
 * The Lamp. A radial-gradient core (honey light falling to ember at the rim)
 * inside a soft amber halo — drawn with SVG so it is identical on Android,
 * iOS, and web. Breathing is a Reanimated CSS animation: zero JS-thread cost,
 * and a still, warm glow when the OS asks for reduced motion.
 */
export function TalkCircle({ onPress }: { onPress?: () => void }) {
  const { name } = useTheme();
  const reducedMotion = useReducedMotion();
  const haloOpacity = name === "dusk" ? 0.5 : 0.35;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Tap and talk">
      <Animated.View
        style={[
          styles.wrap,
          !reducedMotion && {
            animationName: {
              "0%": { transform: [{ scale: 1 }], opacity: 1 },
              "50%": { transform: [{ scale: 1.035 }], opacity: 0.92 },
              "100%": { transform: [{ scale: 1 }], opacity: 1 },
            },
            animationDuration: "4.5s",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
          },
        ]}
      >
        <Svg width={HALO} height={HALO} viewBox={`0 0 ${HALO} ${HALO}`}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="35%" stopColor="#e0a458" stopOpacity={haloOpacity} />
              <Stop offset="70%" stopColor="#e0a458" stopOpacity={haloOpacity * 0.25} />
              <Stop offset="100%" stopColor="#e0a458" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="core" cx="50%" cy="42%" r="62%">
              <Stop offset="0%" stopColor="#f6d9a4" />
              <Stop offset="45%" stopColor="#eab263" />
              <Stop offset="80%" stopColor="#b97f35" />
              <Stop offset="100%" stopColor="#7d5320" />
            </RadialGradient>
          </Defs>
          <Circle cx={HALO / 2} cy={HALO / 2} r={HALO / 2} fill="url(#halo)" />
          <Circle cx={HALO / 2} cy={HALO / 2} r={CORE / 2} fill="url(#core)" />
        </Svg>
        <View style={styles.labelWrap} pointerEvents="none">
          <Text style={styles.label}>TAP AND TALK</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: HALO,
    height: HALO,
    alignItems: "center",
    justifyContent: "center",
  },
  labelWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: "#241a0c",
  },
});
