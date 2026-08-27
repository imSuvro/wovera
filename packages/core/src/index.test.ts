import { describe, expect, it } from "vitest";
import { CORE_VERSION, DOCUMENT_TYPES, LEDGER_KINDS, LINK_KINDS } from "./index.js";

describe("@wovera/core domain constants", () => {
  it("models the four document types of the vault skeleton", () => {
    expect(DOCUMENT_TYPES).toEqual(["journal", "wiki", "person", "thread"]);
  });

  it("models the five ledger kinds", () => {
    expect(LEDGER_KINDS).toEqual(["journal", "held", "woven", "tidy", "rule"]);
  });

  it("keeps link kinds distinct from ledger kinds", () => {
    for (const kind of LINK_KINDS) {
      expect(LEDGER_KINDS).not.toContain(kind);
    }
  });

  it("exposes a version", () => {
    expect(CORE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
