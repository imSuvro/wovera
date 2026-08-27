/**
 * Wovera's two skins. Dusk is the night voice (plum-dark, lamplight amber);
 * linen is the morning voice (warm paper, honey). By default the app follows
 * the sky — dusk after sunset, linen by day — overridable in House Rules.
 *
 * Sources: the founding UX artifact ("the theme follows the clock") and the
 * genre research's comfort contract. Keep hues in sync with docs/ when edited.
 */

export interface ThemeTokens {
  /** Page background. */
  ground: string;
  /** Card background. */
  surface: string;
  /** Raised / secondary surface. */
  surface2: string;
  /** Hairline borders. */
  line: string;
  /** Primary text. */
  ink: string;
  /** Secondary text. */
  inkSoft: string;
  /** Tertiary / timestamps. */
  inkFaint: string;
  /** Lamplight — the one warm accent. */
  accent: string;
  /** Accent for text on dark ground (higher contrast). */
  accentDeep: string;
  /** The "kept / held for you" green. Quiet, never a success-checkmark green. */
  held: string;
}

export const dusk: ThemeTokens = {
  ground: "#17141d",
  surface: "#201c29",
  surface2: "#292434",
  line: "#383147",
  ink: "#ece5da",
  inkSoft: "#a89fb3",
  inkFaint: "#7d7490",
  accent: "#e0a458",
  accentDeep: "#f0bd7c",
  held: "#9db996",
};

export const linen: ThemeTokens = {
  ground: "#f2ede4",
  surface: "#faf6ee",
  surface2: "#ece5d8",
  line: "#e2d8c8",
  ink: "#2f2739",
  inkSoft: "#6f6579",
  inkFaint: "#96897c",
  accent: "#a3691c",
  accentDeep: "#7d4f12",
  held: "#55744f",
};

/**
 * Type roles. Everything human (the user's words, the assistant's replies,
 * page prose) is serif; everything mechanical (labels, buttons, timestamps)
 * is the quiet sans. Font families are loaded in the root layout.
 */
export const fonts = {
  /** Display — screen titles, greetings. */
  display: "Fraunces_500Medium",
  displaySemi: "Fraunces_600SemiBold",
  /** The book voice — journal text, replies. */
  body: "Newsreader_400Regular",
  bodyMedium: "Newsreader_500Medium",
  bodyItalic: "Newsreader_400Regular_Italic",
  /** UI chrome. */
  ui: "AlegreyaSans_400Regular",
  uiMedium: "AlegreyaSans_500Medium",
  uiBold: "AlegreyaSans_700Bold",
} as const;

export const space = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  card: 12,
  pill: 999,
} as const;
