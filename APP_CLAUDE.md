# APP_CLAUDE.md — chemowell-app-beta (APP-BETA)

Instructions for any AI agent working in this repo.

## What this repo is
The **native mobile app** codebase (APP-BETA). Seeded from `chemowell-beta` v71, with Firebase completely removed. Target: Capacitor-wrapped iOS/Android builds for the stores (APP-LIVE later).

## Hard rules
1. **No cloud storage. Ever.** The entire product promise is that user data never leaves the device. Do not add Firebase, analytics, remote logging, or any network write of user data.
2. This repo must never reference or write to the `caretracker_*` Firestore collections — those belong to WEB-MAIN/WEB-BETA (Brandi's data).
3. Aaron's 4-target routing: only work here when the task targets **APP-BETA** (or APP-LIVE when it exists). WEB work goes to `care-tracker` / `chemowell-beta`.
4. Keep `TEST_MODE = true` (date-override controls) until store submission prep.
5. **Commit/push process (per Aaron, 2026-07-24):** Claude is authorized to commit and push to the BETA repos (`chemowell-app-beta`, `chemowell-beta`) directly, using Claude-in-Chrome to drive the GitHub web UI (upload files / create file) — no need to hand files to Aaron for manual upload. This authorization does NOT extend to WEB-MAIN (`care-tracker`): that repo still requires Aaron's explicit, in-the-moment go-ahead before any change. Commit work locally in the sandbox first (clean record + diffable), then push the same files via the web UI.

## Architecture notes
- Single-file app: `index.html` (h()-based vanilla renderer, no build step).
- Storage: `localStorage` keys `chemowell-app-entries-v1` (entry array, generated ids) and `chemowell-app-prefs-v1` (prefs object incl. `patientName`, `missedClearedAt`, `dismissedMisses`). Med config: `chemowell-app-medication-config-v1`.
- Same data-layer function names as the web apps (`subscribeEntries`, `addEntryDB`, `removeEntryDB`, `subscribePrefs`, `setPrefsDB`) so features port cleanly between targets.
- First-run: if prefs has no `patientName`, `renderSetup()` shows the welcome screen.
- Notifications: browser `Notification` only for now; native local notifications come with the Capacitor wrap (no server, no FCM).
