# ADR 0001 — The five pillars

Status: accepted · 2026-08-27

Wovera's architecture was decided up front from five research passes (speech, local-first storage/sync, backend free tiers, React Native performance, and Gemini API data terms). The decisions, and the reasons that bind them:

## 1. Hearing — on-device speech recognition

`expo-speech-recognition` driving the OS recognizers with on-device mode forced. Raw PCM audio is persisted alongside the live transcript (the verbatim promise's safety net). The more-accurate network recognizer exists only as an explicit, labeled, off-by-default toggle. On-device Whisper was rejected for live use (~5× slower than real-time on mid-range Android).

## 2. Living — local-first vault, owned sync, E2EE

One `expo-sqlite` database (Drizzle, WAL, FTS5) on Android/iOS/web. Every screen paints from local data; the network is optional by construction. Sync (next phase) is an owned oplog protocol — ULID ops, hybrid logical clocks, last-write-wins per document — with document bodies encrypted client-side (libsodium) so the server holds ciphertext only. Commercial sync engines were rejected: each either costs, pauses free projects, or must read data server-side.

## 3. Talking — Supabase Mumbai, portable by design

Managed auth + Postgres + functions on the free tier, no card, Mumbai region, and a DPA compatible with the privacy promise. The sync endpoints stay in one portable module; Cloudflare Workers + D1 is the pre-planned exit if the ~250-user free-tier ceiling arrives before revenue.

## 4. Feeling — the performance frame

Expo SDK 57 (≥57.0.9), Reanimated 4 CSS animations (UI-thread only), FlashList v2, expo-router native stack, MMKV for pre-render-readable prefs, React Compiler on. Budgets on a Snapdragon-6-class device: cold start ≤1.5 s, tap feedback <100 ms, ≥58 fps scroll, APK <30 MB. Forbidden: live blur, software shadows, layout-prop animation, IO in tap handlers.

## 5. Thinking — Gemini under paid-tier data terms at $0

The free Gemini API tier trains on submitted content (and is human-reviewable) in India — disqualified for real journal data. Google's terms flip to no-training "Paid Services" the moment a billing account is _attached_, before any money is charged: billing attached + free quota = no-training terms at $0. Replies on Gemini Flash; background work on Flash-Lite; semantic search planned fully on-device (EmbeddingGemma + sqlite-vec). Development against synthetic data may use the free tier; real vault data requires the billing-attached project. Product obligations from the terms: 18+, and AI framed as supportive reflection — never therapy.

## The binding idea

Speed, privacy, and $0 are one decision: local-first makes the network irrelevant (speed), which enables end-to-end encryption (privacy), which reduces every server to a blob store (making free tiers safe to rely on and trivial to leave).
