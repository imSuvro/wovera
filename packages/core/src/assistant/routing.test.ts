import { describe, expect, it } from "vitest";
import { MemoryVault } from "../memoryVault";
import {
  applyRoute,
  isQuestionShaped,
  listThreads,
  localStampToMs,
  parseRouteResult,
} from "./routing";

describe("parseRouteResult", () => {
  it("parses reminders with valid local stamps", () => {
    const r = parseRouteResult(
      '{"kind":"reminder","title":"Call Ma","remindAtLocal":"2026-08-27 15:40","personName":null}',
      "fallback",
    );
    expect(r).toMatchObject({ kind: "reminder", title: "Call Ma" });
    expect(r.remindAtLocal).toBe("2026-08-27 15:40");
  });

  it("degrades timeless reminders and nameless persons to notes", () => {
    expect(
      parseRouteResult('{"kind":"reminder","title":"Sometime","remindAtLocal":null}', "f").kind,
    ).toBe("note");
    expect(parseRouteResult('{"kind":"person","title":"Someone"}', "f").kind).toBe("note");
    expect(parseRouteResult("not json at all", "my capture text").title).toBe("my capture text");
  });

  it("accepts question routes with a title and nulled extras", () => {
    const r = parseRouteResult(
      '{"kind":"question","title":"What did I write about debt"}',
      "fallback",
    );
    expect(r).toEqual({
      kind: "question",
      title: "What did I write about debt",
      remindAtLocal: null,
      personName: null,
    });
  });

  it("degrades malformed question JSON to a note", () => {
    const r = parseRouteResult('{"kind":"question","title":', "what did I write about debt?");
    expect(r.kind).toBe("note");
    expect(r.title).toBe("what did I write about debt?");
  });
});

describe("isQuestionShaped", () => {
  it("is true for question-shaped captures", () => {
    expect(isQuestionShaped("What did I write about debt?")).toBe(true);
    expect(isQuestionShaped("how do I set up reminders")).toBe(true);
    expect(isQuestionShaped("is this working")).toBe(true);
    expect(isQuestionShaped("Call Ma at 7?")).toBe(true); // trailing "?" wins
    expect(isQuestionShaped("Who is Rahul")).toBe(true);
    expect(isQuestionShaped("  WHERE did the receipts go  ")).toBe(true);
  });

  it("is false for statements, including interrogative-prefixed words", () => {
    expect(isQuestionShaped("Call Ma at 7 pm")).toBe(false);
    expect(isQuestionShaped("Remember the milk")).toBe(false);
    // "whatever" must not match the "what" opener — word boundaries matter.
    expect(isQuestionShaped("Whatever happens, keep going")).toBe(false);
    expect(isQuestionShaped("Willpower is a muscle")).toBe(false);
    expect(isQuestionShaped("")).toBe(false);
    expect(isQuestionShaped("   ")).toBe(false);
  });
});

describe("localStampToMs", () => {
  it("round-trips through local Date", () => {
    const ms = localStampToMs("2026-08-27 15:40");
    const d = new Date(ms);
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]).toEqual([
      2026, 8, 27, 15, 40,
    ]);
  });
});

describe("applyRoute", () => {
  it("files a reminder as a thread with a clock and ledgers it", async () => {
    const vault = new MemoryVault();
    const applied = await applyRoute(vault, "Call Ma in two hours", {
      kind: "reminder",
      title: "Call Ma",
      remindAtLocal: "2026-08-27 15:40",
      personName: null,
    });
    expect(applied.kind).toBe("reminder");
    expect(applied.remindAtMs).toBe(localStampToMs("2026-08-27 15:40"));
    expect(applied.doc.type).toBe("thread");
    expect(applied.chip).toContain("Held with a clock");
    const ledger = await vault.listLedger();
    expect(ledger[0]?.summary).toContain("Call Ma");
  });

  it("creates a person page, then appends dated notes with a restore payload", async () => {
    const vault = new MemoryVault();
    const first = await applyRoute(vault, "Met Mr. XYZ, developer from California", {
      kind: "person",
      title: "Met Mr. XYZ",
      remindAtLocal: null,
      personName: "Mr. XYZ",
    });
    expect(first.doc.type).toBe("person");
    expect(first.doc.shelf).toBe("People");

    const second = await applyRoute(vault, "XYZ mentioned he is visiting in October", {
      kind: "person",
      title: "XYZ visit",
      remindAtLocal: null,
      personName: "mr. xyz", // case-insensitive match
    });
    expect(second.doc.ulid).toBe(first.doc.ulid);
    const page = await vault.getDocument(first.doc.ulid);
    expect(page?.bodyMd).toContain("developer from California");
    expect(page?.bodyMd).toContain("visiting in October");
    const restoreRow = (await vault.listLedger()).find((r) => r.diffRef);
    expect(restoreRow).toBeDefined();
  });

  it("defensively files a question route exactly like a note", async () => {
    const vault = new MemoryVault();
    const applied = await applyRoute(vault, "what did I write about debt?", {
      kind: "question",
      title: "What did I write about debt",
      remindAtLocal: null,
      personName: null,
    });
    expect(applied.kind).toBe("note");
    expect(applied.doc.type).toBe("thread");
    expect(applied.chip).toBe("Held as a thread");
    expect(applied.remindAtMs).toBeNull();
  });

  it("lists threads soonest-clock-first", async () => {
    const vault = new MemoryVault();
    await applyRoute(vault, "loose idea", {
      kind: "note",
      title: "Loose idea",
      remindAtLocal: null,
      personName: null,
    });
    await applyRoute(vault, "later", {
      kind: "reminder",
      title: "Later",
      remindAtLocal: "2026-08-28 10:00",
      personName: null,
    });
    await applyRoute(vault, "sooner", {
      kind: "reminder",
      title: "Sooner",
      remindAtLocal: "2026-08-27 18:00",
      personName: null,
    });
    const threads = await listThreads(vault);
    expect(threads.map((t) => t.title)).toEqual(["Sooner", "Later", "Loose idea"]);
  });
});
