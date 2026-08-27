## What this changes

<!-- The user-facing consequence, in a sentence or two. -->

## How it was verified

- [ ] `pnpm verify` passes locally
- [ ] Tested on a real Android device (release build, if perf-relevant)
- [ ] UI change → screenshot/clip attached

## Contract check

- [ ] No user words are rewritten or leave the device without explicit, labeled consent
- [ ] Any AI/system write is recorded in the Ledger and reversible
- [ ] Nothing from the performance forbidden list (live blur, software shadows, layout-prop animation, IO in tap handlers)
