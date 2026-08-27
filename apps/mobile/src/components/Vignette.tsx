import { StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";

/**
 * Act I's room light (Pattern Book, Plate IV): a barely-there pool of
 * lamplight behind the whole room — accent at 9% in dusk, 5% in linen.
 * It says "the lamp is lit" before a single word does.
 */
export function Vignette({ strength = 1 }: { strength?: number }) {
  const { name, theme } = useTheme();
  const opacity = (name === "dusk" ? 0.09 : 0.05) * strength;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="vignette" cx="50%" cy="55%" rx="60%" ry="45%">
            <Stop offset="0%" stopColor={theme.accent} stopOpacity={opacity} />
            <Stop offset="70%" stopColor={theme.accent} stopOpacity={opacity * 0.35} />
            <Stop offset="100%" stopColor={theme.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50%" cy="55%" rx="60%" ry="45%" fill="url(#vignette)" />
      </Svg>
    </View>
  );
}
