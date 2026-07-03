# SURV 🦉

**Live it! SURV it!** — the social decision engine, reborn.

Started in 2010–2011 (SURV LLC), rebuilt in 2026 as an iOS-first Expo app. Post a
decision, let your **Nests** (spheres of influence) vote during a countdown, **act**
on the result, then **swipe the verdict** — good call or bad. Every verdict retrains
how much each voter's opinion counts for you, per category. See
[docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) for the full spec and lineage.

## Run it on your iPhone (from Windows)

```sh
npm install
npx expo start
```

Install **Expo Go** from the App Store, scan the QR code in the terminal with your
iPhone camera, and SURV opens on your phone. Hot-reloads as you edit.

Web preview: `npm run web` · Engine tests: `npm test` · Types: `npm run typecheck`

## What works today (v1, on-device)

- **Quick SURV drafts** — schedule- and habit-aware one-tap drafts ("Lunch hour →
  What should I grab for lunch?"); your recurring SURVs resurface as "your usual",
  already-asked questions are suppressed, and your posting habits boost matching drafts
- **Ranked top-3 options** — suggestions scored by ratings (Yelp/Google), Nest trends,
  and your influencers: the highest category-SAGE person in your Nests gets named
  attribution on the top pick
- The Nest feed with the original filters (All/Public/Private · Responded/Not) and live
  countdowns (30s heartbeat; expired SURVs auto-flip to "deciding")
- +SURV: question → **✨ Suggest options** (heuristic + mocked Yelp/Google/Nest signals;
  set `EXPO_PUBLIC_ANTHROPIC_KEY` for live Claude generation) → duration presets → audience
  → SURVit!, plus **Extend countdown +24 hrs** on your live SURVs
- Weighted voting: every vote carries a SAGE weight (Clout + category expertise + Nest
  closeness + pair trust); results show as weighted SAGEmeter bars
- The decision loop: expired SURV → "I went with…" → Verdict deck (swipe 👍/👎) →
  voter SAGE scores and pair trust actually update
- **Round Table** — per-SURV discussion thread (straight off the 2011 beta wishlist)
- Nests: create your own (name, emoji, members) and tap a member's tier to adjust
  closeness; Profile with SAGEmeter, category SAGE, decision history, connector toggles
- **Persistence** — full state survives app restarts (AsyncStorage); "Reset demo data"
  in Profile starts fresh; first-run onboarding explains the loop

## Repo map

- `src/engine/` — pure TypeScript decision engine (types, SAGE weighting + learning,
  option suggestion, seed data from the 2011 alpha DB). Portable to a backend as-is.
- `src/screens/`, `src/components/` — the app UI (night-sky theme from the 2011 beta).
- `docs/PRODUCT_SPEC.md` — product spec + roadmap (backend, real connectors, TestFlight).
