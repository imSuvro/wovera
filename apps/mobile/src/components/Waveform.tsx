import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

const BARS = 11;

/**
 * The listening waveform — bars ride the live mic level with a little
 * per-bar variation so it feels alive, not mechanical. Pure View heights
 * driven at the volume event rate (~8/s): far below any frame budget.
 */
export function Waveform({ volume }: { volume: number }) {
  const { theme } = useTheme();
  const [heights, setHeights] = useState<number[]>(() => Array(BARS).fill(4));
  const seed = useRef(Array.from({ length: BARS }, (_, i) => (i * 37) % 13));

  useEffect(() => {
    setHeights(
      seed.current.map((s, i) => {
        const centerBias = 1 - Math.abs(i - (BARS - 1) / 2) / BARS;
        const jitter = 0.7 + ((s + i) % 5) / 8;
        return 4 + Math.round(volume * 22 * centerBias * jitter);
      }),
    );
  }, [volume]);

  return (
    <View style={styles.row} accessibilityElementsHidden>
      {heights.map((h, i) => (
        <View key={i} style={[styles.bar, { height: h, backgroundColor: theme.accent }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 30,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    opacity: 0.9,
  },
});
