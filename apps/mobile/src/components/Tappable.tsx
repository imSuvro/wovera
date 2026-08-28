import type { ReactNode } from "react";
import { Pressable } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/**
 * The app's touch feel: everything tappable settles slightly under the
 * finger (scale 0.98, 90ms) and returns on release. UI-thread only.
 * Replaces bare Pressable wherever a touch should feel like touching.
 */
export function Tappable({
  onPress,
  children,
  style,
  accessibilityRole = "button",
  accessibilityLabel,
  hitSlop,
  disabled,
}: {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityRole?: "button" | "link";
  accessibilityLabel?: string;
  hitSlop?: number;
  disabled?: boolean;
}) {
  const pressed = useSharedValue(0);
  const reduced = useReducedMotion();
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.get() * 0.02 }],
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (!reduced) pressed.set(withTiming(1, { duration: 90 }));
      }}
      onPressOut={() => {
        if (!reduced) pressed.set(withTiming(0, { duration: 160 }));
      }}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      disabled={disabled}
    >
      <Animated.View style={[animated, style]}>{children}</Animated.View>
    </Pressable>
  );
}
