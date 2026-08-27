# Security Policy

Wovera stores people's private journals. Security reports are taken seriously and handled with priority.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

- Preferred: use GitHub's private reporting — **Security → Report a vulnerability** on this repository.
- You should receive an acknowledgment within 72 hours.

Please include reproduction steps and the version/commit affected. Good-faith research on your own data and devices is welcome; please never test against another person's vault.

## Scope notes

- The privacy model (what leaves the device, when, and under which terms) is documented in `docs/` — reports that find gaps between that document and the code are exactly the reports we want.
- Secrets never live in this repository. If you find one in the history, report it privately and it will be rotated immediately.

## Supported versions

Pre-release: only the latest commit on `main` is supported.
