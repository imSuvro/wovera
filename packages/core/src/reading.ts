/**
 * Parser for the Personal-Command-Center journal transcript shape.
 *
 * A PCC entry is markdown with an optional "# Title" line, an optional
 * `Date:` line, an optional "## Summary" section, and a "## Transcript"
 * section made of "### User" / "### Assistant" turns. The parser is a
 * heuristic: any body without a transcript containing at least one
 * non-empty turn is not a PCC entry and yields null.
 */

export interface PccTurn {
  speaker: "user" | "assistant";
  text: string;
}

export interface PccEntry {
  date: string | null;
  summary: string | null;
  turns: PccTurn[];
}

/** Body of the `## <heading>` section: everything up to the next `## ` line. */
function sectionBody(md: string, heading: string): string | null {
  const open = new RegExp(`^##[ \\t]+${heading}[ \\t]*$`, "im").exec(md);
  if (!open) return null;
  const rest = md.slice(open.index + open[0].length);
  const close = /^##[ \t]/m.exec(rest);
  return close ? rest.slice(0, close.index) : rest;
}

/** Parses a vault body into a PCC entry, or null when it isn't one. */
export function parsePccEntry(bodyMd: string): PccEntry | null {
  // Normalize line endings, then strip a leading "# Title" line if present.
  const md = bodyMd.replace(/\r\n?/g, "\n").replace(/^\s*#[ \t][^\n]*\n?/, "");

  const date = /^Date:[ \t]*(.+)$/m.exec(md)?.[1]?.trim() ?? null;

  const summaryBody = sectionBody(md, "Summary")?.trim();
  const summary = summaryBody ? summaryBody : null;

  const transcript = sectionBody(md, "Transcript");
  if (transcript === null) return null;

  const turns: PccTurn[] = [];
  let speaker: PccTurn["speaker"] | null = null;
  let start = 0;
  const closeTurn = (end: number): void => {
    if (speaker === null) return;
    const text = transcript.slice(start, end).trim();
    if (text) turns.push({ speaker, text });
  };
  const turnHeading = /^###[ \t]+(user|assistant)[ \t]*$/gim;
  for (let m = turnHeading.exec(transcript); m !== null; m = turnHeading.exec(transcript)) {
    closeTurn(m.index);
    speaker = m[1]?.toLowerCase() === "user" ? "user" : "assistant";
    start = m.index + m[0].length;
  }
  closeTurn(transcript.length);

  if (turns.length === 0) return null;
  return { date, summary, turns };
}
