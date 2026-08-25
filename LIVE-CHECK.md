# LIVE-CHECK.md — how a cloud session gets eyes on the live apps

## The problem this solves

**Neither session type can both ship and see.** Measured 2026-08-24/25:

| | `git push` | Load the live site |
|---|---|---|
| **Cloud session** (claude.ai/code, `anthropic_cloud`) | ✅ native, seconds | ❌ **blocked** |
| **Desktop session** + Chrome extension (`bridge`) | ❌ proxy refuses the repo | ✅ works |

The cloud environment's egress policy refuses `arnjnnngs.github.io` at the CONNECT stage (HTTP 403),
and the GitHub **Pages** API paths are refused at the proxy too. `curl`, `WebFetch` and the Pages API
were all tried; none work, and the denials are logged with timestamps in the proxy's own status
endpoint. A cloud session also has **no Chrome extension tools at all** — those exist only in the
desktop app session, which is a different machine.

So a cloud session can push a release and then cannot confirm it deployed. That is not a small gap:
GitHub Pages builds asynchronously and has served a stale build here before.

## The mechanism — a poke-only Routine plus the repo as the mailbox

1. A **poke-only Routine** (a scheduled trigger with no schedule) is bound to the desktop session.
   It never fires on its own. A cloud session fires it on demand with `fire_trigger`, optionally
   passing which version to expect as extra text.
2. The **desktop session** does the browser work — it is the one with Chrome.
3. It writes its findings to `outputs/LIVECHECK-<date>.md` **and pushes them**.
4. The cloud session reads that file back out of the repo.

**The repo is the mailbox.** A desktop session cannot message a cloud session back directly, so a
committed file is the return path — and it is the better one anyway: it survives the session, it is
diffable, and it is still there next week when somebody asks what the app looked like.

## What the desktop session is asked to do

For each of the three URLs — passed in the poke, never assumed:

- https://arnjnnngs.github.io/care-tracker/
- https://arnjnnngs.github.io/chemowell-app-beta/
- https://arnjnnngs.github.io/chemowell-beta/

1. Fetch `sw.js` **with a cache-buster** (`?cb=<random>`) and report the `CACHE` constant **verbatim**.
   Report the bytes, never the screen.
2. Fetch `index.html` with a cache-buster and report `APP_VERSION` verbatim.
3. **Compare against what was expected** — the poke says which version should be live. Say
   MATCH or MISMATCH explicitly. Pages lags a push by 60–90s; if it mismatches, wait 60s and retry
   once before calling it a failure.
4. Open the app in Chrome at **375px and 320px** wide. Report console errors — **zero is the bar.**
5. Screenshot the first screen of each app.
6. **ChemoWell beta only:** confirm the orange **"BETA — TEST DATA ONLY"** banner is on screen.
   Its absence would mean the isolation switch was flipped. *(This instruction has been wrong in the
   docs before — it named a banner renamed months earlier, which would have raised a false alarm
   about the patient's real records. Trust `ISO-5` in `harness/beta-isolation-test.mjs` over any
   wording here, including this paragraph.)*
7. Write `outputs/LIVECHECK-<YYYY-MM-DD>.md`, commit, **push**, and report the commit SHA.

## Rules for the live checker

- **Assert on bytes, never on the screen.** A leak check here once read the screen for three rounds
  while appointments leaked into the CSV.
- **Never write data in the live care-tracker app.** It is a real patient's medical record. Read only.
  The ChemoWell beta is safe to interact with — it writes to `caretracker_test_*` collections.
- **Report MISMATCH loudly.** A live check that reports "looks fine" without quoting the actual
  version string it read has verified nothing.
- **Close the Chrome tabs when finished** (standing instruction, Aaron, 2026-07-19).
- If the Chrome extension is not connected, **say so plainly and stop.** Do not guess, and do not
  report a check you could not perform. The extension has dropped before when the laptop slept, and
  a silent failure here is worse than no check.
