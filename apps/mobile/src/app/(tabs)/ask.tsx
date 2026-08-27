import { StyleSheet, Text } from "react-native";
import { Screen } from "../../components/Screen";
import { fonts, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";

/** Ask — vault-first answers. Wired to the vault + AI in Phases 5–6. */
export default function AskScreen() {
  const { theme } = useTheme();
  return (
    <Screen>
      <Text style={[styles.title, { color: theme.ink }]}>Ask</Text>
      <Text style={[styles.empty, { color: theme.inkSoft }]}>
        Ask anything. Answers come from your own pages first — always cited, always yours.
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
