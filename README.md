# ChemoWell (APP-BETA)

Private medication & symptom tracker for chemo patients and caregivers. **All data stays on the device — no cloud, no accounts, no tracking.**

This is the native-app codebase (APP-BETA in the 4-target system). It was seeded from `chemowell-beta` (WEB-BETA) at v71 and differs in one fundamental way: Firebase/Firestore is fully removed and replaced with an on-device storage layer (`localStorage`), plus a first-run setup flow. It will be wrapped with Capacitor for Play Store / App Store distribution.

- Live test build: https://arnjnnngs.github.io/chemowell-app-beta/
- Sibling repos: `care-tracker` (WEB-MAIN, Brandi's live app) · `chemowell-beta` (WEB-BETA, staging for WEB-MAIN)

## Version history

| Version | Date | Changes |
|---|---|---|
| app-v2 | 2026-07-23 | Fresh-install fix: missed-dose tracking now starts at `installedAt` (stamped into prefs on first run) instead of a hardcoded past date — a new install no longer shows dozens of phantom "missed doses from previous days". |
| app-v1 | 2026-07-23 | Seeded from chemowell-beta v71. Firebase/Firestore/FCM fully removed → on-device storage layer (entries + prefs in localStorage, same function names: subscribeEntries/addEntryDB/removeEntryDB/subscribePrefs/setPrefsDB). First-run welcome screen asks patient name (stored in prefs; no hardcoded Brandi). "Live sync" indicator → "On device". APP BETA badge/banner. SW cache chemowell-app-v1. Storage layer QA: 10/10 Node harness checks. |
