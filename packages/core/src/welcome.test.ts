import { describe, expect, it } from "vitest";
import { MemoryVault } from "./memoryVault";
import { ensureWelcomeLetter, isFirstEvening, WELCOME_SHELF, WELCOME_TITLE } from "./welcome";

describe("the first evening", () => {
  it("shelves the welcome letter exactly once", async () => {
    const vault = new MemoryVault();
    await ensureWelcomeLetter(vault);
    await ensureWelcomeLetter(vault);
    const pages = await vault.listShelf(WELCOME_SHELF);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.title).toBe(WELCOME_TITLE);
  });

  it("writes the letter as real house content — findable, shelved, ledgered", async () => {
    const vault = new MemoryVault();
    await ensureWelcomeLetter(vault);
    const letter = await vault.getDocumentByTitle(WELCOME_TITLE);
    expect(letter?.type).toBe("wiki");
    expect(letter?.shelf).toBe(WELCOME_SHELF);
    expect(letter?.bodyMd).toContain("kept exactly as you said it");
    const ledger = await vault.listLedger(10);
    expect(ledger.some((row) => row.summary.includes(WELCOME_TITLE))).toBe(true);
  });

  it("is the first evening until an entry is kept — the letter alone doesn't end it", async () => {
    const vault = new MemoryVault();
    await ensureWelcomeLetter(vault);
    expect(await isFirstEvening(vault)).toBe(true);
    await vault.createDocument({ type: "journal", title: "First words", bodyMd: "Hello." });
    expect(await isFirstEvening(vault)).toBe(false);
  });
});
