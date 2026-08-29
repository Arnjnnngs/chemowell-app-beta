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
2. This repo must never reference or write to the `caretracker_*` Firestore collections — those belong to WEB-MAIN/WEB-BETA (the owner's private data).
3. Aaron's 4-target routing: only work here when the task targets **APP-BETA** (or APP-LIVE when it exists). WEB work goes to `care-tracker` / `chemowell-beta`.
4. Keep `TEST_MODE = true` (date-override controls) until store submission prep.
5. **The Quality Chain (per Aaron, 2026-07-24; tightened 2026-08-08 — see `TEAM.md`'s
   "Process-gap incident" section for why): see `TEAM.md` for the current, authoritative
   process detail.** The core rule, with zero exceptions and zero Lead-Developer discretion to
   waive it: **every change to actual application code or config — `index.html`, `sw.js`, any
   file under `.github/workflows/`, `sync-backend/`, `package.json`/`package-lock.json`, or
   `capacitor.config.ts` — gets an independent Zero Day Auditor pass and an independent Project
   Manager sign-off, spawned as their own fresh agents via the Agent tool, before it is reported
   to Aaron as done.** Size, obviousness, or the Lead Developer's own confidence that a fix is
   "safe" are explicitly NOT a basis for skipping this — that exact judgment call is what let a
   real defect (a broken plugin bundle silently killing the native export feature) sit live and
   undetected from app-v47 through app-v49. Self-verification (the Lead Developer's own syntax
   checks, Playwright runs, live-site checks) is real, necessary work, but it is not a substitute
   for the independent gate and must never be reported to Aaron as if it were one. This is a
   medication-tracking app for cancer patients and their caregivers — the cost of a missed defect
   is not hypothetical, which is exactly why this rule has no size-based exception. Role reports
   are committed to `outputs/`.
6. **PUSH PERMISSION IS NOT THE QUALITY GATE — clarified by Aaron, 2026-08-29: "you CAN always
   push to chemowell, after audit pass and PM."** These are two different things and conflating
   them shipped app-v67 and chemowell-beta v60 straight to `main` with every suite green and no
   independent review at all. Standing permission to push says WHERE work may go; rule 5 says WHEN
   it is allowed to go there. The order is: build → self-verify → **independent Auditor** →
   **PM sign-off** → push. Never push first and audit after.
   **This is now mechanical, not a promise.** `release_check.sh` refuses to pass unless `outputs/`
   contains an `AUDIT*<version>*` report and a `PM*<version>*` sign-off naming the exact version
   being released. A rule enforced only by the person it constrains is the one that gets skipped at
   the end of a long day.
7. **Commit/push process (per Aaron, 2026-07-24):** Claude is authorized to commit and push to the BETA repos (`chemowell-app-beta`, `chemowell-beta`) directly, using Claude-in-Chrome to drive the GitHub web UI (upload files / create file) — no need to hand files to Aaron for manual upload. This authorization does NOT extend to WEB-MAIN (`care-tracker`): that repo still requires Aaron's explicit, in-the-moment go-ahead before any change. Commit work locally in the sandbox first (clean record + diffable), then push the same files via the web UI.
8. **Find solutions, don't surface problems and wait (per Aaron, 2026-08-06; scope clarified
   2026-08-08):** if you notice a bug, an easy fix, or something worth flagging for later while
   working on something else, you do not stop and ask Aaron what to do about it — you either fix
   it yourself or log it in `BACKLOG.md` (this directory) plus the task list. This rule is about
   *whether you act on a finding instead of silently dropping it or leaving it as an open
   question* — it is NOT a size-based exception to rule 5's mandatory Auditor + PM gates, nor to rule 6's ordering. Fixing
   something immediately, rather than deferring it to `BACKLOG.md`, is still subject to rule 5 in
   full: implement it, then it still goes through the independent gates before it's done, no
   matter how small the fix looks. Aaron should never have to tell Claude the same category of
   fix twice, and Claude should never have to tell Aaron "should work" instead of "verified."
9. **Commit locally often, don't sit on uncommitted work (per Aaron, 2026-08-06, after a real incident):** a local working-tree revert on 2026-08-06 wiped an in-progress feature build before it was committed. Uncommitted `Edit`-tool changes have zero recovery path if that happens again; a local `git commit` does. Commit as soon as a meaningful, self-verified chunk of work exists — don't wait for the full chain to finish before creating a recovery point. This is separate from pushing to GitHub (rule 6), which still waits for chain sign-off.

## Architecture notes
- Single-file app: `index.html` (h()-based vanilla renderer, no build step).
- Storage: `localStorage` keys `chemowell-app-entries-v1` (entry array, generated ids) and `chemowell-app-prefs-v1` (prefs object incl. `patientName`, `missedClearedAt`, `dismissedMisses`). Med config: `chemowell-app-medication-config-v1`.
- Same data-layer function names as the web apps (`subscribeEntries`, `addEntryDB`, `removeEntryDB`, `subscribePrefs`, `setPrefsDB`) so features port cleanly between targets.
- First-run: if prefs has no `patientName`, `renderSetup()` shows the welcome screen.
- Notifications: browser `Notification` only for now; native local notifications come with the Capacitor wrap (no server, no FCM).
