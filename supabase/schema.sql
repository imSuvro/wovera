-- Wovera sync store — run once in the Supabase SQL editor.
--
-- The server's entire job: order ciphertext and give it back. Payloads are
-- XChaCha20-Poly1305 envelopes encrypted on-device; nobody with database
-- access (including the project owner) can read vault content.

create table if not exists public.vault_ops (
  seq        bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  op_ulid    text not null,
  doc_ulid   text not null,
  device_id  text not null,
  hlc        text not null,
  payload    jsonb not null,   -- {n, c, v}: nonce + ciphertext + version
  created_at timestamptz not null default now(),
  unique (user_id, op_ulid)    -- idempotent pushes
);

create index if not exists vault_ops_user_seq on public.vault_ops (user_id, seq);

alter table public.vault_ops enable row level security;

-- Each person sees and writes only their own ops.
create policy "own ops: read"
  on public.vault_ops for select
  using (auth.uid() = user_id);

create policy "own ops: append"
  on public.vault_ops for insert
  with check (auth.uid() = user_id);

-- Deliberately NO update or delete policies: the server is append-only,
-- like the Ledger. History accumulates; it never rewrites.
