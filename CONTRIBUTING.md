# Contributing to Wovera

Thanks for looking under the hood. Wovera is built in the open — partly so anyone can verify its privacy claims in code, partly because a second brain should not be a black box.

## Ground rules

- **Product direction rests with the maintainer.** Issues and PRs are very welcome; the comfort-first design contract (see `docs/`) is the bar every change is measured against.
- **Privacy is architecture here, not policy.** Changes that move user words off-device, add tracking, or weaken the verbatim/ledger guarantees will not be merged, however clever.
- Be kind. The [Code of Conduct](CODE_OF_CONDUCT.md) applies everywhere in this project.

## Getting started

```bash
# Node >= 22 (see .nvmrc / engines), pnpm via corepack
corepack enable
pnpm install
pnpm verify   # lint + typecheck + test — the same gate CI runs
```

The repository is a pnpm monorepo:

| Path                | What lives there                                                        |
| ------------------- | ----------------------------------------------------------------------- |
| `apps/mobile`       | The Expo app — Android, iOS, and web from one codebase                  |
| `packages/core`     | Pure-TS vault domain: documents, ledger, oplog. No React Native imports |
| `packages/importer` | Markdown vault importer (Obsidian/PCC format). Read-only on sources     |
| `docs/`             | Architecture decision records and design notes                          |

## Commits and PRs

- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `perf:`, `test:` — scoped when useful (`feat(core): …`).
- Keep PRs focused; describe the user-facing consequence, not just the diff.
- `pnpm verify` must pass; CI runs the same three steps plus a secret scan.
- New behavior in `packages/*` needs tests. UI changes need a screenshot or clip.

## Performance is a feature

Wovera targets mid-range Android. The forbidden list from our performance research applies to every PR: no live blur, no software shadows, no layout-prop animation, no IO awaited inside tap handlers, and no perf conclusions drawn from dev builds.
