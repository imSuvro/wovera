import type { BottomTabBarProps } from "expo-router/tabs";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { emitLampTap } from "../capture/lampBus";
import { useLampSession } from "../capture/LampSession";
import { fonts } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";

/**
 * The lamp-centred bar (Pattern Book, Plate III). Two quiet text halves —
 * Today and Shelves — flank an 88pt well where the NavLamp sits raised above
 * the bar line. The lamp is the house's pilot light: full ember inside the
 * Lamp room, banked to 75% elsewhere, never grey, never "inactive".
 */
const BAR_H = 64;
const WELL = 88;
const LAMP = 56;
const HALO = 112;
const RAISE = 16;
/** Canvas offset so the core's top edge sits RAISE above the bar's top edge. */
const LAMP_TOP = -(RAISE + (HALO - LAMP) / 2);

function NavLamp({ lit, onPress }: { lit: boolean; onPress: () => void }) {
  const { name } = useTheme();
  const reducedMotion = useReducedMotion();
  // Half-strength halo — this is the pilot light, not the room's main lamp.
  const haloOpacity = (name === "dusk" ? 0.5 : 0.35) * 0.5;
  return (
    <View style={styles.lampWrap} pointerEvents="box-none">
      <Animated.View
        style={[
          { opacity: lit ? 1 : 0.75 },
          !reducedMotion && {
            // The resting breath: 6s, barely there — alive, not busy.
            animationName: {
              "0%": { transform: [{ scale: 1 }] },
              "50%": { transform: [{ scale: 1.035 }] },
              "100%": { transform: [{ scale: 1 }] },
            },
            animationDuration: "6s",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
          },
        ]}
        pointerEvents="none"
      >
        <Svg width={HALO} height={HALO} viewBox={`0 0 ${HALO} ${HALO}`}>
          <Defs>
            <RadialGradient id="navhalo" cx="50%" cy="50%" r="50%">
              <Stop offset="35%" stopColor="#e0a458" stopOpacity={haloOpacity} />
              <Stop offset="70%" stopColor="#e0a458" stopOpacity={haloOpacity * 0.25} />
              <Stop offset="100%" stopColor="#e0a458" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="navcore" cx="50%" cy="42%" r="62%">
              <Stop offset="0%" stopColor="#f6d9a4" />
              <Stop offset="45%" stopColor="#eab263" />
              <Stop offset="80%" stopColor="#b97f35" />
              <Stop offset="100%" stopColor="#7d5320" />
            </RadialGradient>
          </Defs>
          <Circle cx={HALO / 2} cy={HALO / 2} r={HALO / 2} fill="url(#navhalo)" />
          <Circle cx={HALO / 2} cy={HALO / 2} r={LAMP / 2} fill="url(#navcore)" />
        </Svg>
      </Animated.View>
      <Pressable
        onPress={onPress}
        style={styles.lampPress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="The Lamp — talk to Wovera"
      />
    </View>
  );
}

function Half({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    <Pressable
      onPress={onPress}
      style={styles.half}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.halfLabel, { color: active ? theme.accent : theme.inkSoft }]}>
        {label}
      </Text>
      {active ? (
        <Animated.View
          style={[
            styles.underline,
            { backgroundColor: theme.accent },
            !reducedMotion && {
              // 14×2 underline grows from its center when the room becomes yours.
              animationName: {
                from: { transform: [{ scaleX: 0 }] },
                to: { transform: [{ scaleX: 1 }] },
              },
              animationDuration: "200ms",
              animationTimingFunction: "ease-out",
            },
          ]}
        />
      ) : (
        <View style={styles.underlineGhost} />
      )}
    </Pressable>
  );
}

export function NavBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { phase } = useLampSession();
  const current = state.routes[state.index]?.name;

  const go = (name: string) => {
    const target = state.routes.find((r) => r.name === name);
    if (!target) return;
    const event = navigation.emit({
      type: "tabPress",
      target: target.key,
      canPreventDefault: true,
    });
    if (current !== name && !event.defaultPrevented) navigation.navigate(name);
  };

  const onLamp = () => {
    // From any room the lamp brings you home; at home, tapping it means "talk".
    if (current === "lamp") emitLampTap();
    else go("lamp");
  };

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
          paddingBottom: Platform.OS === "web" ? 0 : insets.bottom,
          // While the Lamp listens, even the bar recedes — the room goes quiet.
          opacity: phase === "listening" ? 0.3 : 1,
          transitionProperty: "opacity",
          transitionDuration: "200ms",
        },
      ]}
    >
      <View style={styles.row}>
        <Half label="Today" active={current === "today"} onPress={() => go("today")} />
        <View style={styles.well} />
        <Half label="Shelves" active={current === "shelves"} onPress={() => go("shelves")} />
      </View>
      <NavLamp lit={current === "lamp"} onPress={onLamp} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1 },
  row: { flexDirection: "row", height: BAR_H, alignItems: "stretch" },
  half: { flex: 1, alignItems: "center", justifyContent: "center" },
  halfLabel: { fontFamily: fonts.uiBold, fontSize: 13, letterSpacing: 0.4 },
  underline: { width: 14, height: 2, borderRadius: 1, marginTop: 5 },
  underlineGhost: { width: 14, height: 2, marginTop: 5 },
  well: { width: WELL },
  lampWrap: {
    position: "absolute",
    top: LAMP_TOP,
    left: "50%",
    marginLeft: -(HALO / 2),
    width: HALO,
    height: HALO,
    alignItems: "center",
    justifyContent: "center",
  },
  lampPress: {
    position: "absolute",
    top: (HALO - LAMP) / 2,
    left: (HALO - LAMP) / 2,
    width: LAMP,
    height: LAMP,
    borderRadius: LAMP / 2,
  },
});
