import { StyleSheet, Text, View } from "react-native";
import { fonts } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";

/**
 * A person's mark — their initial in a warm ring. The People shelf gets
 * faces without ever asking for photos.
 */
export function PersonMark({ name, size = 34 }: { name: string; size?: number }) {
  const { theme } = useTheme();
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: theme.accent,
          backgroundColor: theme.surface2,
        },
      ]}
    >
      <Text style={[styles.initial, { color: theme.accentDeep, fontSize: size * 0.44 }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontFamily: fonts.displaySemi },
});
