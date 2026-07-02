# 🦉 Launching SURV

Three ways to run the app, easiest first.

## 1. Instant — double-click (Windows, full app in your browser)

Double-click **START-SURV.bat**. It opens SURV at http://localhost:8090 using the
prebuilt bundle in `dist/`. No install step — only Node.js is needed (you have it).
Your data persists between launches. Close the black window to quit.

## 2. On your iPhone (the real product experience)

```
npm install
npx expo start
```

Install **Expo Go** free from the App Store, then scan the QR code in the terminal
with your iPhone camera. SURV opens on your phone; shake the phone for the reload menu.
Both devices must be on the same Wi-Fi.

## 3. Ship to TestFlight (when you're ready for real beta testers)

Needs an Apple Developer account ($99/yr) and a free Expo account:

```
npm install -g eas-cli
eas login
eas build --platform ios --profile preview
eas submit --platform ios
```

The bundle identifier is already configured (`com.survllc.surv` in app.json).

---

**First run tips:** the app seeds demo data — the original 2011 SATT crew and real
questions from the alpha database. Vote on a SURV to see the weighted SAGEmeter, check
the **You** tab to swipe a verdict on the bike decision, and post your own SURV with
✨ Suggest options. *Reset demo data* at the bottom of Profile starts everything fresh.
