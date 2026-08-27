<div align="center">

# Wovera

**A second brain that hands things back.**

[![CI](https://github.com/imSuvro/wovera/actions/workflows/ci.yml/badge.svg)](https://github.com/imSuvro/wovera/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL_3.0-813ea8.svg)](LICENSE)
[![Status: pre-alpha](https://img.shields.io/badge/status-pre--alpha,_built_in_the_open-e0a458.svg)](#roadmap)

_Put anything down — a thought, a person you met, a lecture you're studying, a thing to do later —_
_and it returns to you at the moment it matters, with a full record of everything done on your behalf._

</div>

---

Most apps in this genre are excellent at **saving** things. Notes pile up, tagged and filed, and are never seen again — the graveyard problem every note-taker knows. Wovera is built around the opposite motion: **the return trip**. The home screen isn't a blank page or a feed of what you saved; it's what your vault is handing back to you today.

Underneath is a voice-first journal with an AI that has genuinely read your story — grounded in your own pages, citing them back to you — plus a self-organizing wiki, a people shelf, gentle reminders, and study sessions over anything you paste in.

Wovera grew out of a real markdown vault its maker lived in daily for months — journal, wiki, people, and an append-only log, tended by an AI. The app is that system's second life, rebuilt so anyone can live in it.

## The promises

These are architecture, not policy — the code is public so you can check them:

- **Your words are never rewritten.** Dictation is kept verbatim, raw audio preserved. The AI compiles _around_ your words, never over them.
- **Your journal is never used to train any AI, never read, never sold.** Speech recognition runs on-device. Cloud AI calls run only under contractual no-training terms, only with what the moment needs, storing nothing.
- **Everything the AI does is visible and reversible.** Every write lands in an append-only Ledger — tap any line, see the exact change, undo it. Consumer apps don't do this; banks do.
- **No guilt mechanics.** No streak-shaming, no red badges, no "come back tomorrow" caps mid-entry. It pings you only about things you explicitly asked it to hold.
- **It never feels slow.** Local-first: the vault lives on your device, so opening, browsing, and searching work instantly, offline, always. Sync happens quietly behind you.
- **You can leave, whole, any day.** Plain, exportable data. Comfort includes knowing the door is open.

## How it's built

One TypeScript codebase → Android, iOS, and web (Expo SDK 57). Local SQLite vault with full-text search; on-device speech recognition; an owned oplog sync protocol with end-to-end encryption (server sees ciphertext only); AI on Gemini under paid-tier no-training terms, with on-device embeddings planned for search. The full reasoning lives in [ADR 0001 — The five pillars](docs/adr/0001-the-five-pillars.md).

| Path                                     | What lives there                                        |
| ---------------------------------------- | ------------------------------------------------------- |
| [`apps/mobile`](apps)                    | The Expo app (arrives in Phase 1)                       |
| [`packages/core`](packages/core)         | Vault domain: documents, links, Ledger, oplog — pure TS |
| [`packages/importer`](packages/importer) | Imports an existing Obsidian-style markdown vault       |
| [`docs`](docs)                           | Architecture decision records & design notes            |

## Roadmap

The experience ships in chapters — the design was written as a story before any code:

- [ ] **The Lamp** — voice capture: talk, and your words are kept exactly _(building now)_
- [ ] **The reply** — an AI response grounded in your own vault, with citations
- [ ] **The morning after** — Today: threads being held, quiet continuity
- [ ] **Remember anything** — quick capture that files itself, visibly
- [ ] **The Shelves** — your knowledge, browsable, with provenance on every page
- [ ] **The Ledger** — the audit trail a normal person can read
- [ ] **Studying with your shelves** — paste a transcript, talk it through
- [ ] **House Rules** — the skeleton locked, everything else yours
- [ ] Sync across devices, end-to-end encrypted
- [ ] Android release → web → iOS

## Developing

```bash
corepack enable   # Node >= 22
pnpm install
pnpm verify       # lint + typecheck + tests — the gate CI runs
```

The mobile app and its run instructions land with Phase 1. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and the comfort contract every change is measured against.

## License

[AGPL-3.0](LICENSE) — free to use, study, and improve; anyone who ships a modified version, including as a service, must share their changes back. The privacy claims above stay verifiable for everyone, in every fork.
