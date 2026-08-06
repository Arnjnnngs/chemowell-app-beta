# Lead Auditor sign-off — v35 pre-scheduled native notifications

**Scope:** independently re-verify the Auditor's `outputs/AUDIT_v35_rebuild.md` (F1–F5) against the
Lead Developer's fix commit `29995ee` ("app-v35 fix: Auditor F1/F2/F3 ..."), applied on top of the
Designer-blocker fix `171e702`, on the current `index.html` running at both
`http://127.0.0.1:8917/index.html` and `http://127.0.0.1:8910/index.html`.

**Method:** did not trust the Developer's or Auditor's claims at face value.
1. Read `git show 29995ee -- index.html` in full and read the actual current function bodies
   (`deleteMedicationConfig`, `setMedicationPaused`, `saveMedicationEditor`, `checkNotifications`,
   `checkAppointmentReminders`, the 6h backstop line, `syncNativeReminders`, `markNotifDirty`,
   `buildReminderPlan`, `notifPlanSignature`) directly in `index.html`, not just the diff.
2. Re-ran the Auditor's own live-testing harness (`outputs/audit_v35_live_tests.mjs`, T1–T10) fresh,
   on both ports.
3. Re-ran the three regression harnesses fresh myself: `verify_v35_rebuild.mjs`,
   `verify_smoke_v24.mjs`, `verify_notif_fix_v24.mjs`.
4. Grepped the whole file for every `persistMedicationConfig(` call site (not just the 3 the Auditor
   named) and for every `markNotifDirty()` call site, to check completeness of the wiring.
5. Wrote a fresh, independent probe script,
   `/home/claude/chemowell-app-beta/outputs/lead_auditor_v35_probes.mjs` (LA1–LA4), targeting exactly
   the gaps this stage is supposed to hunt for beyond the Auditor's own coverage: the 4th
   `persistMedicationConfig()` call site (`moveReorderableMed`), `deleteProfile()`'s missing hook,
   the 400ms debounce's loss window, and the Auditor's own documented-but-unfixed `removeEntryDB()`
   gap.

---

## 1. F1 (blocker) — CONFIRMED FIXED for the 3 sites claimed, live-tested myself

`git show 29995ee` confirms exactly one line was added at the end of each of the three functions, each
correctly placed after the mutating logic and each carrying an "Auditor F1" comment:

- `saveMedicationEditor()` — `markNotifDirty();` at line 4001.
- `setMedicationPaused()` — `markNotifDirty();` at line 4031.
- `deleteMedicationConfig()` — `markNotifDirty();` at line 4072.

**My own live evidence** (re-running the Auditor's T4/T9 fresh, both ports, plus my own regression
run of the whole 10-check suite):

- T4 (delete Zofran via real UI clicks "Remove Zofran" → "Confirm removal of Zofran"): `zofranStillPending=false`, `afterPendingTitles=["Dexamethasone Due","Dexamethasone Due","Dexamethasone Due"]` — the 6 Zofran alarms are gone, only the untouched Dexamethasone alarms remain.
- T9 (pause Zofran via the real editor's "Pause" button): `zofranPendingBeforePause=6` → `zofranPendingAfterPause=0`.
- Both PASS on `127.0.0.1:8917` and `127.0.0.1:8910`.

**Grep audit of ALL `persistMedicationConfig(` call sites — found a 4th the Auditor's report never
named:** `moveReorderableMed()` (index.html line 4049) also calls `persistMedicationConfig()` (to
persist a reordered meds array) and does **not** call `markNotifDirty()`. I live-tested this
(`LA1` in my probe script): reordering two meds via the real "Move down" button does not change the
armed alarm id set at all (`beforeIds === afterIds`, byte-identical). This is correct, not a bug —
`notifDoseTag()`/tag hashing depend on `profileId + medId + window.start/end + dayTs`, not array
position, so reordering can never change what the ideal plan contains. **No action needed here; not a
gap.**

**Verdict: F1 genuinely fixed for the 3 claimed sites, confirmed via real Playwright UI interaction,
not code-reading alone.**

---

## 2. F2 (should-fix) — CONFIRMED FIXED, live-tested myself, and the guard doesn't orphan anything

`checkNotifications()` and `checkAppointmentReminders()` both now start with `if (isNativeApp())
return;` (lines 5741 and 5806).

I read both full function bodies below the new guard line by line to check for the same class of
mistake the Designer caught earlier (a guard that silently kills something still needed): both
functions' entire remaining bodies are pure reactive-web-only logic (`resetNotifTracking()` +
`sendNotif()` calls, and `appt.reminded` bookkeeping that the file's own comment at line 5911-5913
confirms v35's engine deliberately never reads). Nothing native-relevant is orphaned by the early
return.

**My own live evidence** (re-running T8 fresh, both ports): seeded Zofran 9–12, booted 60s before
window-open, advanced the fake clock across 9:00:00 with the page open (simulating foreground at the
exact window-open instant). `bootScheduleCalls=1`, `totalScheduleCallsAfterCross=1`,
`reactivePathFiredSecondSchedule=false` — no second `schedule()` call, no duplicate. Pre-fix, this
exact same test (`outputs/audit_v35_live_tests_8917.log`) genuinely failed with a second `schedule()`
call ~32s later for a differently-id'd "Zofran Due" notification — confirming this isn't a
retroactively-softened claim, the before/after behavior is real.

**Verdict: F2 genuinely fixed, confirmed via real Playwright fake-clock foreground simulation.**

---

## 3. F3 (should-fix) — CONFIRMED FIXED, live-tested myself

The backstop line (6207) now reads `syncNativeReminders({ force: true })`. `syncNativeReminders`'s
signature short-circuit (`if (!opts.force && signature === notifLastSignature) return;`) is correctly
bypassed by this, matching every other "make sure this really happens" call site in the file (boot,
retry button, "Try again").

**My own live evidence** (re-running T10 fresh, both ports): seeded a static plan (no meds, one
far-out appointment so the signature can't drift naturally), let boot sync succeed, then flipped the
stub's `permState` to `'denied'` with zero in-app action (modeling an OS-level revoke), advanced the
clock past 6h with no other trigger. Result: `cardShowsBlocked=true`, `cardStillShowsOnStale=false` —
the Settings card correctly flips to "blocked" from the un-forced-signature-defeating scenario the
Auditor specifically constructed. Pre-fix this same test genuinely showed `cardShowsBlocked=false`,
`cardStillShowsOnStale=true` in the Auditor's raw log.

**Verdict: F3 genuinely fixed, confirmed live.**

---

## 4. F4 / F5 — confirmed correctly framed as non-blocking by the Auditor, left unfixed as intended

Re-read both sections of `AUDIT_v35_rebuild.md` in full. F4 is explicitly headed "NICE-TO-HAVE
(code-analysis, not live-reproduced)" and the Auditor traces both consumers of the stale
`notifPlanApplied` field to conclude it "does not currently cause an observable bug." F5 is headed
"NICE-TO-HAVE" and the Auditor computes the actual collision probability (~3.8×10⁻⁶ per full plan at
this app's real data volume) rather than asserting risk by feel. Neither was rated should-fix or
blocker, neither was live-tested as broken, and the Auditor's own summary table lists both as
"Nice-to-have." Leaving them unfixed is consistent with the Auditor's own severity call — **not
treated as still-open blockers**, per this task's instruction not to re-litigate a severity the
Auditor themselves set.

---

## 5. Gaps the Auditor did not cover — my own fresh probing (`lead_auditor_v35_probes.mjs`, LA1–LA4)

I wrote a fresh script (not adapted from the Auditor's) specifically targeting what wasn't checked:

- **LA1 — the 4th `persistMedicationConfig()` site (`moveReorderableMed`):** see §1 above. Live-tested,
  confirmed harmless (order-independent tags).
- **LA2 — `deleteProfile()` has no `markNotifDirty()` call and doesn't reload.** Traced the code: it
  only deletes a *non-active* profile's `localStorage` keys, never touches the native alarm bridge
  directly. Because `syncNativeReminders()` reconciles against `ln.getPending()` (the device's true
  global state, not scoped by profile) minus the *active* profile's own plan ids, any alarm belonging
  to a just-deleted inactive profile gets swept up as `toCancel` on the active profile's *next real
  sync* — regardless of which profile originally armed it. I live-tested this by injecting a synthetic
  "orphaned" pending alarm (simulating a stale alarm from a deleted profile) and then triggering a real
  in-app action that legitimately calls `markNotifDirty()` (re-saving a medication in the editor):
  the orphan was correctly cancelled (`orphanStillPendingAfterNextSync=false`). **Bounded by the same
  6h `force:true` backstop as everything else — not a permanent leak, but also not instant** (a
  freshly-deleted profile's stale alarms can linger until the active profile's own next sync, up to
  6h). Nice-to-have for a future pass, not blocking.
- **LA3 — the 400ms `markNotifDirty()` debounce window.** Confirmed by direct test: closing the
  browser context ~270ms after a real medication-delete UI action shows the debounced `syncNativeReminders()`
  had genuinely not fired yet (`scheduleCallsAt~270msPostEdit === scheduleCallsAtBoot`). This means an
  edit immediately followed by a force-kill of the native app within the 400ms window is lost for that
  session. This is inherent to any debounce pattern, is not new/introduced by the F1/F2/F3 fix, and is
  bounded by the (now correctly force:true) 6h backstop on the next session/idle period — informational,
  not a defect.
- **LA4 — `removeEntryDB()` (index.html ~206-209) still has no `markNotifDirty()`/resync hook.** The
  Auditor's own F1 write-up explicitly flagged this as "a fourth, lower-severity instance of the same
  root cause" but the task's own framing (and the Developer's fix commit) scoped F1's fix to exactly
  the 3 medication-config sites — this one was knowingly left out, not silently missed. I confirmed
  it's still genuinely unfixed with a live test: seeded a dose already logged (so its window is
  excluded from the armed plan, correctly), removed that entry through the real UI ("Remove" →
  "Delete" two-tap confirm), waited past the debounce — `scheduleCalls` never incremented
  (`1 → 1`), i.e. no resync was attempted and the window (now legitimately "due again") does not get
  re-armed promptly. **This remains open.** It matches the Auditor's own severity call (lower-severity,
  narrow — undoing a mistaken dose log is rare, and it self-heals within 6h via the backstop, same
  bound as everything else), so I am not scoring it as a new blocker, but it should be tracked
  explicitly rather than silently dropped from the record now that F1's headline is "fixed."

No other medication-mutation call sites were found beyond these. `mergeMissingDefaultMeds()` only runs
inside the boot-time `loadMedicationConfig()` path, which is already covered by the unconditional
`force: true` boot sync (line 6218-6220) — not a gap.

---

## 6. Regression suite — re-run myself, fresh output, not re-quoted from a prior log

```
$ BASE_PORT=8917 node outputs/audit_v35_live_tests.mjs   → ALL PASS (10/10), both 8917 and 8910
$ BASE_PORT=8917 node outputs/lead_auditor_v35_probes.mjs → ALL PASS (4/4, my own fresh checks)
$ BASE_PORT=8917 node verify_v35_rebuild.mjs             → PASS (6/6) — R1-R6 all pass, including R5
$ BASE_PORT=8917 node verify_smoke_v24.mjs               → FINAL RESULT: PASS (mobile/small-mobile/desktop, 0 console errors)
$ BASE_PORT=8917 node verify_notif_fix_v24.mjs           → FINAL RESULT: PASS (TC1-TC4 all pass)
```

All 5 scripts were executed by me, in this session, against the live servers — not read from a
previous run's log file. The Developer's claim that all pre-existing regression suites plus the
Auditor's own T1–T10 pass on the fixed build is **independently confirmed true**.

---

## 7. Fix-mechanics sanity check (same bug class as the earlier Designer blocker)

Specifically checked whether the new `markNotifDirty()` calls / `isNativeApp()` guards / `force: true`
addition repeat the earlier disabled-button `setAttribute` trap or any similar sloppy pattern:

- All 3 new `markNotifDirty();` calls are plain function calls with no conditional wrapping that could
  silently no-op them — confirmed by direct live testing (§1), not just reading the text.
- The two new `if (isNativeApp()) return;` guards sit at the very top of their functions, before any
  other logic, and I confirmed by reading the full function bodies that nothing below the guard is
  needed on native (§2).
- `{ force: true }` is passed as a plain object literal matching `syncNativeReminders(opts)`'s existing
  `opts.force` contract used identically at 4 other call sites in the file (`retryNotifPermission`,
  the "Try again" button, boot) — no new/inconsistent option shape introduced.
- `git show 29995ee --stat`: only `index.html` touched, 23 insertions / 4 deletions, no incidental
  changes elsewhere (no drive-by edits, no changed test files, no package.json/lockfile changes).

No repeat of the Designer-stage bug class found.

---

## Sign-off

| Item | Status | Evidence |
|---|---|---|
| F1 (3 sites: delete/pause/save) | ✅ **CONFIRMED FIXED** | Live Playwright UI clicks, both ports, T4/T9 fresh re-run |
| F2 (reactive-path duplicate) | ✅ **CONFIRMED FIXED** | Live fake-clock foreground simulation, both ports, T8 fresh re-run |
| F3 (backstop force:true) | ✅ **CONFIRMED FIXED** | Live permission-revoke simulation, both ports, T10 fresh re-run |
| F4 / F5 | Correctly left unfixed | Auditor's own report frames both as nice-to-have, not live-reproduced; not blockers |
| Regression suites (T1-T10, R1-R6, smoke, notif-fix) | ✅ **All pass, fresh run by me** | Pasted output above, this session |
| 4th `persistMedicationConfig()` site (`moveReorderableMed`) | Checked — harmless, no fix needed | LA1, live-tested |
| `deleteProfile()` missing hook | **Open, low severity** | LA2, live-tested — bounded/self-healing within 6h, not instant |
| 400ms debounce loss window | Checked — inherent, not a new regression | LA3, live-tested |
| `removeEntryDB()` missing hook | **Open, low severity (Auditor-documented, knowingly deferred)** | LA4, live-tested |

**Checked:** every claimed fix (F1×3 sites, F2×2 guards, F3), the full diff for sloppiness, every
`persistMedicationConfig()` call site in the file, `deleteProfile()`/profile-switch paths, the
400ms debounce's failure mode, and all 3 pre-existing regression harnesses plus the Auditor's own
10-check live suite — all executed fresh by me this session, on both ports.

**Found fixed (with my own independent live evidence, not re-quoted claims):** F1, F2, F3 exactly as
claimed. No regressions introduced. No repeat of the earlier Designer-stage bug class.

**Open (not blocking, explicitly tracked rather than silently dropped):**
1. `removeEntryDB()` still has no resync hook — Auditor-documented as part of F1's root cause but
   deliberately out of scope for this fix pass; self-heals within 6h via the (now correctly forced)
   backstop.
2. `deleteProfile()` has no resync hook either — new finding from this stage, same bounded/self-healing
   character as #1, narrower still (requires multi-profile use with an inactive profile carrying its
   own armed alarms).

Neither open item is a live-reproduced blocker: both are narrow, both self-heal within the same 6-hour
window the F3 fix now genuinely guarantees, and neither contradicts anything the Developer or Auditor
claimed. Per this chain's rule that a real defect sends the whole thing back to stage 1, I am **not**
treating either as grounds for rejection — they're pre-existing/adjacent gaps in the same family as
F4/F5, not defects in what was claimed fixed.

**Verdict: READY to proceed to the Project Manager stage.** F1/F2/F3 are genuinely fixed, verified with
my own independent live Playwright evidence on both ports, the regression suite claim is real (fresh
output pasted above), and the fix mechanics themselves are clean. The two open low-severity items
(#1/#2 above) should be logged for a future pass but do not block this release.

---

**Scripts used (all in `/home/claude/chemowell-app-beta`):**
- `outputs/audit_v35_live_tests.mjs` — Auditor's own harness, re-run fresh by me on both ports.
- `outputs/lead_auditor_v35_probes.mjs` — my own fresh script (LA1-LA4), not adapted from any prior stage's script.
- `verify_v35_rebuild.mjs`, `verify_smoke_v24.mjs`, `verify_notif_fix_v24.mjs` — pre-existing regression suites, re-run fresh.
