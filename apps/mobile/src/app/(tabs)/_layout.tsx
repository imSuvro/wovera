import { Tabs } from "expo-router";
import { NavBar } from "../../components/NavBar";
import { useTheme } from "../../theme/ThemeProvider";

/**
 * Three rooms around the lamp-centred bar (Pattern Book, Plate III):
 * Today and Shelves as quiet text halves, the Lamp itself — always lit —
 * raised in the middle. The app opens into the Lamp: capture is the front
 * door. Asking lives inside the rooms now, not behind its own tab.
 */
export default function TabsLayout() {
  const { theme } = useTheme();
  return (
    <Tabs
      initialRouteName="lamp"
      tabBar={(props) => <NavBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.ground },
      }}
    >
      <Tabs.Screen name="today" options={{ title: "Today" }} />
      <Tabs.Screen name="lamp" options={{ title: "Lamp" }} />
      <Tabs.Screen name="shelves" options={{ title: "Shelves" }} />
    </Tabs>
  );
}
