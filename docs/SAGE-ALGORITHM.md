# The SAGEmeter Algorithm (v2 — expert grade)

**Confidential — the secret sauce.** Never surfaced in the product UI (the in-app
card is gated to the developer). The complete math lives in
[src/engine/sage.ts](../src/engine/sage.ts), enforced by the engine test suite.

## v2 upgrades over the fixed-step v1

1. **Adaptive learning rate** (Elo-K / Kalman-gain style):
   `gain = clamp( (100−cur)/70 × 2/(1 + n/8), 0.15, 2.5 )`
   where `n` = graded observations in that category (`categoryN`). Newcomers
   converge ~2× faster; veterans are stable and can't be displaced by one lucky
   streak. Gain never reaches zero — everyone stays learnable.
2. **Surprise weighting** (proper-scoring intuition): positive updates scale by
   `surprise = clamp(1.5 − share, 0.75, 1.5)` where `share` is the weighted vote
   share of the option you backed. Being right *against* the crowd carries more
   information than agreeing with it — contrarian correctness pays up to 2× herd
   correctness, in SAGE and in pair-trust.
3. **Herding penalty**: backing a bad call *with* the crowd costs
   `−3 × (0.75 + 0.75·share)` — a lone miss is cheap, groupthink is not.
   This makes echo chambers mathematically unprofitable.

## State variables

| Variable | Range | Start | Meaning |
|---|---|---|---|
| `Clout(u)` | 1–100 | 30 | Global SAGEmeter — overall decision-influence track record |
| `CategorySAGE(u, c)` | 1–100 | 30 | Observed expertise per category (Food, Sports, …) |
| `PairTrust(a, v)` | 0–1 | 0.5 | How often voter *v* has steered asker *a* right, historically |
| `Closeness(a, v)` | 0.3–1.0 | — | Best shared-Nest tier: inner 1.0 · regular 0.75 · outer 0.5 · public-only 0.3 |

## 1. Vote weight (computed at vote time, frozen on the vote)

```
W(v → a, c) = 0.35·Clout(v)/100
            + 0.35·CategorySAGE(v, c)/100
            + 0.20·Closeness(a, v)
            + 0.10·PairTrust(a, v)
```

Coefficients sum to 1; W ranges ≈ 0.10–1.00 and is displayed ×10 (1–10).
An option's SAGEmeter share = Σ weights for it ÷ Σ all weights.

**Why these coefficients:** expertise (70% split evenly between global and
category-specific) dominates; relationship (20%) matters but can't override a
proven track record; personal history (10%) personalizes without echo-chambering.

## 2. The verdict update (asker swipes 👍/👎 after acting)

Let `cur = CategorySAGE(v, c)` and `g = (100 − cur)/70` (diminishing-returns factor).
For each voter v ≠ asker, `aligned` = voted for the acted-on option:

| Outcome | Aligned? | ΔCategorySAGE | ΔClout | ΔPairTrust |
|---|---|---|---|---|
| 👍 good | yes | **+4·g** | +1 | +0.08 |
| 👍 good | no  | −1 | 0 | −0.04 |
| 👎 bad  | yes | −3 | −1 | −0.08 |
| 👎 bad  | no (warned you) | **+2** | +1 | +0.08 |

The asker gets **+1 Clout** for grading at all — closing the loop is the flywheel.

**Properties:** right dissent is rewarded (prevents herding); losses are cheaper
than symmetric gains (safe to participate); `g` makes the climb logarithmic —
30→60 is fast, 90→100 takes a legendary run.

## 3. The arena update (you advised a stranger's public SURV)

| Outcome | Aligned? | ΔCategorySAGE | ΔClout |
|---|---|---|---|
| good | yes | +3·g | +1 |
| good | no | −0.5 | 0 |
| bad | yes | −2 | −1 |
| bad | no | +1.5 | +1 |

Slightly gentler than Nest verdicts (a stranger's grade carries less signal about
*you*), but at arena volume this is the fastest road from Hatchling to Super Sage.

## 4. Evolution thresholds (Clout)

| Stage | Threshold | Standing |
|---|---|---|
| 🐣 Hatchling | 0% | Learning whose advice to trust |
| 🦉 Owl | 40% | Trusted voice — votes carry real weight |
| 🎓 Sage | 60% | Category authority your Nest leans on |
| 🦝 Masked Sage | 75% | Guardian of good calls across circles |
| 🦸 Super Sage | 90% | Legendary — your word moves Nests |

## 5. What moves your meter, in plain terms

- **Post + grade your own SURVs** → +1 Clout each loop closed
- **Vote with the eventual good call** in Nests → biggest single gain (+4·g SAGE)
- **Warn people off bad calls** → rewarded even when you "lose" the vote
- **Advise well in the arena** → volume path; small consistent gains
- **Back bad calls** → small consistent losses; the meter is honest both ways

With the shared backend, the same math runs server-side (`grade_surv()` in
[supabase/schema.sql](../supabase/schema.sql)) so scores can't be gamed from a client.

## 6. Tuning roadmap

Once real usage flows: recency decay on stale SAGE (half-life ~90 days), per-Nest
weight normalization (so mega-Nests don't drown small ones), and confidence
intervals (few-vote SAGE shown as a range) — coefficients re-fit from observed
decision-outcome data rather than hand-set.
