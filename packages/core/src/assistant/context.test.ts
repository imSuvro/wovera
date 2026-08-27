import { describe, expect, it } from "vitest";
import { MemoryVault } from "../memoryVault";
import { buildReplyContext, significantTerms } from "./context";

describe("significantTerms", () => {
  it("surfaces content words, drops stopwords and short words", () => {
    const terms = significantTerms(
      "I was thinking about the credit card debt again and the sleep problem. Debt debt sleep.",
    );
    expect(terms[0]).toBe("debt"); // most frequent
    expect(terms).toContain("sleep");
    expect(terms).not.toContain("the");
    expect(terms).not.toContain("was");
  });
});

describe("buildReplyContext", () => {
  it("grounds the reply in matching wiki pages and recent entries", async () => {
    const vault = new MemoryVault();
    const page = await vault.createDocument({
      type: "wiki",
      title: "Debt and Income Turnaround",
      bodyMd: "The refusal to take another loan. The rule held first, then the money came.",
      shelf: "Personal",
    });
    await vault.createDocument({
      type: "wiki",
      title: "Unrelated Gardening",
      bodyMd: "Tomatoes want sun.",
      shelf: "Hobby",
    });
    const earlier = await vault.createDocument({
      type: "journal",
      title: "Reset Night",
      bodyMd: "Trying to fix my sleep before the trip.",
      createdAt: Date.now() - 86_400_000,
    });
    const entry = await vault.createDocument({
      type: "journal",
      title: "Tonight",
      bodyMd: "The debt is finally cleared and I want to keep the loan rule alive.",
    });

    const ctx = await buildReplyContext(vault, entry);
    expect(ctx.sources.map((s) => s.title)).toContain("Debt and Income Turnaround");
    expect(ctx.sources.map((s) => s.title)).not.toContain("Unrelated Gardening");
    expect(ctx.userPrompt).toContain(`PAGE "${page.title}"`);
    expect(ctx.userPrompt).toContain(`EARLIER ENTRY "${earlier.title}"`);
    expect(ctx.userPrompt).toContain("TONIGHT'S ENTRY");
    expect(ctx.userPrompt).toContain("debt is finally cleared");
    // The entry itself is never offered as its own source.
    expect(ctx.sources.map((s) => s.ulid)).not.toContain(entry.ulid);
  });
});
