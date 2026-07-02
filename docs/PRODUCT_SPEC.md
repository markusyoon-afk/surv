# SURV 2.0 — Product Specification

> **"Live it! SURV it!"** — The social decision engine.
> Reconstructed from the 2010–2011 SURV LLC materials (functional specs, Lapiz wireframes,
> beta site SQL schema, SATT alpha/beta testing, presentations) and extended with the
> 2026 vision: Nests, AI-generated options, connector data, and outcome-trained weighting.

---

## 1. What SURV is

People make dozens of low-to-medium-stakes decisions daily — where to eat, what to buy,
how to handle an awkward situation. SURV lets a user post a **decision** (not just a poll),
get **options generated for them**, have their trusted circles (**Nests**) vote during a
**countdown**, **act** on the winning option, and then **grade the outcome with a swipe**.

That last step is what no poll app has: a **closed feedback loop**. Every graded outcome
retrains how much each voter's opinion counts for that person, in that category, forever.
SURV doesn't just collect opinions — it learns *whose* opinion is worth following.

### Lineage from the original product
| Original (2011)                          | SURV 2.0 (now)                                            |
|------------------------------------------|-----------------------------------------------------------|
| Question + 3 choices, 200 chars          | Decision + 2–4 options; options auto-suggested by AI       |
| `users.uweight` static voter weight      | Dynamic per-category SAGE score, trained by outcomes       |
| SAGEmeter / SURVmeter %                  | SAGEmeter: global Clout + per-category expertise           |
| Friends via invite table                 | **Nests** — named circles with closeness tiers             |
| Countdown 1 min–1 month                  | Presets 1h / 6h / 24h / 3d / 1w + extend (alpha SURV #108 asked for exactly this) |
| "Check" the choice you acted on          | Act on it → later **swipe right/left** (good/bad outcome)  |
| Public/Private, Responded filters        | Same filters, plus per-Nest audiences                      |
| Email notification when SURV ends        | Push notification (expo-notifications)                     |
| Beta wishlist: "SURV Mobile!"            | iOS-first app (this repo)                                  |
| Beta wishlist: expert option, category tracking, track SURVs you influenced | All part of the SAGE engine |

---

## 2. Core concepts

### Nests
A Nest is a named sphere of influence: *Family*, *Foodies*, *Hoops Crew*, *Work*.
- Each membership has a **closeness tier**: `inner` (1.0), `regular` (0.75), `outer` (0.5).
- A SURV is posted to one or more Nests, or Public.
- Nest members see each other's category SAGE — you learn who your food oracle is.

### The SAGE engine (weighting algorithm)
Every user has:
- **Clout** (global SAGEmeter %, starts at 30 — per the original beta meter): overall
  track record across all decisions they've influenced.
- **Category SAGE** (0–100 per category, starts at 30): expertise the system has
  *observed*, not claimed.
- **Pair trust** (per asker→voter): how often this voter has steered *this specific asker*
  right, historically.

A voter V's weight on asker A's SURV in category C:

```
weight(V, A, C) = 0.35 · clout(V)/100
               + 0.35 · categorySage(V, C)/100
               + 0.20 · closeness(A, V)        // shared-Nest tier, 0.3 if public-only
               + 0.10 · pairTrust(A, V)        // 0..1, starts 0.5
```

Displayed results are **weighted percentages** (the option's SAGEmeter), with raw counts
available on tap — transparency prevents "why did 3 votes beat 5?" confusion (a real SATT
alpha complaint about seeing answers clearly).

### The feedback loop (the learning step)
When the countdown ends, the asker **Acts** on an option (the original "Check" step),
then later grades it — **swipe right = good call, swipe left = bad call**:

- **Good outcome:** voters who backed the acted option gain category SAGE (+4 toward 100,
  diminishing as they climb), +1 Clout, pair trust up. Voters who opposed decay slightly (−1).
- **Bad outcome:** voters who backed it lose (−3 SAGE, −1 Clout, trust down). Voters who
  warned against it gain (+2 SAGE, trust up) — dissent that proves right is rewarded.
- The asker earns +1 Clout for closing the loop (grading), keeping the flywheel spinning.

This is an Elo-flavored reputation system: explainable, monotonic, and it converges on
"who should I listen to about X" per user. All constants live in `src/engine/sage.ts`
and are tuned via unit tests.

### AI option generation
When the asker types a question, SURV proposes options before they finish thinking:
1. **Category detection** from the question text.
2. **Connector enrichment** — pull candidates from connected sources:
   - Yelp / Google Reviews → restaurants, services near the user (mocked in v1)
   - Facebook / Instagram / Discord → what their Nests have been talking about (mocked)
   - The user's own SURV history → options they've acted on before
3. **LLM pass** (Claude API, `claude-sonnet-5`) — composes 3 tailored options with a
   one-line "why" each. v1 ships with the heuristic engine and a documented API hook
   (`src/engine/suggest.ts`); set `EXPO_PUBLIC_ANTHROPIC_KEY` to enable live generation.

### Categories
Merged set: original DB categories (YouTube-style) consolidated with the 2011
"Surv Categories" doc (Sports/Fantasy, Shopping, Food, Living, Entertainment):
**Food · Shopping · Living · Entertainment · Sports · Tech · Travel · Style · Work · Relationships**

---

## 3. v1 App (this repo)

**Stack:** Expo (React Native, TypeScript) — iOS-first via Expo Go, Android/web for free.
No backend yet: the full engine runs on-device against seed data (real questions from the
2011 alpha DB), so the product loop is testable end-to-end today.

**Screens**
1. **The Nest (feed)** — live SURVs from your Nests: countdown, weighted SAGEmeter bars,
   filters (All/Public/Private · Responded/Not), vote inline.
2. **+SURV** — question (140 chars), category chips, **Suggest options** button (AI/
   heuristic), duration presets, audience picker (Nests/Public), SURVit! button.
3. **SURV detail** — options, weighted vs raw results, voter list with weights, countdown;
   for your own expired SURVs: **Act on it** (pick what you did).
4. **Nests** — your circles, member Clout/SAGE, closeness tiers.
5. **Profile** — SAGEmeter (Clout %), category SAGE bars, **Verdict deck**: swipe
   right/left on decisions you acted on; connected sources (FB/IG/Discord/Yelp/Google —
   mock toggles in v1).

## 4. Roadmap after v1
1. **Backend:** Supabase or Firebase (auth, Postgres, realtime votes, push). Schema mirrors `src/engine/types.ts`.
2. **Real connectors:** OAuth to Google (Places/Reviews), Yelp Fusion, Discord bot, Meta
   Graph API (FB/IG) — read-only signals feeding option generation and Nest discovery.
3. **Claude-powered option generation + decision briefs** ("Your Foodies Nest is 82% Thai
   when you're tired on weeknights").
4. **TestFlight:** EAS Build → App Store Connect (`eas build -p ios`), invite the original
   SATT crew as beta testers.
5. **Round Table** (original beta wishlist): threaded discussion per SURV.
6. **Rewards for SAGEmeter growth** — your own alpha SURV #116 voted "YES!!! Make it fun
   and interactive!"
