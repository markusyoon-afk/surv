# SURV Build Playbook

The complete record of how SURV was built — architecture, patterns, pitfalls, and a
replication recipe for future builds. Companion docs: [PRODUCT_SPEC.md](PRODUCT_SPEC.md)
(vision + lineage), [SAGE-ALGORITHM.md](SAGE-ALGORITHM.md) (the confidential math),
[BACKEND.md](BACKEND.md) (Supabase execution plan).

## 1. What was built

A social decision engine: post a decision (SURV) → your circles vote weighted by earned
expertise (SAGE) → act → swipe the verdict → the algorithm learns who to trust, per
person, per category. iOS-first PWA, live at **https://markusyoon-afk.github.io/surv/**,
~30 commits from empty repo to product, 62 automated tests.

## 2. Stack decisions (and why)

| Choice | Why |
|---|---|
| Expo + React Native + TypeScript | One codebase → iOS (Expo Go / future EAS), Android, web; dev on Windows |
| PWA on GitHub Pages | Installable app + permanent URL + auto-updates with **zero accounts/cost**; deploys via gh-pages branch |
| Pure-TS engine (`src/engine/`) | All logic is framework-free functions → unit-testable, portable to a server unchanged |
| Deterministic simulation | Arena/population generated from seeds+clock → every device sees the same world, zero storage/server |
| Zero-key APIs | OSM Nominatim (geocode) + Overpass (places), .ics paste (calendar), BroadcastChannel (live), Anthropic BYOK (AI) |
| System font + Space Grotesk display | The top-app typography pattern: native body, distinctive brand layer |

## 3. Repo map

```
src/engine/    sage (algorithm) · store (state+persistence) · drafts · suggest · smart
               arena · population · trending · schedule · digest · connections · seed · types
src/lib/       share (link protocol) · live (realtime iface) · geo (OSM)
src/components/ SurvCard · ArenaFeed · DraftCards · DigestCard · OwlAvatar(+avatarMap) · NestFrame · NightSky · Onboarding
src/screens/   HomeFeed(Tree/Forest) · NewSurv · SurvDetail · Nests · Sages · Profile
scripts/       make-icons (PNG generator) · deploy-pages · post-export (PWA-ify) · serve-web · ci/deploy.yml (staged)
supabase/      schema.sql (full multiplayer backend, RLS + server-side grading)
web-assets/    manifest · sw.js · icons
```

## 4. Core patterns worth replicating

- **Engine/store split**: pure functions compute; the React store only owns transitions.
  Made the future backend swap a store-only change, and everything testable via `tsx`.
- **Deterministic virtual population**: `makeAvatar(i)` from a seeded PRNG; 100k users
  exist as math, materialize on interaction, cached with a cap. Scale = change a const.
- **Deterministic time-based world**: arena SURVs derive from `floor(now/bucket)` —
  live votes "grow" as pure functions of elapsed time. No cron, no server, no storage.
- **Hash-fragment protocol** (`#s=`, `#v=`, `#i=`): SURVs, votes, and invites travel as
  URL payloads; iMessage is the transport. Zero backend multiplayer.
- **Interface-first realtime**: `publishLive/subscribeLive` over BroadcastChannel today;
  Supabase channel drops in behind the identical interface.
- **PNG generator + emitted require-map**: hand-rolled PNG encoder draws brand assets
  (owls, icons) in CI-free node; the script *emits the TS asset map* so 45 variants
  need no hand-written requires.
- **Persistence with migrations**: one versioned JSON blob in AsyncStorage; hydration
  applies migrations (add seeded users, retire nests) with `?? defaults` for new fields.
- **stateRef for timers**: `stateRef.current = {…}` each render so setTimeout advisor
  bursts never act on stale closures.
- **Adaptive reputation math**: gain = headroom × evidence (Elo-K style), surprise
  multiplier for contrarian correctness, herding penalty — see SAGE-ALGORITHM.md.
- **Test battery as ratchet**: `npm test` = regression + stress/validation/quality
  suites; every feature lands with tests so future edits can't silently regress
  (the SMART gate caught 3 real bugs the day it was written).

## 5. Hard-won pitfalls (read before touching)

1. **SW fallback must be navigate-only** — returning cached index.html for a failed
   *script* request executes HTML as JS and bricks the app (the iPhone lock-up).
2. **Never let font loading gate the app** — `useFonts` can hang; proceed on
   load ∥ error ∥ 2.5s timeout, and wrap the tree in an ErrorBoundary.
3. **`keyboardShouldPersistTaps="handled"`** on every ScrollView with inputs — else iOS
   swallows the next tap to dismiss the keyboard ("dead buttons").
4. **`deploy:pages` leaves dist in /surv mode** — script now rebuilds root afterward;
   symptom was a blank localhost preview.
5. **PowerShell `Get-Content -Raw | Set-Content` mangles UTF-8** (mojibake) — use the
   Edit tool / node for text transforms on source files.
6. **Force-pushing gh-pages deletes old hashed bundles** — stale cached pages point at
   404s; the SW cache-purge + navigate-only fallback is the antidote.
7. **RN-web wraps `<Image>`** — computed styles live on the *grandparent*; and
   `textTransform: uppercase` changes `innerText`, so DOM assertions must match case.
8. **Regex word boundaries vs plurals** — `\bfriend\b` never matches "friends";
   detector keyword lists need `s?` and collision ordering (game/dinner clashes).
9. **Expo static export**: `experiments.baseUrl` via app.config.js env for subpath
   hosting; `.nojekyll` required or Pages drops `_expo/` (underscore dirs).
10. **GitHub device-flow OAuth from a script**: POST login/device/code with the gh CLI
    client id, poll for the token — full deploy automation with one user code entry;
    `workflow` scope is required to push `.github/workflows/`.

## 6. Ops runbook

- **Dev**: `npx expo start` (Expo Go on phone) · web preview `npm run web`
- **Test**: `npm test` (62 tests, two suites) · `npm run typecheck`
- **Ship**: `npm run deploy:pages` → builds /surv, force-pushes gh-pages, restores local
- **Token**: device-flow OAuth token in `.git/gh_token.txt` (repo scope; never committed)
- **PWA**: `scripts/post-export.js` injects manifest/meta/SW after every export
- **Assets**: `node scripts/make-icons.js` regenerates all owls/icons/avatarMap.ts

## 7. Tuning constants (current)

Flights: ASAP 5m → 8h max; Forest default 1h, Tree default 3h. Advisor caps: Forest 40,
Tree 8 (nest/perched sages vote first). Arena: 1,002 new/hr, 0.5–4h lifetimes, top-10
board refreshes 60s. Population: 100,000 (`POPULATION_SIZE`). Evolution: 40/60/75/90.
Learning rates: see SAGE-ALGORITHM.md §2–3.

## 8. Replication recipe (new app, same bones)

1. `npx create-expo-app --template blank-typescript` → engine/store/screens split.
2. Build the pure engine first with a tsx test file; UI after.
3. PWA-ify: web-assets + post-export injection + navigate-only SW from day one.
4. Ship to Pages via the device-flow + gh-pages script; add `.nojekyll`.
5. Simulate the network deterministically before building the backend; define the
   realtime interface early so the swap is transport-only.
6. Add the stress/validation suite the same week as the features.

## 9. Unlock checklist (blocked only on accounts)

- [ ] **Supabase** (free): paste Project URL + anon key → run supabase/schema.sql →
      true multiplayer (plan in BACKEND.md, ~30 min)
- [ ] **CI auto-deploy**: re-run device flow with `repo workflow` scope → move
      scripts/ci/deploy.yml to .github/workflows/
- [ ] **TestFlight**: Apple Developer + `eas build -p ios` (bundle id ready)
- [ ] **Live AI**: Anthropic key in-app (BYOK) or EXPO_PUBLIC_ANTHROPIC_KEY
- [ ] **Real connectors**: Yelp Fusion / Google / Meta / Discord OAuth behind the
      existing SuggestContext + connections interfaces
