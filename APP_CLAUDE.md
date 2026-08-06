# APP_CLAUDE.md — chemowell-app-beta (APP-BETA)

Instructions for any AI agent working in this repo.

## What this repo is
The **native mobile app** codebase (APP-BETA). Seeded from `chemowell-beta` v71, with Firebase completely removed. Target: Capacitor-wrapped iOS/Android builds for the stores (APP-LIVE later).

## Hard rules
1. **No cloud storage. Ever.** The entire product promise is that user data never leaves the device. Do not add Firebase, analytics, remote logging, or any network write of user data.
2. This repo must never reference or write to the `caretracker_*` Firestore collections — those belong to WEB-MAIN/WEB-BETA (Brandi's data).
3. Aaron's 4-target routing: only work here when the task targets **APP-BETA** (or APP-LIVE when it exists). WEB work goes to `care-tracker` / `chemowell-beta`.
4. Keep `TEST_MODE = true` (date-override controls) until store submission prep.
5. **The Quality Chain (per Aaron, 2026-07-24): see `TEAM.md`.** Every piece of work runs the full role chain — Developer → Lead Developer → Designer → Lead Designer → Auditor → Lead Auditor → Project Manager → Owner. No stage skipped, no self-certification; any defect found anywhere sends the work back to the Developer and the whole chain reruns. Role reports are committed to `outputs/`.
6. **Commit/push process (per Aaron, 2026-07-24):** Claude is authorized to commit and push to the BETA repos (`chemowell-app-beta`, `chemowell-beta`) directly, using Claude-in-Chrome to drive the GitHub web UI (upload files / create file) — no need to hand files to Aaron for manual upload. This authorization does NOT extend to WEB-MAIN (`care-tracker`): that repo still requires Aaron's explicit, in-the-moment go-ahead before any change. Commit work locally in the sandbox first (clean record + diffable), then push the same files via the web UI.
7. **Find solutions, don't surface problems and wait (per Aaron, 2026-08-06):** if you notice a bug, an easy fix, or something worth flagging for later while working on something else, you do not stop and ask Aaron what to do about it — you fix it if it's safe and small (same bar as the existing "quick 1-2 line change" exception to the full chain), or you log it in `BACKLOG.md` (this directory) plus the task list if it's bigger than a quick fix. Aaron should never have to tell Claude the same category of fix twice. This does NOT override the chain itself (rule 5) or the explicit "ask before a genuine fork in scope/cost" exception — it means small, self-contained findings get resolved or recorded, never silently dropped and never left as an open question with no action taken.
8. **Commit locally often, don't sit on uncommitted work (per Aaron, 2026-08-06, after a real incident):** a local working-tree revert on 2026-08-06 wiped an in-progress feature build before it was committed. Uncommitted `Edit`-tool changes have zero recovery path if that happens again; a local `git commit` does. Commit as soon as a meaningful, self-verified chunk of work exists — don't wait for the full chain to finish before creating a recovery point. This is separate from pushing to GitHub (rule 6), which still waits for chain sign-off.

## Architecture notes
- Single-file app: `index.html` (h()-based vanilla renderer, no build step).
- Storage: `localStorage` keys `chemowell-app-entries-v1` (entry array, generated ids) and `chemowell-app-prefs-v1` (prefs object incl. `patientName`, `missedClearedAt`, `dismissedMisses`). Med config: `chemowell-app-medication-config-v1`.
- Same data-layer function names as the web apps (`subscribeEntries`, `addEntryDB`, `removeEntryDB`, `subscribePrefs`, `setPrefsDB`) so features port cleanly between targets.
- First-run: if prefs has no `patientName`, `renderSetup()` shows the welcome screen.
- Notifications: browser `Notification` only for now; native local notifications come with the Capacitor wrap (no server, no FCM).
