import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { fonts, radius, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";

function greetingForHour(hour: number): string {
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Today — the note left on the kitchen table. Real content (threads being
 * held, quiet continuity) arrives with the vault in Phases 2–6; the layout
 * and voice are final from day one.
 */
export default function TodayScreen() {
  const { theme } = useTheme();
  const hour = new Date().getHours();
  return (
    <Screen>
      <Text style={[styles.greet, { color: theme.ink }]}>{greetingForHour(hour)}.</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <Text style={[styles.cardLabel, { color: theme.accent }]}>THREADS BEING HELD</Text>
        <Text style={[styles.cardBody, { color: theme.inkSoft }]}>
          Nothing yet. When you put things down, the ones that matter will wait for you here.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greet: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 40,
    marginTop: space.xl,
    marginBottom: space.l,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.m,
  },
  cardLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: space.s,
  },
  cardBody: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
  },
});
