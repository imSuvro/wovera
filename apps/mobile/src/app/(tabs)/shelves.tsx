import { StyleSheet, Text } from "react-native";
import { Screen } from "../../components/Screen";
import { fonts, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";

/** The Shelves — the vault as a small library. Populated from Phase 2 + 3. */
export default function ShelvesScreen() {
  const { theme } = useTheme();
  return (
    <Screen>
      <Text style={[styles.title, { color: theme.ink }]}>Shelves</Text>
      <Text style={[styles.empty, { color: theme.inkSoft }]}>
        The shelves are built as you live. Pages will grow here from what you put down — each one
        showing where it came from.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 40,
    marginTop: space.xl,
    marginBottom: space.m,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
  },
});
