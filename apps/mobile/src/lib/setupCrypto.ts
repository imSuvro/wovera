import { Platform } from "react-native";

/**
 * Hermes has no Web Crypto. The vault's E2EE needs real randomness, so on
 * native we graft expo-crypto's CSPRNG onto globalThis.crypto before any
 * crypto code runs. Web and Node already have the real thing.
 */
export function setupCrypto(): void {
  if (Platform.OS === "web") return;
  const g = globalThis as {
    crypto?: { getRandomValues?: (buf: Uint8Array) => Uint8Array };
  };
  if (g.crypto?.getRandomValues) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expoCrypto = require("expo-crypto") as {
      getRandomValues: (buf: Uint8Array) => Uint8Array;
    };
    const getRandomValues = (buf: Uint8Array) => expoCrypto.getRandomValues(buf);
    if (g.crypto) g.crypto.getRandomValues = getRandomValues;
    else g.crypto = { getRandomValues };
  } catch {
    // Binary predates expo-crypto (before build 4): E2EE setup will refuse
    // with secure-rng-unavailable rather than fall back to weak randomness.
  }
}
