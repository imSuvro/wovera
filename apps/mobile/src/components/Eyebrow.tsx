import { StyleSheet, Text } from "react-native";
import { fonts } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";

/** The small uppercase amber label that titles every card in the design. */
export function Eyebrow({ children }: { children: string }) {
  const { theme } = useTheme();
  return <Text style={[styles.label, { color: theme.accent }]}>{children.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    marginBottom: 8,
  },
});
