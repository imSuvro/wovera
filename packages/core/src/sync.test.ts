import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  createRecovery,
  decryptJson,
  deriveVaultKey,
  encryptJson,
  mnemonicToRootEntropy,
} from "./crypto";
import { runMigrations } from "./migrations";
import type { MigrationIO } from "./migrations";
import { runSync } from "./sync";
import type { RemoteOp, SyncTransport } from "./sync";
import { SqliteVault } from "./vault";
import type { VaultDb } from "./vault";

function io(db: Database.Database): MigrationIO {
  return {
    exec: (sql) => {
      db.exec(sql);
    },
    getUserVersion: () => (db.pragma("user_version", { simple: true }) as number) ?? 0,
    setUserVersion: (v) => {
      db.pragma(`user_version = ${v}`);
    },
  };
}

async function device(name: string): Promise<SqliteVault> {
  const raw = new Database(":memory:");
  await runMigrations(io(raw));
  return new SqliteVault(drizzle(raw) as unknown as VaultDb, name);
}

/** In-memory stand-in for the Supabase table: seq-assigning, idempotent. */
class FakeServer implements SyncTransport {
  private ops: RemoteOp[] = [];
  private seen = new Set<string>();
  async pushOps(ops: Omit<RemoteOp, "seq">[]): Promise<void> {
    for (const op of ops) {
      if (this.seen.has(op.opUlid)) continue;
      this.seen.add(op.opUlid);
      this.ops.push({ ...op, seq: this.ops.length + 1 });
    }
  }
  async pullOps(sinceSeq: number, limit = 200): Promise<RemoteOp[]> {
    return this.ops.filter((o) => o.seq > sinceSeq).slice(0, limit);
  }
}

describe("crypto", () => {
  it("round-trips the recovery phrase and rejects bad phrases", () => {
    const { entropy, mnemonic } = createRecovery();
    expect(mnemonic.split(" ")).toHaveLength(12);
    expect(mnemonicToRootEntropy(mnemonic)).toEqual(entropy);
    expect(mnemonicToRootEntropy("not a valid phrase at all twelve words missing here ok")).toBe(
      null,
    );
  });

  it("encrypts and decrypts; a different key cannot read it", () => {
    const keyA = deriveVaultKey(createRecovery().entropy);
    const keyB = deriveVaultKey(createRecovery().entropy);
    const env = encryptJson(keyA, { secret: "the rule held first" });
    expect(decryptJson<{ secret: string }>(keyA, env).secret).toBe("the rule held first");
    expect(() => decryptJson(keyB, env)).toThrow();
    // Server-side view: ciphertext only, no plaintext leakage.
    expect(JSON.stringify(env)).not.toContain("rule held");
  });
});

describe("runSync", () => {
  it("moves a document from device A to device B, encrypted in transit", async () => {
    const key = deriveVaultKey(createRecovery().entropy);
    const server = new FakeServer();
    const a = await device("device-a");
    const b = await device("device-b");

    await a.createDocument({ type: "journal", title: "Night Entry", bodyMd: "verbatim words" });
    const first = await runSync(a, server, key);
    expect(first.pushed).toBeGreaterThan(0);

    const pullB = await runSync(b, server, key);
    expect(pullB.applied).toBeGreaterThan(0);
    const doc = (await b.listByType("journal", 5))[0];
    expect(doc?.title).toBe("Night Entry");
    expect(doc?.bodyMd).toBe("verbatim words");

    // Idempotence: syncing again changes nothing.
    const again = await runSync(b, server, key);
    expect(again.applied).toBe(0);
    expect(again.pushed).toBe(0);
  });

  it("resolves concurrent edits last-write-wins by HLC", async () => {
    const key = deriveVaultKey(createRecovery().entropy);
    const server = new FakeServer();
    const a = await device("device-a");
    const b = await device("device-b");

    const doc = await a.createDocument({ type: "wiki", title: "Rule", bodyMd: "v1" });
    await runSync(a, server, key);
    await runSync(b, server, key);

    // Both edit; B edits LAST (later HLC wall-clock).
    await a.updateDocument(doc.ulid, { bodyMd: "from A" });
    await new Promise((r) => setTimeout(r, 5));
    const bCopy = (await b.listByType("wiki", 5)).find((d) => d.title === "Rule");
    await b.updateDocument(bCopy!.ulid, { bodyMd: "from B" });

    await runSync(a, server, key);
    await runSync(b, server, key);
    await runSync(a, server, key);

    const finalA = await a.getDocument(doc.ulid);
    const finalB = await b.getDocument(doc.ulid);
    expect(finalA?.bodyMd).toBe("from B");
    expect(finalB?.bodyMd).toBe("from B");
  });

  it("wrong-key devices count undecryptable ops without corrupting the vault", async () => {
    const server = new FakeServer();
    const a = await device("device-a");
    const stranger = await device("stranger");
    await a.createDocument({ type: "journal", title: "Private", bodyMd: "secret text" });
    await runSync(a, server, deriveVaultKey(createRecovery().entropy));
    const result = await runSync(stranger, server, deriveVaultKey(createRecovery().entropy));
    expect(result.undecryptable).toBeGreaterThan(0);
    expect(result.applied).toBe(0);
    expect(await stranger.countDocuments()).toBe(0);
  });
});
