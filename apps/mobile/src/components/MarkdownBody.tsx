import { useMemo } from "react";
import { Linking, StyleSheet } from "react-native";
import Markdown from "@ronradtke/react-native-markdown-display";
import { fonts } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";

const WOVERA_LINK = "wovera://page/";

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
 * The book voice: vault markdown rendered in Newsreader with Fraunces
 * headings, themed for dusk/linen. Wikilinks navigate inside the vault via
 * the onWikilink callback; web links leave through the system browser.
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 26, color: theme.ink },
        heading1: {
          fontFamily: fonts.display,
          fontSize: 24,
          lineHeight: 32,
          marginTop: 18,
          marginBottom: 6,
          color: theme.ink,
        },
        heading2: {
          fontFamily: fonts.display,
          fontSize: 20,
          lineHeight: 28,
          marginTop: 16,
          marginBottom: 4,
          color: theme.ink,
        },
        heading3: {
          fontFamily: fonts.displaySemi,
          fontSize: 16,
          lineHeight: 24,
          marginTop: 12,
          color: theme.ink,
        },
        link: { color: theme.accentDeep, textDecorationLine: "none" },
        blockquote: {
          backgroundColor: theme.surface,
          borderLeftColor: theme.accent,
          borderLeftWidth: 2,
          paddingHorizontal: 12,
          paddingVertical: 4,
          marginVertical: 6,
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
        hr: { backgroundColor: theme.line, height: 1 },
      }),
    [theme],
  );

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
