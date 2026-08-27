import type { ReactNode } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

const FRAME_WIDTH = 414;

/**
 * Wovera is phone-first. On a desktop browser the app lives in a centered,
 * phone-proportioned column against a deeper backdrop — never smeared across
 * the monitor. On native (and narrow browsers) this renders nothing extra.
 */
export function WebFrame({ children }: { children: ReactNode }) {
  const { theme, name } = useTheme();
  const { width } = useWindowDimensions();

  const framed = Platform.OS === "web" && width > 560;
  if (!framed) return <>{children}</>;

  return (
    <View
      style={[
        styles.backdrop,
        { backgroundColor: name === "dusk" ? "#0f0d13" : "#e5ddd0" },
      ]}
    >
      <View
        style={[
          styles.frame,
          { backgroundColor: theme.ground, borderColor: theme.line },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
  },
  frame: {
    flex: 1,
    width: FRAME_WIDTH,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: "hidden",
  },
});
