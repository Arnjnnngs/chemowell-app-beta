# APP_CLAUDE.md — chemowell-app-beta (APP-BETA)

Instructions for any AI agent working in this repo.

## What this repo is
The **native mobile app** codebase (APP-BETA). Seeded from `chemowell-beta` v71, with Firebase completely removed. Target: Capacitor-wrapped iOS/Android builds for the stores (APP-LIVE later).

## Hard rules
1. **No plaintext cloud storage. Ever — updated 2026-08-08, Aaron's explicit sign-off.** The original
   version of this rule ("no cloud storage, ever... user data never leaves the device") is now
   superseded for the specific case of the multi-device/multi-caregiver sync feature Aaron confirmed
   as top priority 2026-08-08 — everything else about this rule (no analytics, no remote logging, no
   casual network write of user data) is unchanged and still absolute.
   Context: sync requires data to leave the device for the first time in this project's history, which
   directly conflicted with this rule and with the app's own "no cloud, no accounts, no tracking"
   copy shown in Welcome/Settings/About. Raised to Aaron explicitly before any implementation began
   (not silently overridden). Aaron's own words on the tradeoff: "can something still live on their
   device but they just share stuff with people? will this change the whole HIPAA thing... I don't
   want anything with privacy breach." His decision: build it, but end-to-end encrypted, and get a
   real privacy lawyer's review before it goes live to real users (separate from starting the build).
   **What's authorized and what isn't:** a backend MAY now exist, but ONLY for the sync feature, and
   ONLY as a zero-knowledge relay — every write to it is derived/encrypted on-device first, using a
   key generated from the device-pairing exchange, never transmitted to or derivable by the server.
   The server may never hold, log, or be able to decrypt plaintext patient data at any point. This is
   not a general permission to add cloud services, analytics, or any other network data path — any
   future feature that would write user data off-device needs the same explicit sign-off process this
   one got, not an assumption that this rule change covers it. HIPAA itself almost certainly does not
   apply to ChemoWell (consumer-direct app, not used by providers — see the app's own "Intended use"
   positioning, app-v34) but state consumer-health-data laws (e.g. Washington's My Health My Data Act)
   may, regardless of encryption — the Formal Privacy Policy REQUESTS.md item now explicitly covers
   this too, and ships before the sync feature is offered to real (non-testing) users.
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
