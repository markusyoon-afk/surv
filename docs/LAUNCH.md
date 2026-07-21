# SURV Launch Runbook

Three stages. Stage 0 is DONE. Stages 1–2 each start with one account only
Markus can create; everything technical after that is pre-built or scripted.

## Stage 0 — Soft launch (LIVE now)

- https://markusyoon-afk.github.io/surv/ — installable PWA, new-user
  onboarding (own profile, owl pick, hatch at 30%), full decision loop,
  link-based sharing over iMessage (#s= share, #v= vote-back, #i= invite).
- Share freely. Each device is its own world; interactions travel by links.
- Build stamp at the bottom of the You tab answers "am I on the latest?"

## Stage 1 — Real shared network (Supabase, free, ~5 min of Markus's time)

Turns link-relay multiplayer into a live common feed: everyone sees
everyone's SURVs, votes land in real time, grading runs server-side so
scores can't be gamed.

Markus does:
1. supabase.com → Sign up (free tier, no card) → New project (any region).
2. Project Settings → API → copy the **Project URL** and **anon public key**.
3. Paste both into a Claude session and say "wire it."

Claude then does (same session, all pre-built):
1. Run `supabase/schema.sql` in the project's SQL editor (tables, RLS
   policies, `grade_surv()` server-side learning step).
2. Add `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the
   build, swap `src/lib/live.ts` from BroadcastChannel to Supabase Realtime
   (interface-first — the API is identical), point reads/writes at the DB
   with AsyncStorage as the offline cache.
3. Migrate: first launch after upgrade pushes local state up, then syncs.
4. Full battery + browser pressure loop + two-device E2E, deploy.

## Stage 2 — App Store (Apple Developer, $99/yr)

TestFlight beta (up to 10,000 testers via a public link) → App Store review.

Markus does:
1. developer.apple.com → enroll (personal or SURV LLC; LLC needs a D-U-N-S).
2. Share the team credentials flow with Claude when prompted by EAS.

Claude then does:
1. `npx eas init` + `eas.json` profiles (already-planned config), set the
   bundle id (suggest `com.survapp.surv`), icons/splash already exist.
2. `eas build --platform ios` → cloud build, no local Xcode needed.
3. `eas submit` → TestFlight; write the review notes (demo account not
   needed — no login; reviewers onboard like any user).
4. App Store listing copy + screenshots (owl brand, "a survey that serves").

Review realities: Apple wants a privacy policy URL (see privacy.html —
deployed), working support contact, and no obviously-broken flows. The
8-hour flights, named AI advisors, and real onboarding all help here.
Google Play later if wanted: $25 one-time, same EAS pipeline.

## Stage 3 — Growth (no accounts needed)

- Brand-question SURV blast (playful-vs-minimal) to early users.
- The invite loop is built: every share/vote-back link onboards its opener.
- Optional: custom domain (surv.app etc.) — buy it, I point Pages at it.

## Order of operations recommendation

Supabase FIRST (free, transforms the product), TestFlight second (paid,
transforms distribution). Both can land in the same week.
