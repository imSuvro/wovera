import { describe, expect, it } from "vitest";
import { parsePccEntry } from "./reading";

const fullEntry = `# Debt Cleared and Three Days Dry

Date: 2026-08-26

## Summary

The first entry since June 23, covering the whole gap. Debt cleared and a
sobriety turning point.

## Transcript

### User

I want this to be a journal entry. I am healing.

The debt is finally cleared and today is day three.

### Assistant

Recorded. Three days is a real foothold — the gap since June is part of the
story, not a failure of it.

### User

Thank you. That is exactly how it feels.
`;

describe("parsePccEntry", () => {
  it("parses the full shape: title, date, summary, and multi-paragraph turns", () => {
    const entry = parsePccEntry(fullEntry);
    expect(entry).not.toBeNull();
    expect(entry?.date).toBe("2026-08-26");
    expect(entry?.summary).toBe(
      "The first entry since June 23, covering the whole gap. Debt cleared and a\nsobriety turning point.",
    );
    expect(entry?.turns.map((t) => t.speaker)).toEqual(["user", "assistant", "user"]);
    // Paragraph breaks inside a turn survive; outer whitespace is trimmed.
    expect(entry?.turns[0]?.text).toBe(
      "I want this to be a journal entry. I am healing.\n\nThe debt is finally cleared and today is day three.",
    );
    expect(entry?.turns[2]?.text).toBe("Thank you. That is exactly how it feels.");
  });

  it("parses an entry without a title line", () => {
    const entry = parsePccEntry(fullEntry.replace("# Debt Cleared and Three Days Dry\n", ""));
    expect(entry?.date).toBe("2026-08-26");
    expect(entry?.turns).toHaveLength(3);
  });

  it("parses an entry without a summary section", () => {
    const noSummary = `# Entry\n\nDate: 2026-08-26\n\n## Transcript\n\n### User\n\nJust the words.\n`;
    const entry = parsePccEntry(noSummary);
    expect(entry?.summary).toBeNull();
    expect(entry?.turns).toEqual([{ speaker: "user", text: "Just the words." }]);
  });

  it("parses an entry without a date line", () => {
    const entry = parsePccEntry(fullEntry.replace("Date: 2026-08-26\n", ""));
    expect(entry?.date).toBeNull();
    expect(entry?.summary).toContain("first entry since June 23");
    expect(entry?.turns).toHaveLength(3);
  });

  it("returns null for a plain prose body", () => {
    expect(parsePccEntry("Just some journal prose.\n\nNo structure at all.")).toBeNull();
  });

  it("returns null for a wiki page with sections but no transcript", () => {
    const wiki = `# Recovery\n\n## Timeline\n\nJune to August.\n\n## People\n\n- [[Suvro]]\n`;
    expect(parsePccEntry(wiki)).toBeNull();
  });

  it("returns null for a transcript with only empty turns", () => {
    const empty = `## Transcript\n\n### User\n\n### Assistant\n\n`;
    expect(parsePccEntry(empty)).toBeNull();
  });
});
