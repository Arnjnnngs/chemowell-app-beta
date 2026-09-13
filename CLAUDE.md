# CLAUDE.md — chemowell-app-beta (APP-BETA)

Instructions for any AI agent working in this repo.

## RULE 0 — WHO THIS APP IS FOR. Read this before anything else.

**ChemoWell is a product. Every user is a different patient. None of them is the owner's wife.**

This repo shares ancestry with `care-tracker`, which is ONE named person's app — her medications,
her care team, her diagnosis, her phone. That is correct there and wrong here, and the ancestry
keeps leaking across. On 2026-09-13 Aaron found the medication disclaimer — the only place in the
app that gives safety guidance about medication, directly above the list of them — reading
**"Follow her care team."** It had passed every gate, including a test that checks her NAME is not
in the file.

He had already given this directive once, on 2026-08-19: *"at no point in time should Brandi's meds
ever show in code for chemowell. scrub that entirely."* `HARDCODED_MEDS_PLAN.md` is the plan from
that directive. It was not carried out. That is why he had to say it again.

**WHY IT KEEPS HAPPENING, and the reason this file is now named `CLAUDE.md`:** it used to be called
`APP_CLAUDE.md`, which Claude Code does not auto-load. So the ONLY instruction file that loaded in a
session touching this repo was `care-tracker/CLAUDE.md` — 719 lines that name the other patient nine
times and list four of her medications. Every session was briefed on her and never briefed on this
product. The rename is the fix; do not rename it back, and do not create a `CLAUDE.md` above this
directory that would apply to all three repos at once.

### The four shapes the leak takes. Check all four, every release.

1. **Her name.** Covered by an old test, and it is the shape that never actually occurs.
2. **A pronoun.** "Follow her care team", "if she comes home part-way through a day". Most users are
   not women. Write **they/them**, always — the patient is whoever the user set up, and this app has
   never asked anyone's gender for this purpose.
3. **A dose, ceiling or schedule from one care plan.** `CONFIG.ceilingMg = 2500` sat here for months.
   Nothing read it, which is the only reason it was harmless.
4. **Behaviour keyed to a medication id.** The big one. Branches on `med.id === 'zofran'` and the
   like drive a post-chemo block, dexamethasone windows, an Iron+Protonix warning and a Tylenol
   ceiling. `RESERVED_LEGACY_MED_IDS` FORBIDS users from creating medications with those thirteen
   names, so a stranger's "Zofran" becomes `zofran-2` and inherits nothing. **The app knows its own
   logic is unsafe for strangers and fences users out of it rather than fixing it.**

   **app-v76 phase 1 (`HARDCODED_MEDS_PLAN.md`) is the start of the real fix.** Five medication
   properties — `chemoRelativeWindows`, `chemoBlock`, `linkedTo`, `interactions`, `homeCard` — now
   express those behaviours as data, and every call site goes through a resolver that reads the
   property and falls back to the legacy branch. **It changes no behaviour**: on today's data every
   property is absent, and `test/v76-properties-equivalence.mjs` simulates a full treatment cycle
   hour by hour, old path against new, and requires zero differences. Phase 2 migrates the thirteen
   ids onto properties and deletes the fallbacks; phase 3 deletes the fence.

**`test/v75-no-other-patient.mjs` checks all four**, and `release_check.sh` runs it so a release
cannot skip it. It pins #4 as a ratchet on **three** numbers: places in the app that know one
patient's medication (13), fallbacks inside the migration resolvers (8), and legacy helpers (6).
The split exists because the single count went UP when phase 1 landed and the ratchet was right to
refuse it — the ids are still in the file, but they are no longer scattered, which is the thing that
matters. A new one fails immediately; removing one requires lowering the number, which is also
checked, so the debt cannot drift quietly downward either. It is not a substitute for `HARDCODED_MEDS_PLAN.md` phases
1-3, which are the actual fix.

### Medical content

Anything this app says about a medication is read by a stranger. It must not assert a diagnosis
("cancer of the ovaries" under a drug used for six cancers), a stage, a surgery, or a stigmatised
condition. The generator in `tools/build-med-table.mjs` carries nine guards for this; read the
comments there before loosening one. A sentence can be true, federal, correctly cited, and still
the wrong thing to print under someone's name.

---

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


## DO NOT REPORT UNTIL IT IS DONE (2026-09-08, Aaron, EXPLICIT, effective immediately)

> *"I'm so tired of you stopping when you should be working. You WILL NOT give me a recap of what's
> going on UNLESS I need to approve something OR until you are COMPLETE."*

**Two reasons to send Aaron a message, and no others:** he has to approve or decide something, named
in plain words; or the work is COMPLETE — built, verified, pushed, live, gates green, with the done /
outstanding list included.

Not "a background job is running" — start it and keep working. Not "the audit came back and I am
fixing it" — fix it. Not "here is what I found" — fix it and say so at the end. If a check comes back
red, the next thing that happens is the fix, not a paragraph about the fix. If a message ends with
*"running in the background"*, *"now starting X"* or *"next I will"*, it should not have been sent.

A turn that runs for an hour, launches four agents and ships two releases is correct. A short turn
ending in a status paragraph is the failure. Delivering a finished file is not a recap; pairing it
with a progress note is.

**This supersedes any checkpoint guidance in this repo's process docs wherever the two disagree.**
care-tracker carries the same rule as `CLAUDE.md` Rule 0.6.

**WORK END TO END.** Aaron, same instruction: a task is not a series of steps to be reported between
— it is one piece of work that starts when he asks and finishes when it is live. Build it, check it,
fix what the checks find, audit it, ship it, update the docs and the lists, and port it to the
sibling app if it belongs there. The two exceptions above are the only places that may be
interrupted.

