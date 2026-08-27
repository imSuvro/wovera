import { Text } from "react-native";
import type { StyleProp, TextStyle } from "react-native";
import { fonts } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";

/**
 * Renders an FTS snippet, lighting the »matched« words in lamplight
 * instead of leaving the raw markers visible.
 */
export function SnippetText({ snippet, style }: { snippet: string; style?: StyleProp<TextStyle> }) {
  const { theme } = useTheme();
  const parts: { text: string; hit: boolean }[] = [];
  for (const [i, chunk] of snippet.split("»").entries()) {
    if (i === 0) {
      if (chunk) parts.push({ text: chunk, hit: false });
      continue;
    }
    const [match, ...rest] = chunk.split("«");
    if (match) parts.push({ text: match, hit: true });
    const tail = rest.join("«");
    if (tail) parts.push({ text: tail, hit: false });
  }
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.hit ? (
          <Text key={i} style={{ color: theme.accentDeep, fontFamily: fonts.bodyMedium }}>
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        ),
      )}
    </Text>
  );
}
