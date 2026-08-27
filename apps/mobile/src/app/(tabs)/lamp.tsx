import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { TalkCircle } from "../../components/TalkCircle";
import { TopRow } from "../../components/TopRow";
import { fonts, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";

/**
 * The Lamp — the front door. Composition mirrors the founding artifact's
 * capture screen: dated top row, the greeting, the glowing lamp, the verbatim
 * promise. Live capture arrives in Phase 4; the room is already itself.
 */
export default function LampScreen() {
  const { theme } = useTheme();
  return (
    <Screen>
      <TopRow />
      <Text style={[styles.greet, { color: theme.ink }]}>The lamp is on.</Text>
      <Text style={[styles.sub, { color: theme.inkSoft }]}>
        Talk whenever you're ready. Or type, if the house is quiet.
      </Text>
      <View style={styles.circleWrap}>
        <TalkCircle />
      </View>
      <Text style={[styles.promise, { color: theme.inkFaint }]}>
        Your words are kept exactly. Nothing is cleaned up unless you ask.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greet: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 38,
  },
  sub: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 21,
    marginTop: space.s,
  },
  circleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  promise: {
    fontFamily: fonts.ui,
    fontSize: 13,
    textAlign: "center",
    marginBottom: space.xl,
  },
});
