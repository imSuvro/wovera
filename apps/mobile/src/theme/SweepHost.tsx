import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import ViewShot from "react-native-view-shot";
import type { ViewShotRef } from "react-native-view-shot";
import { SWEEP_LINE, SWEEP_MS } from "./sweep";
import type { SweepAPI } from "./sweep";

const LINE_GLOW_HEIGHT = 36;

/**
 * Native implementation of the nightfall wipe.
 *
 * Mechanism: snapshot the departing theme, apply the change underneath, then
 * reveal the new theme by sliding an overflow-hidden overlay downward while
 * counter-translating the snapshot inside it — the snapshot appears pinned
 * while the overlay's top edge (the lamplight horizon) travels down the
 * screen. Transforms only; the animation lives on the UI thread.
 */
export const SweepHost = forwardRef<SweepAPI, { children: ReactNode }>(function SweepHost(
  { children },
  ref,
) {
  const shotRef = useRef<ViewShotRef>(null);
  const { height: screenH } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [overlayUri, setOverlayUri] = useState<string | null>(null);
  const sweeping = useRef(false);
  const progress = useSharedValue(0);

  useImperativeHandle(ref, () => ({
    sweep(apply: () => void) {
      const capture = shotRef.current?.capture;
      if (reducedMotion || sweeping.current || !capture) {
        apply();
        return;
      }
      sweeping.current = true;
      capture().then(
        (uri) => {
          // Overlay (old theme) mounts in the same commit as the change,
          // so the new theme is never visible before the sweep reveals it.
          progress.set(0);
          setOverlayUri(uri);
          apply();
          const clear = () => {
            setOverlayUri(null);
            sweeping.current = false;
          };
          progress.set(
            withTiming(1, { duration: SWEEP_MS, easing: Easing.bezier(0.4, 0, 0.2, 1) }, () => {
              runOnJS(clear)();
            }),
          );
        },
        () => {
          // Snapshot failed (rare) — change the theme without ceremony.
          sweeping.current = false;
          apply();
        },
      );
    },
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.get() * screenH }],
  }));
  const snapshotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -progress.get() * screenH }],
  }));

  return (
    <View style={styles.fill} collapsable={false}>
      <ViewShot ref={shotRef} style={styles.fill} options={{ format: "png", result: "tmpfile" }}>
        {children}
      </ViewShot>
      {overlayUri ? (
        <Animated.View pointerEvents="none" style={[styles.overlay, overlayStyle]}>
          <Animated.View style={[styles.fill, snapshotStyle]}>
            <Image source={{ uri: overlayUri }} style={styles.fill} fadeDuration={0} />
          </Animated.View>
          <Svg width="100%" height={LINE_GLOW_HEIGHT} style={styles.line} pointerEvents="none">
            <Defs>
              <LinearGradient id="sweepGlow" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={SWEEP_LINE} stopOpacity={0.55} />
                <Stop offset="0.12" stopColor={SWEEP_LINE} stopOpacity={0.9} />
                <Stop offset="0.2" stopColor={SWEEP_LINE} stopOpacity={0.35} />
                <Stop offset="1" stopColor={SWEEP_LINE} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height={LINE_GLOW_HEIGHT} fill="url(#sweepGlow)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  line: {
    position: "absolute",
    top: -2,
    left: 0,
    right: 0,
  },
});
