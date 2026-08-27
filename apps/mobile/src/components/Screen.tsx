import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";

/** Base screen container: themed ground, safe-area aware, comfortable padding. */
export function Screen({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.root, { backgroundColor: theme.ground, paddingTop: insets.top + space.l }]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: space.l,
  },
});
