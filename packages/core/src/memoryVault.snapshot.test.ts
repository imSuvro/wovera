import { describe, expect, it } from "vitest";
import { MemoryVault } from "./memoryVault";

describe("memory vault snapshot", () => {
  it("carries documents, ledger, links, and settings across a restore", async () => {
    const vault = new MemoryVault();
    await vault.createDocument({
      type: "wiki",
      title: "Evening Routine",
      bodyMd: "A walk, not a screen.",
      shelf: "Rhythms",
    });
    const entry = await vault.createDocument({
      type: "journal",
      title: "First words",
      bodyMd: "Walked to the lake. See [[Evening Routine]].",
    });
    await vault.attachReply(entry.ulid, "A steady start.", ["Evening Routine"]);
    await vault.setSetting("voice_tone", "Gentle");

    const revived = new MemoryVault();
    revived.restore(vault.snapshot());

    expect(await revived.countDocuments()).toBe(2);
    expect((await revived.getDocumentByTitle("Evening Routine"))?.shelf).toBe("Rhythms");
    expect((await revived.getDocument(entry.ulid))?.replyMd).toBe("A steady start.");
    expect(await revived.getLinkTargets(entry.ulid, "reply")).toEqual(["Evening Routine"]);
    expect((await revived.getBacklinks("Evening Routine")).map((d) => d.title)).toContain(
      "First words",
    );
    expect(await revived.getSetting("voice_tone")).toBe("Gentle");
    expect((await revived.listLedger(10)).length).toBe((await vault.listLedger(10)).length);
    expect((await revived.listShelves())[0]?.shelf).toBe("Rhythms");
  });

  it("keeps writing cleanly after a restore — the ledger never collides", async () => {
    const vault = new MemoryVault();
    await vault.createDocument({ type: "journal", title: "One", bodyMd: "one" });
    const revived = new MemoryVault();
    revived.restore(vault.snapshot());
    await revived.createDocument({ type: "journal", title: "Two", bodyMd: "two" });
    const ids = (await revived.listLedger(50)).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ignores a snapshot from a future version rather than half-loading it", async () => {
    const vault = new MemoryVault();
    await vault.createDocument({ type: "journal", title: "Kept", bodyMd: "safe" });
    const future = { ...vault.snapshot(), version: 2 as unknown as 1 };
    vault.restore(future);
    expect(await vault.countDocuments()).toBe(1);
  });
});
