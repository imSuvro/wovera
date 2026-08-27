import { describe, expect, it } from "vitest";
import { MemoryVault } from "../memoryVault";
import { applyRoute, listThreads, localStampToMs, parseRouteResult } from "./routing";

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
