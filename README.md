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

- The Nest feed with the original filters (All/Public/Private · Responded/Not) and live countdowns
- +SURV: question → **✨ Suggest options** (heuristic + mocked Yelp/Google/Nest signals;
  set `EXPO_PUBLIC_ANTHROPIC_KEY` for live Claude generation) → duration presets → audience → SURVit!
- Weighted voting: every vote carries a SAGE weight (Clout + category expertise + Nest
  closeness + pair trust); results show as weighted SAGEmeter bars
- The decision loop: expired SURV → "I went with…" → Verdict deck (swipe 👍/👎) →
  voter SAGE scores and pair trust actually update
- Nests and Profile with SAGEmeter, category SAGE, decision history, connector toggles

## Repo map

- `src/engine/` — pure TypeScript decision engine (types, SAGE weighting + learning,
  option suggestion, seed data from the 2011 alpha DB). Portable to a backend as-is.
- `src/screens/`, `src/components/` — the app UI (night-sky theme from the 2011 beta).
- `docs/PRODUCT_SPEC.md` — product spec + roadmap (backend, real connectors, TestFlight).
