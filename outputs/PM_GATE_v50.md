# Project Manager Gate — v50 (Reminder reliability: battery-optimization exemption + auto early-scheduling buffer)

**For: Aaron. Written in plain language — the technical detail is in the reports linked below if you ever want it.**

## Verdict: **GO — ready to consider closed, pending your own on-device confirmation** (native half genuinely can't be verified any other way; correctly still marked open, see below).

---

## Process note first, since it's part of what this gate exists to catch

This release shipped without the mandatory Zero Day Auditor pass — that's a real miss of the "every
release, no exceptions" rule in TEAM.md, not a technicality. The Auditor ran retroactively today
(`outputs/AUDIT_v50.md`) and I'm running this PM gate independently on top of that, same as normal, but
I want to be explicit that the process itself skipped a step here. Going forward this can't happen again
— the Auditor gate runs before ship, not after, full stop.

## Did this actually answer what Aaron asked for?

Aaron's request, verbatim, had three parts. Checked each one against the real shipped code, not the
summary of it:

1. **"build in the battery optimization"** — done. A new, independent "Allow background activity"
   control (`@capawesome-team/capacitor-android-battery-optimization`) only appears when there's an
   actual restriction to fix (`batteryOptBlock()`, index.html:5406, gated on `batteryOptState ===
   'enabled'`), and the state refreshes for real after the user acts instead of assuming success
   (`requestBatteryOptExemption()` awaits `refreshBatteryOptStatus()` before toasting). Confirmed by
   reading the code directly, not just the summary.
2. **"do research... if not [used by non-clock apps], remove it... throw in a '?'"** — the research was
   actually done, not asserted: `SCHEDULE_EXACT_ALARM` (what this app requests) is genuinely available
   to any app, not gated to clock/calendar apps the way the separate `USE_EXACT_ALARM` permission is.
   That's the right call under Aaron's own stated logic ("if not [restricted], remove it" — it's not
   restricted, so the control stays). What Aaron actually hit is a documented Samsung One UI quirk, not
   a real restriction. The "?" explainer was added regardless, as asked, covering both the "it may fire
   around that time frame" framing and the standard Samsung fix. Correct call, correctly reasoned.
3. **"build that in the code itself"** — done, and done the way Aaron asked (in code, not as a user
   suggestion): `applyExactAlarmLeadBuffer()` automatically arms reminders early whenever exact-alarm
   permission isn't confirmed granted, no user action needed, reverts the moment it is granted. One real
   gap from a literal reading: Aaron said "5 min," the code uses 4 minutes
   (`NOTIF_INEXACT_LEAD_MS = 4 * 60 * 1000`, index.html:6888) with no comment explaining why 4 over 5.
   Not a defect — the point (build it into the code, don't rely on the user) is fully met — but worth
   flagging to Aaron as a one-word "we used 4, want 5?" rather than silently deciding for him.

## My own independent verification (not just re-reading the Auditor's report)

I re-derived or re-ran a sample of the Auditor's specific claims myself, live, rather than taking the
report on trust:

- **Double-padding call site** — grepped `applyExactAlarmLeadBuffer` myself: exactly one call site,
  `syncNativeReminders()` (index.html:6963), always fed a freshly-built `buildReminderPlan(...)` output,
  never a previously-padded plan. Matches the Auditor's claim.
- **Padding/floor behavior, live** — connected to the real deployed site via browser automation and ran
  `window.__notifTest.applyExactAlarmLeadBuffer` myself: `denied` state pads by exactly 4 minutes
  (`-240000ms`); feeding its own output back in pads by another 4 minutes (`-240000ms` again — confirms
  no internal double-pad guard, exactly as reported); `granted` state applies zero padding; a reminder
  due in 1 minute clamps to exactly `now + 30000ms` (the `NOTIF_MIN_LEAD_MS` floor), never past `now`.
  All four numbers matched the Auditor's report exactly.
- **Version/cache consistency, live** — fetched the live `sw.js` directly (`cache:'reload'`) and confirmed
  it contains `chemowell-app-v50-1`, matching `APP_VERSION = 'app-v50'` in `index.html:5350`. Ran
  `release_check.sh` myself against the current working tree: exits 0, clean.
- **The `synapse` finding (F1)** — independently reproduced, not just re-read. Loaded the real live site
  in a real connected browser (not the sandbox's blocked network path) and pulled the actual console:
  `Uncaught ReferenceError: synapse is not defined` at `.../filesystem@8.1.2/dist/plugin.js:737:25`, and
  confirmed `window.Capacitor.Plugins` on the live site lists `WebView, CapacitorCookies, CapacitorHttp,
  SystemBars, LocalNotifications, Share` — no `Filesystem`. Exact match to the Auditor's report, from an
  independent fetch.
- **CI workflow diff** — read `.github/workflows/android-build.yml` and `package.json` directly: the
  manifest-permission injection step and the new `@capawesome-team/capacitor-android-battery-optimization`
  dependency are both present and match what the Auditor described.

No discrepancies found between what the Auditor reported and what the running code/live site actually do.

## One thing I found that the Auditor's report didn't mention: F1 isn't actually new

`BACKLOG.md` already has a detailed entry (predating app-v47) that identifies this exact bug — the
`@capacitor/filesystem` 8.x UMD bundle's `synapse` global, the exact `ReferenceError`, and the exact fix
(a one-line shim: `<script>window.synapse = { exposeSynapse: function(){} };</script>` before the
filesystem/share plugin tags) — logged as "not implemented now... do this alongside the actual native
build/test cycle, not blind." Confirmed `index.html` has no such shim (`grep` for `window.synapse` /
`exposeSynapse` returns nothing). So when app-v47 actually shipped the filesystem/share plugins, this
already-known landmine wasn't checked against BACKLOG.md first, and the predicted bug happened exactly
as predicted. This isn't a new investigation to open — it's a known fix that was never applied. Doesn't
change the F1 severity call below, but it does mean the follow-up should be fast (implement the
already-specified shim, then verify via the CI native build + emulator, then Aaron's device), not a fresh
investigation.

## Release mechanics

- `APP_VERSION` (`app-v50`) and `sw.js` `CACHE` (`chemowell-app-v50-1`) match, in the repo and live on the
  deployed site. `release_check.sh` passes clean.
- README.md's `app-v50` version-history entry is present and accurate against the actual commits
  (`12430b3`, `e41f27b`, `4e0564e` — verified via `git log`) and against the code itself; it correctly
  states the native half is unverified pending CI + Aaron's device, not claimed as done.
- REQUESTS.md's "Notification 'Allow exact reminders' button..." item is still correctly unchecked
  (`- [ ]`), with an accurate, non-overstated update describing exactly what shipped and what still needs
  Aaron's device to close — same pattern as the app-v47 export item right above it, also still correctly
  open. Nothing in REQUESTS.md overstates this as Completed.
- CI run #53 for `4e0564e` already confirmed green (build + emulator-smoke, 5m24s) — taken as given per
  the task brief, not re-checked here.

## Go/No-Go, and the F1 recommendation

**GO.** The three-part request is genuinely covered, the research-then-decide step was done for real (not
asserted), the early-buffer is truly built into the code rather than left as a user tip, the Auditor's
evidence checks out against my own independent re-verification (including one claim I reproduced fresh
through a different network path than the Auditor used), and release mechanics are clean and honestly
documented. The native half (real battery-optimization dialog, real exact-alarm OS behavior) is correctly
left open pending Aaron's own device test after the new APK installs — that's not a gap in this gate, it's
the one thing that has never been verifiable any other way on this project (see TEAM.md's on-device
verification section), and REQUESTS.md reflects that honestly rather than claiming it.

**On the `synapse`/Filesystem finding:** do not block anything on it. It fails closed (confirmed:
`nativeShareFile()` already checks for the plugin and falls back safely, no crash), it's not part of this
diff, and — now confirmed — the fix is already fully specified in `BACKLOG.md`, not an open question. My
recommendation: log it as its own explicit REQUESTS.md line (right now it's only in BACKLOG.md, which is
meant for small non-blocking items — a silent regression of a feature Aaron already asked for once,
app-v47, deserves a REQUESTS.md line so it surfaces every time REQUESTS.md gets shown to Aaron, not just
when someone happens to reread BACKLOG.md), and treat it as the next priority after this session: apply
the known one-line shim, then verify through the same CI native-build + emulator-smoke pipeline this
project already trusts, then get Aaron's device confirmation that CSV/PDF export's share sheet is actually
working again — since it's a plausible silent regression of something he already reported once before.
