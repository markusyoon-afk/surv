# 🦉 Launching SURV on your iPhone

## The permanent URL (live now, PC on or off)

**https://markusyoon-afk.github.io/surv/**

1. Open it in **Safari on your iPhone** → tap **Share** → **Add to Home Screen**.
   SURV installs with the owl icon and launches full-screen like a native app.
2. **Send the same URL to friends** — they install it the same way. Everyone gets
   the full app: their own Nests, SURVs, and SAGE algorithm on their device.

To ship an update to the live app: `npm run deploy:pages` (rebuilds and pushes).

**Offline/local alternatives:** **START-SURV.bat** (localhost + same-Wi-Fi LAN URL)
or **SHARE-SURV-ONLINE.bat** (temporary Cloudflare tunnel URL).

## How sharing works (no accounts, no server — links are the network)

- **Share a SURV:** open your SURV → **📤 Share with your Nest** → sends a link via
  iMessage/WhatsApp. A friend taps it and your SURV appears in their app, ready to vote.
- **Votes come back:** after voting, they tap **📨 Send my vote to you** — you tap that
  link and their vote lands in your tally, weighted by their SAGE standing with you.
- **The algorithm learns:** when you act and swipe the verdict 👍/👎, every voter —
  friends included — gains or loses SAGE and pair-trust with you. Repeat interactions
  make SURV steadily smarter about whose advice you should trust, per category.

## Turn on Claude AI (continuous learning support)

In the app: **You → Claude AI → paste an Anthropic API key** (get one at
console.anthropic.com). ✨ Suggest options becomes live Claude generation, tailored to
each question. The key never leaves the device it's entered on — each person can
connect their own.

## Permanent URL + true shared database (next step, needs 5 min from you)

The link-based sharing above needs no accounts. For an always-on URL and one shared
live database (everyone sees votes in real time without vote-back links):
1. Create a free GitHub account (or tell me your login) → I deploy the app permanently to GitHub Pages.
2. Create a free Supabase project → I build the shared backend (schema is ready in `src/engine/types.ts`).

## TestFlight (the full native App Store path)

Needs an Apple Developer account ($99/yr) + free Expo account:
```
npm install -g eas-cli && eas login
eas build --platform ios --profile preview
```
Bundle id `com.survllc.surv` is already configured in app.json.
