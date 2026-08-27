import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";

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
        tabBarLabelStyle: {
          fontFamily: fonts.uiBold,
          fontSize: 13,
          letterSpacing: 0.4,
        },
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
