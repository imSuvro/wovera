import { decryptJson, encryptJson } from "./crypto";
import type { VaultCipherEnvelope } from "./crypto";
import type { VaultApi } from "./vault";
import type { VaultDocument } from "./index";

/**
 * The owned sync protocol — small and boring on purpose (the Actual
 * Budget / Obsidian Sync shape the architecture chose):
 *
 * - every local mutation already lands in oplog_outbox (since Phase 2)
 * - PUSH: unpushed ops go up with their payloads ENCRYPTED client-side;
 *   the server assigns a monotone sequence and stores ciphertext blobs
 * - PULL: ops since the last seen sequence come down; each decrypts and
 *   applies LAST-WRITE-WINS PER DOCUMENT by HLC stamp
 * - idempotent by op_ulid; re-pulling or re-pushing is always safe
 *
 * The server can order and store — never read. That is the whole design.
 */

export interface RemoteOp {
  seq: number;
  opUlid: string;
  docUlid: string;
  deviceId: string;
  hlc: string;
  payload: VaultCipherEnvelope;
}

export interface SyncTransport {
  /** Uploads ops; server ignores op_ulids it has seen. */
  pushOps(ops: Omit<RemoteOp, "seq">[]): Promise<void>;
  /** Ops with seq > since, ascending, capped by the server's page size. */
  pullOps(sinceSeq: number, limit?: number): Promise<RemoteOp[]>;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  applied: number;
  /** Ops that failed to decrypt — wrong key on this device. */
  undecryptable: number;
  lastSeq: number;
}

const LAST_SEQ_KEY = "sync_last_seq";
const PULL_PAGE = 200;

export async function runSync(
  vault: VaultApi,
  transport: SyncTransport,
  vaultKey: Uint8Array,
): Promise<SyncResult> {
  // PUSH — encrypt each outbox payload; plaintext never leaves this function.
  const unpushed = await vault.listUnpushedOps();
  if (unpushed.length > 0) {
    await transport.pushOps(
      unpushed.map((op) => ({
        opUlid: op.opUlid,
        docUlid: op.docUlid,
        deviceId: op.deviceId,
        hlc: op.hlc,
        payload: encryptJson(vaultKey, JSON.parse(op.payload) as VaultDocument),
      })),
    );
    await vault.markOpsPushed(unpushed.map((op) => op.opUlid));
  }

  // PULL — pages until drained.
  let lastSeq = Number((await vault.getSetting(LAST_SEQ_KEY)) ?? "0");
  let pulled = 0;
  let applied = 0;
  let undecryptable = 0;
  for (;;) {
    const page = await transport.pullOps(lastSeq, PULL_PAGE);
    if (page.length === 0) break;
    for (const op of page) {
      pulled++;
      lastSeq = Math.max(lastSeq, op.seq);
      try {
        const doc = decryptJson<VaultDocument>(vaultKey, op.payload);
        const changed = await vault.applyRemoteDocument(doc, op.hlc);
        if (changed) applied++;
      } catch {
        undecryptable++;
      }
    }
    await vault.setSetting(LAST_SEQ_KEY, String(lastSeq));
    if (page.length < PULL_PAGE) break;
  }

  return { pushed: unpushed.length, pulled, applied, undecryptable, lastSeq };
}
