import { useMemo } from "react";
import { Linking, StyleSheet, Text } from "react-native";
import Markdown from "@ronradtke/react-native-markdown-display";
import { fonts } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";

const WOVERA_LINK = "wovera://page/";

/** Does this body actually speak markdown? Plain prose deserves plain grace. */
function hasMarkdownTokens(bodyMd: string): boolean {
  return /^#{1,6}\s|\*\*|__|^\s*[-*+]\s+|^\s*>\s|\[[^\]]*\]\([^)]*\)|```|\[\[|^\s*\d+\.\s+|^\s*\|/m.test(
    bodyMd,
  );
}

/** [[Target|alias]] → markdown links on the wovera:// scheme, resolved on press. */
export function wikilinksToMarkdown(bodyMd: string): string {
  return bodyMd.replace(
    /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g,
    (_m, target: string, alias?: string) => {
      const clean = target.trim().replace(/^(wiki|journal|crm)\//i, "");
      const label = (alias ?? clean).trim() || clean;
      return `[${label}](${WOVERA_LINK}${encodeURIComponent(clean)})`;
    },
  );
}

/**
 * The book voice (upgraded for the Reading Room, Plate VII): vault markdown
 * set like a book — Newsreader 17/28 with a generous measure, Fraunces
 * headings on a real scale, blockquotes as unboxed pull-quotes. A body with
 * no markdown tokens renders as clean prose paragraphs — plain-text grace:
 * anything the user ever saved reads comfortably. Wikilinks navigate inside
 * the vault via onWikilink; web links leave through the system browser.
 */
export function MarkdownBody({
  bodyMd,
  onWikilink,
}: {
  bodyMd: string;
  onWikilink: (title: string) => void;
}) {
  const { theme } = useTheme();
  const processed = useMemo(() => wikilinksToMarkdown(bodyMd), [bodyMd]);
  const plain = useMemo(() => !hasMarkdownTokens(bodyMd), [bodyMd]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 28, color: theme.ink },
        paragraph: { marginTop: 0, marginBottom: 14 },
        plainParagraph: {
          fontFamily: fonts.body,
          fontSize: 17,
          lineHeight: 28,
          color: theme.ink,
          marginBottom: 14,
        },
        heading1: {
          fontFamily: fonts.display,
          fontSize: 25,
          lineHeight: 34,
          marginTop: 22,
          marginBottom: 8,
          color: theme.ink,
        },
        heading2: {
          fontFamily: fonts.display,
          fontSize: 21,
          lineHeight: 30,
          marginTop: 18,
          marginBottom: 6,
          color: theme.ink,
        },
        heading3: {
          fontFamily: fonts.displaySemi,
          fontSize: 17,
          lineHeight: 26,
          marginTop: 14,
          color: theme.ink,
        },
        link: { color: theme.accentDeep, textDecorationLine: "none" },
        // A quote is honoured by type, not boxed (PB-5): italic book voice
        // behind a single amber hairline.
        blockquote: {
          backgroundColor: "transparent",
          borderLeftColor: theme.accent,
          borderLeftWidth: 2,
          paddingHorizontal: 14,
          paddingVertical: 2,
          marginVertical: 10,
          fontFamily: fonts.bodyItalic,
        },
        code_inline: {
          fontFamily: "monospace",
          fontSize: 14,
          backgroundColor: theme.surface2,
          color: theme.ink,
        },
        fence: {
          fontFamily: "monospace",
          fontSize: 13,
          backgroundColor: theme.surface,
          borderColor: theme.line,
          borderWidth: 1,
          borderRadius: 8,
          padding: 10,
        },
        bullet_list_icon: { color: theme.inkFaint },
        ordered_list_icon: { color: theme.inkFaint },
        list_item: { marginBottom: 6 },
        hr: { backgroundColor: theme.line, height: 1, marginVertical: 14 },
      }),
    [theme],
  );

  if (plain) {
    // Plain-text grace: paragraphs on the ground, nothing to parse, nothing
    // to litter — the words set exactly as a book would set them.
    const paragraphs = bodyMd
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    return (
      <>
        {paragraphs.map((p, i) => (
          <Text key={i} style={styles.plainParagraph}>
            {p}
          </Text>
        ))}
      </>
    );
  }

  return (
    <Markdown
      style={styles}
      onLinkPress={(url: string) => {
        if (url.startsWith(WOVERA_LINK)) {
          onWikilink(decodeURIComponent(url.slice(WOVERA_LINK.length)));
          return false; // handled here
        }
        void Linking.openURL(url);
        return false;
      }}
    >
      {processed}
    </Markdown>
  );
}
