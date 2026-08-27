import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { TalkCircle } from "../../components/TalkCircle";
import { fonts, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";

/**
 * The Lamp — the front door of the app. Chapter two of the UX story:
 * no prompt-pressure, no blank-page question. Real capture lands in Phase 4;
 * this screen already carries the final voice and layout skeleton.
 */
export default function LampScreen() {
  const { theme } = useTheme();
  return (
    <Screen>
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
    fontSize: 32,
    lineHeight: 40,
    marginTop: space.xl,
  },
  sub: {
    fontFamily: fonts.ui,
    fontSize: 15,
    lineHeight: 22,
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
    marginBottom: space.xxl,
  },
});
