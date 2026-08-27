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
import { useEffect, useRef } from "react";
import { ReduceMotion, ReducedMotionConfig } from "react-native-reanimated";
import { WebFrame } from "../components/WebFrame";
import { VaultProvider } from "../vault/VaultProvider";
import { SweepHost } from "../theme/SweepHost";
import type { SweepAPI } from "../theme/sweep";
import { ThemeProvider, useTheme } from "../theme/ThemeProvider";

// Keep the splash up until fonts are ready — the first painted frame is the
// real app in the real theme, never a flash of fallback type.
void SplashScreen.preventAutoHideAsync();

function AppShell({ sweepRef }: { sweepRef: React.Ref<SweepAPI> }) {
  const { theme, name } = useTheme();
  return (
    <WebFrame>
      <StatusBar style={name === "dusk" ? "light" : "dark"} />
      <SweepHost ref={sweepRef}>
        <Stack
          screenOptions={{
            headerShown: false,
            // Rooms cross-fade softly — doors in a house, not sliding panels.
            animation: "fade",
            animationDuration: 220,
            contentStyle: { backgroundColor: theme.ground },
          }}
        />
      </SweepHost>
    </WebFrame>
  );
}

export default function RootLayout() {
  const sweepRef = useRef<SweepAPI>(null);
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
    <ThemeProvider getSweep={() => sweepRef.current}>
      <VaultProvider>
        {/* Honor the OS reduce-motion setting everywhere, from the first animation. */}
        <ReducedMotionConfig mode={ReduceMotion.System} />
        <AppShell sweepRef={sweepRef} />
      </VaultProvider>
    </ThemeProvider>
  );
}
