import type { RemoteOp, SyncTransport, VaultCipherEnvelope } from "@wovera/core";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The Supabase implementation of the sync wire — ciphertext in, ciphertext out. */
export class SupabaseTransport implements SyncTransport {
  constructor(private readonly client: SupabaseClient) {}

  async pushOps(ops: Omit<RemoteOp, "seq">[]): Promise<void> {
    if (ops.length === 0) return;
    const { error } = await this.client.from("vault_ops").upsert(
      ops.map((op) => ({
        op_ulid: op.opUlid,
        doc_ulid: op.docUlid,
        device_id: op.deviceId,
        hlc: op.hlc,
        payload: op.payload,
      })),
      { onConflict: "user_id,op_ulid", ignoreDuplicates: true },
    );
    if (error) throw new Error(`sync-push: ${error.message}`);
  }

  async pullOps(sinceSeq: number, limit = 200): Promise<RemoteOp[]> {
    const { data, error } = await this.client
      .from("vault_ops")
      .select("seq, op_ulid, doc_ulid, device_id, hlc, payload")
      .gt("seq", sinceSeq)
      .order("seq", { ascending: true })
      .limit(limit);
    if (error) throw new Error(`sync-pull: ${error.message}`);
    return (data ?? []).map((row) => ({
      seq: row.seq as number,
      opUlid: row.op_ulid as string,
      docUlid: row.doc_ulid as string,
      deviceId: row.device_id as string,
      hlc: row.hlc as string,
      payload: row.payload as VaultCipherEnvelope,
    }));
  }

  /** Does this account already hold a vault? Drives the restore-phrase flow. */
  async hasRemoteOps(): Promise<boolean> {
    const { count, error } = await this.client
      .from("vault_ops")
      .select("seq", { count: "exact", head: true });
    if (error) return false;
    return (count ?? 0) > 0;
  }
}
