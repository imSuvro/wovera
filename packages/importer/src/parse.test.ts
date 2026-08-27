import { describe, expect, it } from "vitest";
import { parseJournalFile, parseLog, parseVault, parseWikiIndex } from "./parse";

const INDEX = `# Index

Catalog.

## Orientation

- [[wiki/overview|Overview]] - Describes the workflow.

## Discipline and Hard Things

- [[wiki/Do Hard Things|Do Hard Things]] - Voluntary difficulty.
- [[wiki/Deep Focus]] - Plain link, no alias.
`;

describe("parseWikiIndex", () => {
  it("maps pages to their section shelves, stripping the wiki/ prefix", () => {
    const shelves = parseWikiIndex(INDEX);
    expect(shelves.get("overview")).toBe("Orientation");
    expect(shelves.get("do hard things")).toBe("Discipline and Hard Things");
    expect(shelves.get("deep focus")).toBe("Discipline and Hard Things");
  });
});

describe("parseJournalFile", () => {
  it("takes the date from the filename and keeps the body verbatim", () => {
    const body = "# T\n\nDate: 2026-06-14\n\n## Transcript\n\nExact words,  spacing kept.";
    const doc = parseJournalFile("journal/2026-06-14 Momentum.md", body);
    expect(doc?.title).toBe("Momentum");
    expect(doc?.bodyMd).toBe(body);
    expect(new Date(doc!.createdAt!).getFullYear()).toBe(2026);
  });

  it("rejects filenames without a leading date", () => {
    expect(parseJournalFile("journal/notes.md", "x")).toBeNull();
  });
});

describe("parseLog", () => {
  it("parses dated entries and maps source kinds to ledger vocabulary", () => {
    const rows = parseLog(
      "# Log\n\n## [2026-05-19] setup | Operating schema\n- detail\n\n" +
        "## [2026-06-15] ingest | Job search sources\n\n## [2026-06-16] lint | Sweep\n" +
        "## [2026-06-17] journal | Reset night\n## [2026-06-18] mystery | Unknown kind\n",
    );
    expect(rows.map((r) => r.kind)).toEqual(["rule", "woven", "tidy", "journal", "tidy"]);
    expect(rows[1]?.summary).toBe("Job search sources");
    expect(rows.every((r, i, a) => i === 0 || a[i - 1]!.ts <= r.ts)).toBe(true);
  });
});

describe("parseVault", () => {
  it("routes files by directory, skips indexes, and builds the report", () => {
    const result = parseVault([
      { path: "wiki/index.md", content: INDEX },
      { path: "wiki/Do Hard Things.md", content: "Body with [[Overview]]." },
      { path: "wiki/Unlisted Page.md", content: "Not in the index." },
      { path: "wiki/log.md", content: "## [2026-05-19] query | Motivation\n" },
      { path: "journal/2026-06-14 Momentum.md", content: "verbatim" },
      { path: "journal/index.md", content: "catalog" },
      { path: "crm/Ada Lovelace.md", content: "# Ada" },
      { path: "crm/index.md", content: "catalog" },
    ]);
    expect(result.report).toEqual({
      journal: 1,
      wiki: 2,
      person: 1,
      ledgerRows: 1,
      shelved: 2, // Do Hard Things (indexed) + Ada (People); Unlisted has no shelf
      skipped: 3,
    });
    const wiki = result.documents.find((d) => d.title === "Do Hard Things");
    expect(wiki?.shelf).toBe("Discipline and Hard Things");
    const person = result.documents.find((d) => d.type === "person");
    expect(person?.shelf).toBe("People");
  });
});
