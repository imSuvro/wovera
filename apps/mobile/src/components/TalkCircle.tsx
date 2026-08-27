import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { fonts } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";

/** Halo canvas size; the glowing core sits in its center. */
const HALO = 300;
const CORE = 148;

/** The ~150ms flame smoothing — beats like fire, never twitches like a meter. */
const FLAME_SPRING = { duration: 150, dampingRatio: 1 };

/**
 * The Lamp (Pattern Book, Plate IV). A radial-gradient core inside a soft
 * amber halo, drawn with SVG so it is identical everywhere. At rest it
 * breathes (a CSS animation — zero JS-thread cost). While listening the
 * fixed breath stops and the flame answers the voice: the live mic level
 * drives an extra halo's brightness (+0→35%) and the core's scale
 * (×1.12 base, +0→6% with the voice), smoothed on the UI thread.
 * Reduced motion: halo brightness only, no scale.
 */
export function TalkCircle({
  onPress,
  label = "TAP AND TALK",
  listening = false,
  volume,
}: {
  onPress?: () => void;
  label?: string;
  listening?: boolean;
  volume?: SharedValue<number>;
}) {
  const { name } = useTheme();
  const reducedMotion = useReducedMotion();
  const still = useSharedValue(0);
  const mic = volume ?? still;
  const haloOpacity = name === "dusk" ? 0.5 : 0.35;

  // The halo widens ×1.5 while the room listens.
  const haloSwell = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(listening ? 1.5 : 1, { duration: 200 }) }],
  }));
  // The voice's brightness: a second halo that only the mic can light.
  const flameGlow = useAnimatedStyle(() => ({
    opacity: withSpring(listening ? mic.value * 0.35 : 0, FLAME_SPRING),
  }));
  // The core rides the voice on top of its ×1.12 listening base.
  const coreScale = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(
          listening && !reducedMotion ? 1.12 * (1 + mic.value * 0.06) : 1,
          listening ? FLAME_SPRING : { duration: 200 },
        ),
      },
    ],
  }));

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.wrap}>
        <Animated.View style={[StyleSheet.absoluteFill, haloSwell]} pointerEvents="none">
          <Svg width={HALO} height={HALO} viewBox={`0 0 ${HALO} ${HALO}`}>
            <Defs>
              <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                <Stop offset="35%" stopColor="#e0a458" stopOpacity={haloOpacity} />
                <Stop offset="70%" stopColor="#e0a458" stopOpacity={haloOpacity * 0.25} />
                <Stop offset="100%" stopColor="#e0a458" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={HALO / 2} cy={HALO / 2} r={HALO / 2} fill="url(#halo)" />
          </Svg>
        </Animated.View>
        {listening ? (
          <Animated.View style={[StyleSheet.absoluteFill, flameGlow]} pointerEvents="none">
            <Svg width={HALO} height={HALO} viewBox={`0 0 ${HALO} ${HALO}`}>
              <Defs>
                <RadialGradient id="flame" cx="50%" cy="50%" r="50%">
                  <Stop offset="35%" stopColor="#e0a458" stopOpacity={1} />
                  <Stop offset="70%" stopColor="#e0a458" stopOpacity={0.25} />
                  <Stop offset="100%" stopColor="#e0a458" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={HALO / 2} cy={HALO / 2} r={HALO / 2} fill="url(#flame)" />
            </Svg>
          </Animated.View>
        ) : null}
        <Animated.View
          style={[
            !listening &&
              !reducedMotion && {
                // The resting breath — calm, 4.5s, barely there.
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
          <Animated.View style={coreScale}>
            <Svg width={CORE} height={CORE} viewBox={`0 0 ${CORE} ${CORE}`}>
              <Defs>
                <RadialGradient id="core" cx="50%" cy="42%" r="62%">
                  <Stop offset="0%" stopColor="#f6d9a4" />
                  <Stop offset="45%" stopColor="#eab263" />
                  <Stop offset="80%" stopColor="#b97f35" />
                  <Stop offset="100%" stopColor="#7d5320" />
                </RadialGradient>
              </Defs>
              <Circle cx={CORE / 2} cy={CORE / 2} r={CORE / 2} fill="url(#core)" />
            </Svg>
            <View style={styles.labelWrap} pointerEvents="none">
              <Text style={styles.label}>{label}</Text>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
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
