import { Tabs } from "expo-router";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { ColorValue } from "react-native";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";

/** Label with a small lamplight dot when the room is the one you're in. */
function TabLabel({
  focused,
  color,
  children,
  accent,
}: {
  focused: boolean;
  color: ColorValue;
  children: string;
  accent: string;
}) {
  return (
    <View style={labelStyles.wrap}>
      <View style={[labelStyles.dot, { backgroundColor: accent, opacity: focused ? 1 : 0 }]} />
      <Text style={[labelStyles.text, { color }]}>{children}</Text>
    </View>
  );
}

const labelStyles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  dot: { width: 4, height: 4, borderRadius: 2, marginBottom: 4 },
  text: { fontFamily: fonts.uiBold, fontSize: 13, letterSpacing: 0.4 },
});

/**
 * Four rooms, text labels only — no icon set in the bundle, and the words
 * themselves are the product's vocabulary: Today · Lamp · Shelves · Ask.
 * The app opens into the Lamp: capture is the front door.
 */
export default function TabsLayout() {
  const { theme } = useTheme();
  return (
    <Tabs
      initialRouteName="lamp"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.ground },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
          borderTopWidth: 1,
          elevation: 0,
          height: Platform.OS === "web" ? 56 : 64,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.inkFaint,
        tabBarLabel: ({ focused, color, children }) => (
          <TabLabel focused={focused} color={color} accent={theme.accent}>
            {children}
          </TabLabel>
        ),
        tabBarIconStyle: { display: "none" },
        tabBarItemStyle: { justifyContent: "center" },
      }}
    >
      <Tabs.Screen name="today" options={{ title: "Today" }} />
      <Tabs.Screen name="lamp" options={{ title: "Lamp" }} />
      <Tabs.Screen name="shelves" options={{ title: "Shelves" }} />
      <Tabs.Screen name="ask" options={{ title: "Ask" }} />
    </Tabs>
  );
}
