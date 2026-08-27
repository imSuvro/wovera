import { StyleSheet, Text } from "react-native";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { TopRow } from "../../components/TopRow";
import { fonts, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";

/** Ask — vault-first answers, wired to the vault + AI in Phases 5–6. */
export default function AskScreen() {
  const { theme } = useTheme();
  return (
    <Screen>
      <TopRow />
      <Text style={[styles.title, { color: theme.ink }]}>Ask</Text>

      <Card>
        <Text style={[styles.prompt, { color: theme.inkFaint }]}>Ask anything…</Text>
      </Card>

      <Card label="How answers work">
        <Text style={[styles.body, { color: theme.inkSoft }]}>
          Answers come from your own pages first — always cited, always yours. Anything beyond
          them is clearly marked as general knowledge.
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
  prompt: {
    fontFamily: fonts.ui,
    fontSize: 14,
  },
  body: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 21,
  },
});
