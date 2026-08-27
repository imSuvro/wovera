import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { MIGRATIONS, runMigrations } from "./migrations";
import type { MigrationIO } from "./migrations";
import { SqliteVault, toFtsQuery } from "./vault";
import type { VaultDb } from "./vault";

function betterSqliteIO(db: Database.Database): MigrationIO {
  return {
    exec: (sqlText) => {
      db.exec(sqlText);
    },
    getUserVersion: () => (db.pragma("user_version", { simple: true }) as number) ?? 0,
    setUserVersion: (v) => {
      db.pragma(`user_version = ${v}`);
    },
  };
}

async function openTestVault(): Promise<{ raw: Database.Database; vault: SqliteVault }> {
  const raw = new Database(":memory:");
  await runMigrations(betterSqliteIO(raw));
  const vault = new SqliteVault(drizzle(raw) as unknown as VaultDb, "test-device");
  return { raw, vault };
}

describe("migrations", () => {
  it("apply cleanly and are idempotent", async () => {
    const raw = new Database(":memory:");
    const io = betterSqliteIO(raw);
    const v1 = await runMigrations(io);
    const v2 = await runMigrations(io);
    expect(v1).toBe(MIGRATIONS[MIGRATIONS.length - 1]!.version);
    expect(v2).toBe(v1);
    const tables = raw
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name);
    for (const t of ["documents", "links", "ledger", "oplog_outbox", "sync_state", "settings"]) {
      expect(tables).toContain(t);
    }
  });
});

describe("SqliteVault", () => {
  let raw: Database.Database;
  let vault: SqliteVault;

  beforeEach(async () => {
    ({ raw, vault } = await openTestVault());
  });

  it("creates and reads documents, writing ledger and oplog", async () => {
    const doc = await vault.createDocument({
      type: "journal",
      title: "Three Days Dry",
      bodyMd: "I am healing. See [[Personal Recovery Baseline]].",
    });
    const fetched = await vault.getDocument(doc.ulid);
    expect(fetched?.title).toBe("Three Days Dry");

    const ledgerRows = await vault.listLedger();
    expect(ledgerRows[0]).toMatchObject({ kind: "journal", summary: "Three Days Dry" });

    const ops = raw.prepare("SELECT * FROM oplog_outbox").all() as { payload: string }[];
    expect(ops).toHaveLength(1);
    expect(JSON.parse(ops[0]!.payload).title).toBe("Three Days Dry");
  });

  it("extracts wikilinks into the links table and refreshes them on update", async () => {
    const doc = await vault.createDocument({
      type: "wiki",
      title: "Recovery",
      bodyMd: "Linked to [[Sleep]] and [[Debt Turnaround|the money story]].",
      shelf: "Personal",
    });
    const targets = () =>
      raw
        .prepare("SELECT target_title FROM links WHERE from_ulid = ? ORDER BY target_title")
        .all(doc.ulid)
        .map((r) => (r as { target_title: string }).target_title);
    expect(targets()).toEqual(["Debt Turnaround", "Sleep"]);

    await vault.updateDocument(doc.ulid, { bodyMd: "Now only [[Sleep]]." });
    expect(targets()).toEqual(["Sleep"]);
  });

  it("updates bump updatedAt and produce strictly increasing HLC stamps", async () => {
    const doc = await vault.createDocument({ type: "wiki", title: "A", bodyMd: "a" });
    await vault.updateDocument(doc.ulid, { bodyMd: "b" });
    await vault.updateDocument(doc.ulid, { bodyMd: "c" });
    const hlcs = raw
      .prepare("SELECT hlc FROM oplog_outbox ORDER BY created_at, hlc")
      .all()
      .map((r) => (r as { hlc: string }).hlc);
    expect(hlcs).toHaveLength(3);
    expect([...hlcs].sort()).toEqual(hlcs);
    expect(new Set(hlcs).size).toBe(3);
  });

  it("enforces the append-only ledger at the database level", async () => {
    await vault.appendLedger("tidy", "first sweep");
    expect(() => raw.prepare("UPDATE ledger SET summary = 'rewritten'").run()).toThrow(
      /append-only/,
    );
    expect(() => raw.prepare("DELETE FROM ledger").run()).toThrow(/append-only/);
  });

  it("full-text search finds by body, ranks, snippets, and tracks updates", async () => {
    await vault.createDocument({
      type: "wiki",
      title: "Debt and Income Turnaround",
      bodyMd: "The rule held first, and then the money came.",
      shelf: "Personal",
    });
    const doc = await vault.createDocument({
      type: "wiki",
      title: "Sleep Repair",
      bodyMd: "The day needs an ending.",
      shelf: "Personal",
    });

    const hits = await vault.search("money came");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.title).toBe("Debt and Income Turnaround");
    expect(hits[0]!.snippet).toContain("»money«");

    // Prefix matching: partial final token still hits.
    expect(await vault.search("turnarou")).toHaveLength(1);

    // Updates reindex: old text stops matching, new text matches.
    await vault.updateDocument(doc.ulid, { bodyMd: "Mornings start with light." });
    expect(await vault.search("ending")).toHaveLength(0);
    expect((await vault.search("mornings"))[0]!.title).toBe("Sleep Repair");
  });

  it("survives hostile search input", async () => {
    await vault.createDocument({ type: "wiki", title: "Quotes", bodyMd: 'She said "hello" - ok' });
    await expect(vault.search('"unbalanced')).resolves.toBeDefined();
    await expect(vault.search("AND OR NOT NEAR(")).resolves.toBeDefined();
    await expect(vault.search("   ")).resolves.toEqual([]);
  });

  it("lists shelves with counts", async () => {
    await vault.createDocument({ type: "wiki", title: "A", bodyMd: "x", shelf: "Career" });
    await vault.createDocument({ type: "wiki", title: "B", bodyMd: "y", shelf: "Career" });
    await vault.createDocument({ type: "wiki", title: "C", bodyMd: "z", shelf: "Orientation" });
    await vault.createDocument({ type: "journal", title: "J", bodyMd: "j" });
    expect(await vault.listShelves()).toEqual([
      { shelf: "Career", count: 2 },
      { shelf: "Orientation", count: 1 },
    ]);
  });
});

describe("toFtsQuery", () => {
  it("quotes tokens, strips embedded quotes, and adds prefix matching", () => {
    expect(toFtsQuery('debt "turnaround')).toBe('"debt"* "turnaround"*');
    expect(toFtsQuery("  ")).toBe("");
  });
});
