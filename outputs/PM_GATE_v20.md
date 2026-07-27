# PM GATE — app-v20

Role: Project Manager, Quality Chain stage 8 (final internal gate before the Owner), per `TEAM.md` §8.
Date: 2026-07-27 · Release under review: app-v20 (three combined medication-editor features: pause a
medication, "excluded near treatment day," a 15-minute schedule-window time picker) — an unusually long
chain that failed the Auditor once (2 MAJOR defects), triggered a full restart per `TEAM.md`'s rule, then
passed a second full Designer→Lead Designer→QA→Auditor→Lead Auditor cycle. All findings below were
checked against the actual files, not against any report's description of them.

---

## 1. Pipeline completeness — every stage present, in order, no gaps

**First pass (pre-restart):**

| Stage | Artifact | Present |
|---|---|---|
| 1. Developer | `outputs/DEV_BRIEF_pause_treatment_exclusion.md` | Yes |
| 1. Developer | `outputs/DEV_BRIEF_schedule_window_picker.md` | Yes |
| 2. Lead Developer | *(no separate artifact — see note below)* | N/A by convention |
| 3. Designer | `outputs/DESIGNER_REVIEW_v20.md` | Yes — 4 FAILs, all fixed same-pass |
| 4. Lead Designer | `outputs/LEAD_DESIGNER_SIGNOFF_v20.md` (incl. RE-VERIFICATION addendum) | Yes |
| 5. QA Tester | `outputs/QA_USER_ZERO_v20.md` (incl. Part 7 re-verification addendum) | Yes |
| 6. Auditor | `outputs/AUDIT_v20.md` | Yes — found P1-1, P1-2 (MAJOR), P2-1 → **restart triggered** |

**Restart (second pass), per `TEAM.md`'s "back to the START, not one step" rule:**

| Stage | Artifact | Present |
|---|---|---|
| 1. Developer | `outputs/DEV_BRIEF_v20_restart.md` | Yes — explicitly analyzes why the 3 findings survived prior review, per the repeat-failure requirement |
| 2. Lead Developer | *(no separate artifact — see note below)* | N/A by convention |
| 3. Designer | `outputs/DESIGNER_REVIEW_v20_restart.md` | Yes |
| 4. Lead Designer | `outputs/LEAD_DESIGNER_SIGNOFF_v20_restart.md` | Yes |
| 5. QA Tester | `outputs/QA_USER_ZERO_v20_restart.md` | Yes |
| 6. Auditor | `outputs/AUDIT_v20_restart.md` | Yes — found a 3rd variant (P1-2-B) mid-report, fixed and re-verified inline (§10), verdict updated to CLEARED |
| 7. Lead Auditor | `outputs/LEAD_AUDITOR_SIGNOFF_v20.md` | Yes — verdict PASS/CLEARED, 3 process notes (N1, N2, N3) |
| 8. Project Manager | This document | In progress |

**No missing artifact at either pass. No automatic fail on this axis.**

**Stage 2 (Lead Developer) precedent check:** `PM_GATE_v17.md` treats the Lead Developer's implementation
as the code diff itself plus its own self-verification (`node --check`, harness, browser smoke test),
independently exercised live by every downstream stage rather than documented in a separate written
artifact — `PM_GATE_v17.md` §1 lists six artifacts (Dev Brief through Lead Auditor sign-off) with no
"Lead Developer report" row, and its body confirms the actual diff via `git diff` rather than a
self-report. This release follows the identical convention at both passes: no `LEAD_DEV_*.md` file
exists for either the original build or the restart fix, and every downstream stage (Designer, QA,
Auditor) independently exercised the running build rather than reading a Lead Developer summary. This is
consistent with prior-release practice, not a gap. I additionally confirmed the Lead Developer's own
in-code comments at the fix sites (`index.html:3202-3209`, `:363-366`) document the reasoning
contemporaneously with the diff, functioning as the informal record `TEAM.md` implicitly expects when a
stage has no dedicated report format.

---

## 2. Chain of custody on findings — traced end to end, verified against actual current source

### First-pass Designer findings (4 FAILs) — fixed same-pass, re-verified twice

`DESIGNER_REVIEW_v20.md` found: Item 2 (schedule-window trash button 40px, below the 44px convention),
Item 5 (Only-mode and Excluded-mode badges visually identical — opposite states, same color), Item 6
(Pause/Resume header button 40px), Item 8 (grouped-card paused row missing muted styling). All four were
fixed by the Lead Developer in the same pass. `LEAD_DESIGNER_SIGNOFF_v20.md`'s original pass found Items
5/6/8 clean but caught that the Item 2 fix itself introduced a **new, unclaimed regression** — the
enlarged 44px button no longer fit on the row at 360-390px and silently wrapped to its own line — plus a
missing README version-history row. Both were sent back, fixed, and the Lead Designer's own §6
re-verification addendum confirms both closed with fresh `getBoundingClientRect()` measurements, not a
re-description. **Verified fixed, verified re-verified.**

`QA_USER_ZERO_v20.md`'s original pass found one blocking defect independent of the Designer's four: a
toast-occlusion bug (`index.html:1985`, no `pointer-events` set) that hid the medication editor's
Discard/Add buttons at keyboard-open heights for ~4.5s after a validation error — real, reproducible,
made modestly more likely by this release's own new required fields. Fixed with `pointerEvents: 'none'`;
QA's own Part 7 addendum re-verified with a **real, non-forced click** landing on the button while the
toast was still visually overlapping it, not just a hit-test. **Verified fixed, verified re-verified.**

### The Auditor's first pass — P1-1, P1-2, P2-1 — all three traced to fix + independent re-verification

- **P1-1** (delete-and-re-add-under-the-same-name silently discards `pausePeriods`, reviving the exact
  missed-dose flood the feature exists to prevent): `DEV_BRIEF_v20_restart.md` correctly identifies that
  the Auditor's own stated preference (option "b," stop recycling ids) does **not** fix the reported
  defect, and implements option "a" (archive `pausePeriods` on delete, restore on matching re-add) with a
  landmine analysis (closing open periods at deletion time; `normalizeArchivedMeds` must also preserve
  the field or the fix silently breaks on reload). I independently read the shipped code
  (`index.html:3197-3216`, `:358-370`, `:280-282`) and confirm the fix matches the brief exactly, with
  in-code comments documenting the reasoning. `AUDIT_v20_restart.md` §2 re-ran all 9 of the Dev Brief's
  test scenarios live and confirms fixed. `LEAD_AUDITOR_SIGNOFF_v20.md` T1 independently reproduced the
  exact repro through the real UI (trash→confirm→re-add via the actual form, not state injection):
  "8 missed doses" both before delete and after re-add, never 10. **Verified fixed, verified
  re-verified twice over.**
- **P1-2** (standalone Quick Log card vanishes instead of showing "Paused" for a paused +
  `treatmentMode:'excluded'` medication, while the grouped-card equivalent correctly shows it):
  `DEV_BRIEF_v20_restart.md` diagnoses this as two independent clauses bundled into one `.filter()`
  clause and recommends moving only the `treatmentExcludedNow` half, leaving the `treatmentOnly`
  ("only"-mode) half untouched as an explicit, reasoned scope decision. I confirm the shipped
  `medCards` filter (checked at `index.html:2708`, pre-P1-2-B-fix version referenced in
  `AUDIT_v20_restart.md` §3) matches this description exactly. `DESIGNER_REVIEW_v20_restart.md` and
  `LEAD_DESIGNER_SIGNOFF_v20_restart.md` both independently built the exact combination state and
  confirmed the "Paused" card renders with a working 44px Resume button that round-trips through
  `localStorage` correctly. `AUDIT_v20_restart.md` §3 re-confirmed live. **Verified fixed, verified
  re-verified.**
- **P2-1** (`normalizeMedication` doesn't self-heal a desynced `treatmentOnly`/`treatmentMode` pair):
  fix is "derive `treatmentOnly` from a locally-computed `treatmentMode`, not read independently." I
  confirm this exact pattern is live in the current source: `index.html:305` (local `treatmentMode`
  computed once) and `index.html:328` (`treatmentOnly: treatmentMode === 'only'`, no independent read of
  `original.treatmentOnly`). `AUDIT_v20_restart.md` §4 re-ran H1/H2 plus 5 additional cases beyond the
  original pair (inverse-desync direction, both legacy migration paths, a fresh save/reload round-trip)
  — all pass. **Verified fixed, verified re-verified beyond the original test set.**

### The restart Auditor's own new finding — P1-2-B — traced to fix + inline re-verification

`AUDIT_v20_restart.md` initially verdicted **NOT cleared** (§1, §9) after finding a third variant of the
same defect class: a standalone `'only'`-mode-and-paused-and-outside-window medication also vanished
instead of showing "Paused" — the exact combination `DEV_BRIEF_v20_restart.md`'s own P1-2 "Test scenario
6" predicted and flagged as worth checking, which no downstream stage (Designer, Lead Designer, QA) had
actually constructed. This was fixed same-day and re-verified **inline in the same report** (§10, not a
separate document) — I read this addendum specifically, per this gate's brief: the fix changed
`medCards`'s filter to `state.meds.filter(m => m.quickLog && (m.paused || !m.treatmentOnly || (...)))`
— a `m.paused ||` short-circuit prepended to the OR chain, which is a **more general** fix than the
Auditor's own original recommendation (mirroring the P1-2 move) since it composes correctly with every
existing and future clause in that chain, including `courseComplete`, without needing each one
enumerated separately. §10's own Test 4 explicitly checks the `courseComplete` interaction the original
recommendation didn't address. I independently confirmed this exact line is live in the current source:

```
index.html:2708: const medCards = state.meds.filter(m => m.quickLog && (m.paused || !m.treatmentOnly || (treatmentActiveOn(m, now) && !status(m).courseComplete))).map(med => {
```

`AUDIT_v20_restart.md` §10 re-ran the full 28-check suite after the fix (28/28, up from 27/28) to confirm
zero regression from the fix itself, plus 5 targeted checks on the fix (exact repro, regression check
for the non-paused case, the original P1-2 combination still correct, the `courseComplete` interaction,
and a P3 re-confirm). `LEAD_AUDITOR_SIGNOFF_v20.md` T3/T3b independently reproduced both the fix and its
regression-check through real UI clicks (not state injection), a different and stricter mechanism than
either Auditor script used. **Verified fixed, verified re-verified twice over, including by the harder
"real click through the real form" bar the Lead Auditor deliberately applied.**

**Chain-of-custody verdict: every finding from every stage across both passes — 4 Designer items, 1 QA
item, 3 first-Auditor findings, 1 restart-Auditor finding — has a traceable fix in the current source and
at least one independent, live re-verification. Nothing rode along unresolved.**

---

## 3. N2 (README) — checked directly against the current file, not the Lead Auditor's description

`LEAD_AUDITOR_SIGNOFF_v20.md` flagged N2: at the time it was written, the `app-v20` README row described
only the three original features, not the restart's fixes, and explicitly required a **rewritten** row
before final push (not just confirmation a row exists).

I read the current `README.md` app-v20 row (line 14) directly. It has since been rewritten and now
covers, specifically and honestly:
- The three original features and their exact mechanism (`pausePeriods` tracking, the 3-way
  Treatment-day-availability radiogroup, the decimal-hour schedule-window picker and the three landmines
  it fixed).
- The original Designer/Lead Designer/QA findings and fixes from the first pass (touch targets, badge
  color collision, the toast-occlusion bug), in the same level of detail as prior release rows.
- **A dedicated "Chain restart" section**, explicitly named as such, describing: the Auditor's two MAJOR
  defects that triggered the restart (P1-1 and P1-2, described accurately, not euphemized), their fixes,
  the `loadMedicationConfig()` bug that fixing P1-1 surfaced as a side effect, the third "only-mode
  sibling" variant the restart Auditor caught, and that the Lead Auditor independently reproduced the
  core scenarios via real UI interaction before clearing to the PM gate.
- The known, non-blocking History "N doses" miscount, named and flagged as logged for a future pass.

This is a genuinely rewritten, specific, honest account of the full restart arc — not a placeholder, not
a copy of the original three-feature description with a line appended. **N2: resolved, confirmed against
the current file.**

(The README row does not separately name the P3 id-suffix-collision gap. This is not a defect in the
README's honesty — README rows in this project's convention summarize the release's arc for Aaron, not
every deferred low-severity finding; P3 is correctly documented in the audit chain itself, see §6 below,
which is where `TEAM.md` places the burden of not silently dropping a finding.)

---

## 4. Scope match — re-read against what Aaron actually asked for

Re-read both original Dev Briefs' framing of the ask:

1. **Pause a medication, with no missed-dose flooding on resume** — the Dev Brief's Lead Developer
   correction section explicitly names this as Aaron's own flagged requirement and designs
   `pausePeriods` (not a single boolean) specifically to satisfy it. I confirm this promise is intact
   in the shipped, now-twice-fixed build: `isPausedOn(med, dayTs)` (`index.html:640`) checks historical
   pause periods per day, `missedDosesFor` gates on it, and — critically — this promise now **survives**
   the delete/re-add action that the first Auditor pass proved could otherwise silently break it
   (P1-1, fixed and independently re-verified in §2 above). The feature was not watered down to fix the
   bug — the fix strengthens exactly the promise the feature was built to keep.
2. **Excluded-vs-only as one exclusive choice** — delivered as the `treatmentMode: 'none'|'only'|'excluded'`
   three-way radiogroup (`index.html`'s `TREATMENT_MODE_OPTIONS`), reusing the existing v13
   "Home screen placement" picker idiom per the Dev Brief's own precedent-matching reasoning, rather than
   two independent toggles that could contradict each other. Confirmed live and in source across every
   review stage; the P2-1 fix (deriving `treatmentOnly` from `treatmentMode`, not two independent reads)
   makes this exclusivity now enforced at the one function the codebase treats as its schema-drift safety
   net, closing a gap rather than opening one.
3. **The 15-minute dropdown schedule picker** — delivered as a repeatable Start/End `<select>` row list
   at 15-minute intervals with a live plain-language preview, replacing the free-text field. Confirmed
   present and correctly styled by every Designer-stage review across both passes; the decimal-hour data
   model and its three required landmine fixes (`hourTs`, `dueRemindersAt`'s firing gate,
   `normalizeMedication`'s clamp ceiling) were confirmed closed by the first Auditor pass and
   independently re-confirmed untouched-and-correct by the restart Auditor.

**No feature was quietly dropped or watered down across either pass.** The restart fixed cross-feature
composition bugs (how pause interacts with the treatment-window guards on one specific card layout) — it
did not touch, narrow, or remove any of the three core promises above. I confirm this by the same method
the Lead Developer used to scope the restart itself: `DEV_BRIEF_v20_restart.md` explicitly rejected a
wider fix (moving both filter clauses) specifically to avoid an unreviewed change to the "only"-mode's
13-release-old vanish-outside-window behavior — i.e., the restart's own discipline was to fix the new
bug without touching the older, correct, already-shipped behavior it sits next to.

---

## 5. Release mechanics — checked against the actual files myself

- `index.html:3536` → `const APP_VERSION = 'app-v20';` — **not bumped from the original app-v20 build.**
  This is intentional and consistent across every stage of the restart: `AUDIT_v20_restart.md`'s header
  explicitly notes "unchanged version string, consistent with how every stage since the restart began
  has treated it... version/`sw.js` cache/README bump is expected at final push once the whole chain
  clears, not before." A restart is a fix pass on the same numbered release per `TEAM.md`'s restart rule
  ("the process starts over" — it does not say "the version number increments mid-restart"), and every
  downstream stage (Designer, Lead Designer, QA, both Auditor passes, Lead Auditor) treated it this way
  without exception. **Confirmed correct, not an oversight** — but the version/cache bump to the *next*
  version (if Aaron wants one) or reconfirmation of `app-v20` as final is the Lead Developer's job at
  push time, addressed below.
- `sw.js:1` → `const CACHE = 'chemowell-app-v20';` — matches `index.html`'s `APP_VERSION`, consistent
  with the same "not yet bumped for final push" state.
- `README.md`'s version-history table top row — `app-v20`, dated 2026-07-27, above `app-v19` — present,
  and (per §3 above) rewritten to honestly describe the full restart arc, not just the original three
  features.
- **N1 (uncommitted working tree) — checked directly, not from the Lead Auditor's description.**
  `git status`: local branch is 1 commit ahead of `origin/main` (`4ba3beb`, a docs-only Dev Brief commit),
  with `index.html`, `sw.js`, `README.md` modified-but-unstaged, and every v20/v20-restart chain report
  (`AUDIT_v20.md`, `AUDIT_v20_restart.md`, `DESIGNER_REVIEW_v20.md`, `DESIGNER_REVIEW_v20_restart.md`,
  `DEV_BRIEF_v20_restart.md`, `LEAD_AUDITOR_SIGNOFF_v20.md`, `LEAD_DESIGNER_SIGNOFF_v20.md`, and more)
  untracked. **This is expected at this exact point in the chain** — per this gate's instructions, the
  push/deploy/live-verify step happens *after* the PM gate clears, not before, and every prior release
  (`PM_GATE_v17.md` §4) documented the identical N1-class note at this same stage before its own
  Lead Developer pushed. **Not failing the gate for this** — flagging it explicitly below as the one
  concrete action item for the Lead Developer immediately following this sign-off.
- **Live-build smoke test on `arnjnnngs.github.io/chemowell-app-beta`:** not run, and correctly not run —
  the current build is uncommitted/unpushed, so the live site cannot yet reflect it. Per this gate's
  brief, this does not fail the gate; it is the explicit next step after this sign-off (see §7).

**Release mechanics: version/cache/README are internally consistent and correctly reflect the restart's
current state. The one open item — commit and push — is expected at this stage, not a gap, and is
flagged as the Lead Developer's immediate next action.**

---

## 6. Deferred/known items — confirmed documented, not silently dropped

- **N3 — History day-summary "N doses" count includes non-dose entries** (Blood Pressure, Bowel
  Movement, Appetite, Symptom entries counted alongside actual medication doses, `index.html:3723` per
  `QA_USER_ZERO_v20_restart.md`'s original citation). Confirmed documented in three places: QA's own
  report (found it, assessed it correctly non-blocking per `TEAM.md`'s literal FAIL bar since nothing is
  hidden/unreachable), `LEAD_AUDITOR_SIGNOFF_v20.md` N3 (carries it forward explicitly so it "isn't lost
  between chain stages"), and the current `README.md`'s app-v20 row (named explicitly: "the History
  day-summary count includes non-dose entries like vitals/symptoms... logged for a future pass, not
  fixed here"). Confirmed genuinely unrelated to this release's diff (pre-existing, untouched by any of
  `loadMedicationConfig`/`deleteMedicationConfig`/`saveMedicationEditor`/`medCards`/`normalizeMedication`)
  and confirmed not touching any safety-critical math (dose ceilings, gap timers, missed-dose detection
  all key off `entriesFor(specificMedId)`, not this summary line). **Correctly deferred, not silently
  dropped, does not block this gate.**
- **P3 — id-suffix-collision in the archive-restore matching** (`AUDIT_v20_restart.md` §6: two
  same-named medications, one auto-suffixed to `-2`; deleting and re-adding once under the unsuffixed
  name restores the *never-paused* sibling's empty archive rather than the actually-paused sibling's
  real history). Confirmed documented in `AUDIT_v20_restart.md` §6 (found, reproduced, root-caused,
  explicitly recommended as "low priority, not blocking this release... flag to Aaron as a known,
  accepted, narrow gap"), re-confirmed still reproducing (unfixed, correctly so) in §10 Test 5, and
  carried forward explicitly in `LEAD_AUDITOR_SIGNOFF_v20.md` §6 ("Correctly flagged as a known,
  accepted, deferred gap — not a blocker"). This requires a user to have deliberately created two
  medications with the exact same name at some point — narrower and rarer than the ordinary single-med
  delete/re-add action P1-1 was about, and P1-1's own 9-scenario test matrix (re-verified independently
  by the Lead Auditor) confirms the ordinary case is unaffected. **Correctly deferred, not silently
  dropped, does not block this gate.**
- Also carried forward from the restart's own investigation, correctly out of scope and explicitly named
  in both the Dev Brief and the README: the pre-existing dose-entries/ceiling cross-contamination under
  a recycled medication id (a *different*, older gap than P1-1, not fixed by this pass, explicitly
  verified "unchanged, not worsened" by both Auditor passes' Test 9).

Both N3 and P3 will be relayed to Aaron in the completion summary below, honestly and by name, per this
gate's instruction — not folded silently into a generic "known issues" footnote.

---

## 7. Verdict

**CLEARED — this release is complete, correct, and ready for the Lead Developer to commit, push, and
live-smoke-test before reporting to Aaron.**

All eight artifacts across both the original pass and the restart exist, are substantive, and are in the
correct order. Every finding from every stage — 4 Designer items, 1 QA item, the original Auditor's 3
findings, and the restart Auditor's own new P1-2-B finding — has a traced fix in the current source and
at least one independent, live re-verification; several have two. The README's app-v20 row has been
rewritten (N2, closed) to honestly describe the full restart arc, not just the original three features —
confirmed by reading the current file myself. The shipped, twice-fixed build still delivers exactly the
three things Aaron asked for, with no quiet feature drops: pause-without-flooding (now hardened against
the delete/re-add edge case that could have broken its core promise), excluded-vs-only as one exclusive
choice (now self-healing against field desync), and the 15-minute schedule picker (with all three
decimal-hour landmines closed and independently re-confirmed). Version/cache/README are internally
consistent for the restart's current state; the deliberately-unbumped `APP_VERSION`/`CACHE` strings are
correct, not an oversight, per the restart-is-same-release convention every stage since the Auditor's
first pass has followed.

**One concrete action remains, and it is the Lead Developer's, not this gate's, to close:** N1 —
`index.html`, `sw.js`, `README.md`, and every v20/v20-restart chain report are currently
modified/untracked, not committed or pushed. Per this gate's brief, this is the expected state at this
exact point in the process and does **not** fail the gate — but nothing has been live-verified on
`arnjnnngs.github.io/chemowell-app-beta` yet, and cannot be until it's pushed. **Before reporting
completion to Aaron, the Lead Developer must: (1) commit the working tree, (2) push to `origin/main`,
(3) load the live site with a cache-buster and confirm `APP_VERSION`/the three features render and work
exactly as this chain verified locally.** This is the one remaining step after this sign-off, not a
defect in the work itself.

N3 (History day-summary miscount) and P3 (id-suffix-collision) are both real, both correctly triaged as
non-blocking and out of scope for this release, and both explicitly documented across the chain rather
than silently dropped — see §6. Neither blocks this gate.

---

## 8. Completion summary — for Aaron

Here's where things stand on the medication-editor update (pause, excluded-near-treatment-day, and the
new time picker).

**What was built.** Three things you asked for, all now working together correctly:
1. **Pause a medication** — a Pause/Resume button so you can temporarily turn off any medication without
   deleting it. While paused, it shows a clearly muted "Paused" card, doesn't ask you to log doses, and
   — the part you specifically flagged as important — resuming it does **not** flood you with a wall of
   "missed dose" alerts for the days it was paused. The app now remembers exactly which days were paused,
   permanently, so that promise holds even if you later delete that medication and re-add it (see below
   for why that mattered).
2. **"Excluded near treatment day"** — the opposite of the existing "only near treatment day" feature.
   You now pick one of three options for each medication — Always available / Only near treatment day /
   Excluded near treatment day — instead of juggling two separate switches that could contradict each
   other.
3. **A real time picker** for medication schedules, replacing the old free-text box where a typo could
   silently drop a reminder window without telling you. It's now a proper dropdown list, 15-minute
   increments, with a plain-English preview line ("Reminds between 8:00 AM and 8:30 AM") so you can see
   exactly what you're setting.

**What went wrong along the way, and how it was caught.** This one had a rockier road than most releases,
which is exactly what the process is designed to catch before you ever see it:

- The first full round of reviews (design check, a second design check, and a full test-user walkthrough)
  found some smaller polish issues — a couple of buttons slightly under our touch-target size, two badges
  that looked identical for opposite meanings, a toast notification that could briefly cover the Save
  button on a phone. All fixed and re-checked before moving on.
- Then the code auditor — whose whole job is to try to break things — found two real, serious problems:
  deleting a medication and re-adding one with the same name (something you might do just to fix a typo)
  could silently undo the "no flood of missed-dose alerts" promise from Pause. And a medication that was
  both paused and set to "excluded near treatment day" could vanish from your Home screen entirely instead
  of showing as paused. Per our rule, finding a serious problem sends the whole thing back to square one —
  not a quick patch, a full re-do of the entire review chain on the fix.
- The fix pass went through everything again — fresh design review, fresh test-user walkthrough, fresh
  audit — and the audit caught a **third**, closely related variant of that same vanishing-card bug (a
  sibling case involving "only near treatment day" instead of "excluded"). That got fixed the same day and
  re-checked live before moving forward.
- A senior reviewer then independently re-tested the riskiest parts by hand, through the real screens (not
  shortcuts), and confirmed everything holds up.

**What's true now.** All three features work as intended, including in the tricky combinations that
caused the trouble above. Every problem that was found got fixed and re-verified — nothing was just
"probably fine."

**What's knowingly left for later (not part of this release, not urgent):**
- The daily History screen's "N doses" count sometimes counts a blood-pressure or symptom entry as if it
  were a medication dose — a display miscount only, doesn't affect your actual dose safety tracking. Worth
  fixing in a future pass.
- A narrow edge case: if you ever create two medications with the exact same name, delete both, and
  re-add one, there's a small chance it restores the wrong one's pause history. This requires a fairly
  unusual setup to hit and doesn't affect the normal case of pausing/deleting/re-adding a single
  medication.

**What's left before this is fully live:** the fix is verified and ready, but hasn't been pushed to the
live site yet. That's the very next step — once it's pushed, it gets one final check on the actual live
app before you'd see it in normal use.
