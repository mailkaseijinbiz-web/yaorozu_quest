# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ The import above is not boilerplate. This repo pins a **special build of Next.js (16.2.7)** whose APIs, conventions, and file structure may differ from your training data. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices.

## What this is

**八百万クエスト (Yaorozu Quest)** — a location-based pilgrimage game. Players visit real-world shrines/temples ("場 / Spot"), converse with the AI deity ("八百万神 / Agent") inhabiting each place, and complete generated quests/tasks to earn "徳 (Toku)" — leveling up titles, levels, and badges. The UI is a single mobile-framed Next.js app (3 tabs) plus a password-gated admin console at `/admin`.

The authoritative, deep design document is **`docs/SPEC.md`** (~930 lines). Read it before any non-trivial change — it documents the domain model, toku economy, generation/throttling rules, AI failover, and every API route. This file is the orientation; SPEC.md is the reference.

## Commands

```bash
npm run dev          # Next dev server (turbopack) at http://localhost:3000
npm run build        # Production build. If it fails with stale type errors, `rm -rf .next` first
npm start            # Serve the production build
npm run lint         # eslint (see note below — many rules are warn-only in CI)
npm test             # vitest run (one-shot)
npm run test:watch   # vitest watch mode
```

- **Node ≥ 20.9 (repo pins 22 via `.nvmrc`; CI uses 22).** Next 16 will not build on Node 18. Run `nvm use`.
- **Run a single test:** `npx vitest run src/lib/geo.test.ts` or filter by name with `npx vitest run -t "distanceKm"`.
- **Typecheck like CI does:** `rm -rf .next && npx tsc --noEmit`. The `.next` cache can hold stale type defs (e.g. references to deleted routes) and cause false-positive errors — delete it first.
- Path alias: `@/*` → `./src/*` (tsconfig).

### CI (`.github/workflows/ci.yml`)

Runs on every PR and on push to `main`: **typecheck** (`tsc --noEmit` after `rm -rf .next`), **test** (`npm test`), then **lint**. Lint is currently run with `|| true` (non-blocking) because the React 19 + special-Next `react-hooks` rules flag many existing `error`s; don't treat a clean lint as a gate, but don't add new violations either.

## Architecture

Layered around a **client-side mock database** that lazily syncs to Supabase. There is no traditional server-side data layer — `src/lib/db.ts` is the domain model and it reads/writes `localStorage`.

| Layer | Key files | Role |
|---|---|---|
| Presentation | `src/app/page.tsx` (~1340 lines, the orchestrator), `src/components/{HomeTab,MapTab,LeafletMap,SpotDetail,ChatTab,...}.tsx` | 3-tab mobile UI, map, spot detail, AI chat |
| Admin console | `src/app/admin/page.tsx`, `src/components/admin/*` | Password-gated; 7 tabs (blueprint/analytics/spots/gods/users/challenges/activity) |
| Domain / data | `src/lib/db.ts` (`MockDatabase`) | Single source of truth; `localStorage`-backed entities + all game logic |
| Cloud sync | `src/lib/cloud-sync.ts` | Supabase snapshot push (debounced) / pull |
| API routes | `src/app/api/{chat,generate-quest,generate-spot,photo-feedback,upload,persist,push/*,admin/login}/route.ts` | AI generation, image upload, persistence, push, admin auth |
| Static data / generators | `src/data/{tasks,challenges,challenge-seed,levels,badges,god-tasks,tokyo-spots,tokyo-temples,*-trivia,walk-missions}.ts` | Quest/level/badge/task catalogs + deterministic procedural generators |
| Utilities | `src/lib/{geo,goshuin,dainichi,place-docs,upload,supabase,quest-tour,walk-guide,...}.ts` | Geo math, go-shuin, deity documents, image processing |

### How data flows (the loop to understand first)

1. **Startup:** `page.tsx` mounts → `pullSnapshot()` (`GET /api/persist?userId=user-self`) restores the cloud snapshot into `localStorage` (with `suspendPush` to avoid self-triggering a push), then refreshes React state from `db`.
2. **Location:** GPS via `watchPosition` (only started *after* onboarding completes — see below). When no Spot exists near the user, the app generates one.
3. **Generation (chained):** `POST /api/generate-spot` returns a Spot + Agent (+ nearby `extras`) from the user's coordinates → saved via `db.adminSaveSpot/adminSaveAgent`. If the spot has no quests, `POST /api/generate-quest` is chained to mint them.
4. **Play:** visits/photos/UGC/quest steps award toku through `db` methods. Every write goes through `db.save()`, which calls `schedulePush()`.
5. **Sync:** `schedulePush()` debounces ~1500ms then `POST /api/persist` with the **16 `SYNC_KEYS`** (a subset of all localStorage keys — trivia and metrics are deliberately *not* synced).
6. **Activity bus:** mutations call `logActivity()`, which dispatches a `yaorozu:activity` `CustomEvent` so other frames (e.g. the admin console) update live.

### Conventions and traps that will bite you

These are non-obvious invariants — verify against `db.ts` / `SPEC.md` before changing related code:

- **Tab key/label inversion:** in `NAV_TABS`, `key='home'` renders the **クエスト (quest list)** and `key='quest'` renders the **マップ (map)**. Read carefully.
- **Single-user demo:** the current user is hardcoded `user-self`; the cloud snapshot ID is the fixed string `user-self`. OAuth (Supabase Auth) support exists and re-scopes sync per authenticated user, but defaults to guest/`user-self`.
- **Empty-user guard:** `getUsers()`, `pullSnapshot()`, and `pushNow()` all bail if `yaorozu_users` is empty/non-array, to avoid wiping `user-self` (which blanks My Page). Preserve this guard.
- **Spot verification id mismatch:** `isVerifiedSpot()` treats only the `tk-` id prefix as unverified, but `generate-spot` returns `gps-`–prefixed spots — so generated spots read as "verified." Set the `verified` flag explicitly where it matters (documented in SPEC §4.2 / §12.3).
- **TTL is set client-side:** AI-generated spots get an `expiresAt` (default 30 days, `SPOT_TTL_MS`) assigned *in `page.tsx`*, not by the API. `getSpots()` lazily filters/deletes expired spots + their Agents on read. Verified (real) spots get no TTL.
- **Deletes are respected:** generation skips spots in `getDeletedSpots()` and never overwrites an existing spot id (protects accumulated photos/UGC).
- **Onboarding gates geolocation:** GPS `watchPosition` and auto-generation must not run until onboarding finishes (`needsOnboard === false`) — otherwise the OS permission dialog fires before the priming step, and generation runs against the default Tokyo center coordinate. `needsOnboard` starts `null` (undetermined) by design.
- **AI is best-effort, never throws:** all generation routes fail over **Gemini (gemini-2.5-flash) → OpenAI (gpt-4o-mini) → rule-based fallback**, and return HTTP 200 with a `mode`/`source` field even on error (graceful degradation). The app fully works with zero API keys.
- **Procedural generators are deterministic:** `generateTrivia`, `generateChallenges(seed)`, `generateSimpleChallenges(seed)` use seeded `mulberry32` PRNG — same seed → same output. Don't introduce nondeterminism into them.
- **Tests are colocated** as `*.test.ts` next to the unit under test (e.g. `src/lib/geo.test.ts`, `src/data/levels.test.ts`). Pure logic (geo math, snapshot merge, quest fallback, walk guide) is the tested surface; UI is not.

### Environment & config

- Copy `.env.example` → `.env.local` (gitignored). Notable vars: `ADMIN_PASSWORD` (**required** to log into `/admin`), `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server-only, API routes), `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser, optional auth), `GEMINI_API_KEY`/`OPENAI_API_KEY` (AI, optional), `VAPID_*` (web push, optional). All AI/auth/push features degrade gracefully when unset.
- `local_llm_config.json` (`src/config.ts`): if present, points generation at a local LLM endpoint instead.
- Supabase schema lives in `supabase/schema.sql` (and `src/lib/schema.sql`): `user_snapshots` table (one JSON row per user) + a `photos` Storage bucket.
- **Capacitor / iOS:** `capacitor.config.json` + `ios/` wrap the web app as a native iOS app (push via APNs). See `docs/IOS.md`, `docs/APNS.md`, `docs/PUSH.md`, `docs/APP_STORE_SUBMISSION.md`.

### Further docs

`docs/` holds focused guides: `SPEC.md` (full spec — start here), `DEPLOY.md`, `AUTH.md`, `BADGES.md`, `IOS.md`, `APNS.md`, `PUSH.md`, `APP_STORE_SUBMISSION.md`. `DEVELOPMENT_STATUS.md` tracks what is still mock/placeholder vs. production-ready (AR, in-app photo posting, 3D avatars, and the ~1000 seeded Tokyo spots/challenges are demo/generated data, not verified real-world data).

The codebase and most comments are in **Japanese**; match that when editing. Commit messages follow Conventional Commits with a Japanese summary, e.g. `feat(walk): 周遊プラン「◯社めぐり」…`.
