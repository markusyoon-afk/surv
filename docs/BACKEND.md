# SURV shared backend (Supabase) — ready to execute

Everything needed to go from on-device to **one shared live database** (votes appear
on everyone's phones in real time, no vote-back links) is prepared here. Total time
once Markus creates the free Supabase project: **~30 minutes of my work, zero of his**
beyond pasting two values.

## What Markus does (5 minutes, once)
1. supabase.com → sign in with GitHub → **New project** (name `surv`, region US central/east).
2. Settings → API → paste back the **Project URL** and **anon public** key
   (never the `service_role` key).

## What I do with those two values
1. Run [supabase/schema.sql](../supabase/schema.sql) via the SQL editor — full schema:
   profiles, category_sage, pair_trust, nests + members, survs + options + votes +
   comments, **row-level security** (nest-scoped visibility, vote-once, asker-only
   grading), and `grade_surv()` — the SAGE learning step running server-side with the
   exact constants from `src/engine/sage.ts`.
2. Enable realtime replication on `survs`, `votes`, `comments`.
3. `npx expo install @supabase/supabase-js`, add `src/lib/backend.ts` with the anon key
   (safe to embed — RLS is the security boundary), and swap `store.tsx` state
   transitions to Supabase calls behind the same interface (the store API was designed
   for this: castVote/createSurv/actOn/grade/addComment/createNest map 1:1).
4. Auth: magic-link email sign-in (Supabase Auth) replaces the local name prompt;
   existing on-device data migrates up on first login.
5. Subscribe to realtime channels → votes and Round Table messages stream in live;
   the 30s heartbeat stays for countdowns only.
6. Deploy; every installed home-screen app gets the multiplayer version instantly.

## Design decisions already made
- **Weights are computed at vote time** (as today) and stored on the vote row — the
  historical record stays honest even as SAGE scores evolve.
- **Grading is a Postgres function** (`security definer`) so the algorithm can't be
  gamed from the client and every device sees identical SAGE math.
- **Anonymous/guest voting stays** via the existing share links until a friend signs
  up, then their guest history can be claimed by handle.
- Calendar events, GPS places, and the Claude key remain **on-device** — personal
  signals feed suggestions locally; only decisions, votes, and reputations are shared.
