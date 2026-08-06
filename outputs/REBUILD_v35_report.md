# v35 rebuild report — pre-scheduled native notifications

**Context.** This is the third time this feature was lost to a workspace reset (the cloud session's
disk was rolled back to an old snapshot before the work reached GitHub). Archaeology on the saved
conversation transcript found that the exact byte-for-byte prior implementation is not recoverable —
the file is too large for full copies to survive in the compacted transcript, and only fragments of
edits from the final restart pass exist. Rather than assemble a fragile, partially-reconstructed file
from those fragments, this is a clean reimplementation of the same feature contract, built fresh
against the last verified-good base on GitHub (`app-v34`, commit `a073e70`) and re-verified from
scratch. It is not a claim of byte-identical reproduction of the lost code.

**What this delivers.** Dose and appointment reminders are now pre-scheduled directly with Android's
AlarmManager (via `@capacitor/local-notifications`) up to 72 hours ahead, so they arrive even while
the app is closed or the phone is locked — the reactive (foreground-only) path stays fully intact
and unchanged for the web/PWA build. Settings shows a live status card with distinct, mutually
exclusive states: checking, blocked, not-yet-asked, on, on-but-exact-alarms-denied, sync-failed,
paused-while-simulating-a-date, and nothing-currently-due.

**Where the code lives.** `index.html`: `addEntryDB` hook (~line 191), appointment CRUD hooks
(~line 223), sim-date hooks (~line 559), the full notification engine block (~line 5741, right
before `subscribePush()`), the boot-time arm + 1-second backstop (~line 6118), and the Settings card
(`renderNativeNotifStatusCard`, ~line 4663, wired into the existing Notifications section).
`APP_VERSION` is bumped to `app-v35`. `package.json`/`package-lock.json` untouched, no new
dependency added, `TEST_MODE` left `true`, `console.error` not used anywhere in the new code
(`console.warn` only, since the release harnesses fail a run on any console error).

**A real bug this pass caught before it shipped.** The "Allow exact reminders" button used
`disabled: notifActionBusy` directly in the button's props. This app's `h()` helper sets unknown
props via `element.setAttribute()`, and `setAttribute('disabled', false)` still renders a disabled
(and therefore unclickable) button — HTML boolean attributes are presence-based, not value-based.
The file already had a comment elsewhere warning about exactly this trap; the new code violated it
on the first pass anyway. Caught by the verification harness (R5 below), not by inspection — the
button visibly rendered and looked clickable, but silently did nothing.

**Verification run.** `verify_v35_rebuild.mjs` (committed alongside this report) — a lean, from-
scratch harness, not a recreation of the lost 14-check harness. Six checks, chosen to cover the
contract that actually matters: boot arms a valid plan (unique positive 31-bit ids, two channels);
quiet-hours and beyond-horizon items are correctly excluded; a failed sync still lets the surgical
per-dose cancel find the right id (using the last known-good plan, not a cleared one); the Settings
card never shows two contradictory things at once across four permission/exact-alarm states; the
exact-alarm button gives feedback with and without the plugin method present (this is what caught
the disabled-button bug); and reminders correctly stay unarmed while the Beta Date Controls are
simulating a date. All six pass. Regression pass: `verify_smoke_v24.mjs` and `verify_notif_fix_v24.mjs`
(pre-existing, unrelated to this feature) both still pass in full — no console errors, no layout
overflow at mobile/small-mobile/desktop widths, existing appointment-reminder behavior unchanged.

**What this pass did NOT do.** This was done by the Lead Developer alone (self-verified), as a
recovery action, not a full run through Aaron's mandatory Quality Chain (Designer, Auditor, PM
stages). Those still need to happen before this is release-ready — this report documents the
Developer + Lead Developer stages only. The process change going forward: every meaningful chunk of
this work is being committed and pushed to GitHub immediately (via browser upload, since direct
`git push` from this session is blocked by a platform-side issue — see below), rather than
accumulated and pushed at the end, so a future reset costs minutes of work, not the whole feature.

**Standing blocker, unrelated to this feature.** `git push` from this cloud session to GitHub
returns a 403 ("not in this session's authorized repository set"). Checked again this session —
still blocked. This appears to be a known, currently-open issue on Anthropic's platform side with no
self-service fix; the browser-upload workflow is the workaround until that's resolved upstream.
