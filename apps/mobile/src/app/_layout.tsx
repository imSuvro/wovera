import {
  AlegreyaSans_400Regular,
  AlegreyaSans_500Medium,
  AlegreyaSans_700Bold,
} from "@expo-google-fonts/alegreya-sans";
import { Fraunces_500Medium, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
  useFonts,
} from "@expo-google-fonts/newsreader";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ReduceMotion, ReducedMotionConfig } from "react-native-reanimated";
import { ThemeProvider, useTheme } from "../theme/ThemeProvider";

// Keep the splash up until fonts are ready — the first painted frame is the
// real app in the real theme, never a flash of fallback type.
void SplashScreen.preventAutoHideAsync();

function AppShell() {
  const { theme, name } = useTheme();
  return (
    <>
      <StatusBar style={name === "dusk" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.ground },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    AlegreyaSans_400Regular,
    AlegreyaSans_500Medium,
    AlegreyaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      {/* Honor the OS reduce-motion setting everywhere, from the first animation. */}
      <ReducedMotionConfig mode={ReduceMotion.System} />
      <AppShell />
    </ThemeProvider>
  );
}
