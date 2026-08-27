import { describe, expect, it } from "vitest";
import { documentTypeForVaultDir, extractWikilinks } from "./index.js";

describe("extractWikilinks", () => {
  it("extracts plain and aliased wikilinks", () => {
    const md = "See [[wiki/Personal Recovery Baseline|Recovery Baseline]] and [[Do Hard Things]].";
    expect(extractWikilinks(md)).toEqual(["wiki/Personal Recovery Baseline", "Do Hard Things"]);
  });

  it("ignores heading fragments and returns empty for plain text", () => {
    expect(extractWikilinks("[[Page#Section|label]]")).toEqual(["Page"]);
    expect(extractWikilinks("no links here")).toEqual([]);
  });
});

describe("documentTypeForVaultDir", () => {
  it("maps the vault's directories to document types", () => {
    expect(documentTypeForVaultDir("journal")).toBe("journal");
    expect(documentTypeForVaultDir("wiki")).toBe("wiki");
    expect(documentTypeForVaultDir("crm")).toBe("person");
    expect(documentTypeForVaultDir("raw")).toBeNull();
  });
});
