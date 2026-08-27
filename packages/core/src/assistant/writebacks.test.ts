import { describe, expect, it } from "vitest";
import { MemoryVault } from "../memoryVault";
import { applyWriteback, parseWritebackProposals, restoreFromLedger } from "./writebacks";

describe("parseWritebackProposals", () => {
  it("parses valid arrays, strips fences, caps at two, drops junk", () => {
    const raw =
      '```json\n[{"action":"update","pageTitle":"Sleep Repair","addition":"He set a hard laptop-close time of 11pm.","reason":"a rule"},' +
      '{"action":"create","pageTitle":"New Rule","shelf":"Personal","addition":"A durable new rule about money and weekends.","reason":"r"},' +
      '{"action":"update","pageTitle":"Third","addition":"Should be dropped by the cap ok."},' +
      '{"action":"bogus","pageTitle":"x","addition":"nope nope nope"}]\n```';
    const parsed = parseWritebackProposals(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ action: "update", pageTitle: "Sleep Repair" });
    expect(parsed[1]).toMatchObject({ action: "create", shelf: "Personal" });
  });

  it("returns [] on prose, bad JSON, or empty arrays", () => {
    expect(parseWritebackProposals("Nothing durable here.")).toEqual([]);
    expect(parseWritebackProposals("[]")).toEqual([]);
    expect(parseWritebackProposals('{"writebacks":[]}')).toEqual([]);
  });
});

describe("applyWriteback + restoreFromLedger", () => {
  it("appends a dated provenance section, ledgers with restore payload, restores", async () => {
    const vault = new MemoryVault();
    const page = await vault.createDocument({
      type: "wiki",
      title: "Sleep Repair",
      bodyMd: "Original text.",
      shelf: "Personal",
    });
    const entry = await vault.createDocument({
      type: "journal",
      title: "Tonight",
      bodyMd: "I set a hard close time.",
    });

    const applied = await applyWriteback(
      vault,
      {
        action: "update",
        pageTitle: "sleep repair", // case-insensitive resolution
        addition: "He set a hard laptop-close time.",
        reason: "rule",
      },
      { ulid: entry.ulid, title: entry.title },
    );
    expect(applied).toMatchObject({ title: "Sleep Repair", created: false });

    const after = await vault.getDocument(page.ulid);
    expect(after?.bodyMd).toContain("Original text.");
    expect(after?.bodyMd).toContain("## Held from [[Tonight]]");
    expect(after?.bodyMd).toContain("laptop-close time");

    const heldRow = (await vault.listLedger()).find((r) => r.kind === "held" && r.diffRef);
    expect(heldRow).toBeDefined();
    const restored = await restoreFromLedger(vault, heldRow!);
    expect(restored?.bodyMd).toBe("Original text.");
  });

  it("creates new pages with provenance but never shadows existing titles", async () => {
    const vault = new MemoryVault();
    const entry = await vault.createDocument({ type: "journal", title: "T", bodyMd: "b" });
    const created = await applyWriteback(
      vault,
      {
        action: "create",
        pageTitle: "Weekend Money Rule",
        shelf: "Personal",
        addition: "A durable rule about weekend spending.",
        reason: "r",
      },
      { ulid: entry.ulid, title: entry.title },
    );
    expect(created?.created).toBe(true);
    const dupe = await applyWriteback(
      vault,
      {
        action: "create",
        pageTitle: "Weekend Money Rule",
        addition: "Different text entirely here.",
        reason: "r",
      },
      { ulid: entry.ulid, title: entry.title },
    );
    expect(dupe).toBeNull();
  });

  it("refuses to write into journal entries", async () => {
    const vault = new MemoryVault();
    const entry = await vault.createDocument({ type: "journal", title: "Past Entry", bodyMd: "x" });
    const result = await applyWriteback(
      vault,
      {
        action: "update",
        pageTitle: "Past Entry",
        addition: "Should not be appended here.",
        reason: "r",
      },
      { ulid: entry.ulid, title: entry.title },
    );
    expect(result).toBeNull();
    expect((await vault.getDocument(entry.ulid))?.bodyMd).toBe("x");
  });
});
