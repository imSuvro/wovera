import { StyleSheet, Text } from "react-native";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { TopRow } from "../../components/TopRow";
import { fonts, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";

function greetingForHour(hour: number): string {
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Today — the note left on the kitchen table. Three cards, exactly as the
 * founding artifact's morning screen: quiet continuity, threads being held,
 * a line from the shelves. Real content flows in from Phases 2–6; the empty
 * states are honest, never fake.
 */
export default function TodayScreen() {
  const { theme } = useTheme();
  const hour = new Date().getHours();
  return (
    <Screen>
      <TopRow />
      <Text style={[styles.greet, { color: theme.ink }]}>{greetingForHour(hour)}.</Text>

      <Card label="Quiet continuity">
        <Text style={[styles.body, { color: theme.inkSoft }]}>
          This space fills as your days do — gently, and only with what you tell it.
        </Text>
      </Card>

      <Card label="Threads being held">
        <Text style={[styles.body, { color: theme.inkSoft }]}>
          Nothing yet. When you put things down, the ones that matter will wait for you here.
        </Text>
      </Card>

      <Card label="From your shelves">
        <Text style={[styles.quote, { color: theme.inkSoft }]}>
          A line from your own pages will greet you here, once there are pages.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greet: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 38,
    marginBottom: space.l,
  },
  body: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 21,
  },
  quote: {
    fontFamily: fonts.bodyItalic,
    fontSize: 16,
    lineHeight: 24,
  },
});
