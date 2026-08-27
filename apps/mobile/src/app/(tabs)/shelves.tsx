import { StyleSheet, Text } from "react-native";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { TopRow } from "../../components/TopRow";
import { fonts, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";

/** The Shelves — the vault as a small library. Populated from Phases 2–3. */
export default function ShelvesScreen() {
  const { theme } = useTheme();
  return (
    <Screen>
      <TopRow />
      <Text style={[styles.title, { color: theme.ink }]}>Shelves</Text>

      <Card>
        <Text style={[styles.search, { color: theme.inkFaint }]}>Find a page…</Text>
      </Card>

      <Card label="Your library">
        <Text style={[styles.body, { color: theme.inkSoft }]}>
          The shelves are built as you live. Pages grow here from what you put down — each one
          showing where it came from.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 38,
    marginBottom: space.l,
  },
  search: {
    fontFamily: fonts.ui,
    fontSize: 14,
  },
  body: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 21,
  },
});
