# LEAD_AUDITOR_SIGNOFF_v20 — review of AUDIT_v20.md + AUDIT_v20_restart.md

Role: Lead Auditor (Quality Chain stage 7) · Date: 2026-07-27 · Build under review: app-v20 restart
(`const APP_VERSION = 'app-v20'`, `index.html:3536`, unchanged version string — a restart pass on the
same numbered release, consistent with how every stage since the restart began has treated it).

Basis: `outputs/AUDIT_v20.md` (original pass, found P1-1/P1-2/P2-1), `outputs/AUDIT_v20_restart.md`
(re-verification pass, found and got a live fix for P1-2-B, then re-verified that fix — updated verdict
CLEARED), `outputs/DEV_BRIEF_v20_restart.md`, `outputs/DESIGNER_REVIEW_v20_restart.md`,
`outputs/LEAD_DESIGNER_SIGNOFF_v20_restart.md`, `outputs/QA_USER_ZERO_v20_restart.md`, the original
`outputs/DEV_BRIEF_pause_treatment_exclusion.md` / `outputs/DEV_BRIEF_schedule_window_picker.md`, and
the current working tree (`git diff`, `git log`) — plus my own live runs against
`http://localhost:8910/index.html` (Playwright/Chromium, `executablePath` pointed at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, 390×844, `serviceWorkers: 'block'`). **No code
was modified.** My script, written from scratch (not adapted from either audit script):
`/tmp/lead_audit_v20/run.mjs`, 16 live-browser assertions, 16/16 passing.

## Verdict on the Auditors' work: **PASS**

Both audit passes are real and accurate. Every safety-critical claim I independently reproduced held,
using real UI interactions (delete/re-add through the actual Meds-tab trash-then-confirm flow and the
actual Add-medication form, not `state` injection) rather than the audits' own harness conventions. I
found no false positive and no false negative in either report, confirmed the P1-2-B fix's code and its
live behavior directly, closed the two coverage gaps the task flagged as open questions (grouped-card
independence, `reorderableHomeMeds` visibility), and confirmed the cited screenshots are real and show
what they claim. One process note (uncommitted working tree) and one pre-existing scope-boundary item
(README not yet updated for the restart fixes) are flagged below for the PM gate — neither is a code
defect.

---

## 1. CHECKED — the four safety-critical findings, reproduced independently, live, through real UI

I did not seed `state` directly or call internal functions — every scenario went through
`localStorage` seeding (to construct the precondition) followed by **real Playwright clicks/fills**
against the actual DOM (trash icon → confirm-delete, the real Add-medication form including switching
the Schedule-type `<select>` from the default "As needed" to "Scheduled" since the add flow's default
would otherwise block the save on the unrelated gap-hours validation — a wrinkle neither audit script's
report describes but one that confirms my harness is exercising the real form, not a shortcut past it).

| # | Scenario | My independent result |
|---|---|---|
| T1 | **P1-1 exact repro**: `Ibuprofen`, `installedAt` 10 days ago, 2-day open pause, real trash→confirm delete via UI, real re-add via the Add-medication form, same name | **PASS** — header read "8 missed doses from previous days" both before delete and after re-add (never 10); `archivedMeds.ibuprofen.pausePeriods` had its open period correctly closed at deletion time; the re-added medication's `pausePeriods` in `localStorage` was byte-identical to the archived entry |
| T2 | **P1-2 original combination**: `treatmentMode:'excluded'` (active window) + `paused:true`, standalone card | **PASS** — renders "Still pausing ExclPausedStandalone?" banner and the muted "Paused" Quick Log card, not vanished |
| T3 | **P1-2-B (the restart's own new finding)**: `treatmentMode:'only'` + `paused:true`, outside window, standalone card | **PASS** — shows "OnlyPausedStandalone — Paused" with Resume, screenshot saved (`/tmp/lead_audit_v20/t3_only_paused_standalone.png`) |
| T3b | **Regression check**: same but NOT paused | **PASS** — still vanishes entirely (confirms the `m.paused \|\|` short-circuit fix is a true no-op for the non-paused case, not an accidental behavior change to the 13-release-old `'only'`-mode vanish rule) |
| T5 | **P2-1 desync self-heal (H1)**: `treatmentMode:'excluded'` + stale `treatmentOnly:true`, no treatment date logged | **PASS** — medication fully visible, not hidden |

All five reproduce exactly as both audit reports claim. This independently confirms `AUDIT_v20.md`'s
two original P1s, `AUDIT_v20_restart.md`'s re-verification of both, and its own new P1-2-B finding and
fix — through a different mechanism (real form interaction, not `state` injection) than either audit
used, which is deliberately a harder bar to clear if the fix were fragile or the audits had missed a
UI-only failure mode.

## 2. CHECKED — code matches what both audit reports describe, read directly against the served file

Read the actual `index.html` (not the audits' quoted excerpts) at every location cited:
- `medCards` filter (`index.html:2708`): `state.meds.filter(m => m.quickLog && (m.paused || !m.treatmentOnly || (treatmentActiveOn(m, now) && !status(m).courseComplete)))` — confirmed the `m.paused ||` short-circuit is present exactly as `AUDIT_v20_restart.md` §10 describes, with the in-code comment (`index.html:2699-2707`) correctly documenting the reasoning.
- `deleteMedicationConfig` (`index.html:3197-3216`): confirmed the open-period-closing logic (`p.end === null ? {...p, end: today} : p`) and the `{name, sub, pausePeriods}` archive shape, exactly as described.
- `saveMedicationEditor`'s `archivedMatch` restore (`index.html:3110,3126`): confirmed gated on `!editor.sourceId` (add-mode only), exactly as described.
- `normalizeArchivedMeds` (`index.html:358-370`) and `normalizePausePeriods` (`index.html:280-282`): confirmed both preserve `pausePeriods` through every load, matching the audit's "closes the reload landmine" claim.
- `normalizeMedication` (`index.html:284-356`): confirmed `treatmentMode` is resolved once as a local (`index.html:304-305`) and `treatmentOnly` is derived from it (`index.html:328`), not read independently.
- `renderGroupedMedsCard` (`index.html:1641-1677`): confirmed the `paused` branch (`1653`) runs before the treatment-mode branch (`1666`) in the `.map()`, for both `'only'` and `'excluded'` modes — genuinely different code shape from `medCards`, not just relabeled.
- `status()` (`index.html:827-832`): confirmed the `if (med.paused) return {locked:true, paused:true}` short-circuit is the very first line, so `courseComplete` can never be computed for a paused medication — matching the audits' claim that `courseComplete` cannot interfere with the `m.paused ||` fix.

No discrepancy found between either audit's code citations and the file as actually served.

## 3. CHECKED — coverage angles the task flagged as open questions, both closed with no defect found

**(a) Was `renderGroupedMedsCard` independently re-checked for the `'only'`+paused combination, or only
assumed correct?** Both audits did test it (`AUDIT_v20.md`'s original sweep, §2's "composition of the
paused guard" section confirmed `paused` runs first in `renderGroupedMedsCard` for both modes;
`AUDIT_v20_restart.md` §5 explicitly re-confirmed live: "place an identical medication ('only'-mode,
paused, outside window) in a grouped card ... it correctly shows 'Paused'"). I independently re-ran this
myself, from a fresh `localStorage` seed, through the real DOM (T4 above): **PASS** —
"OnlyPausedGrouped — Paused" renders correctly. This was not merely assumed; it was actually built and
tested by both audit passes and again here.

**(b) Does `reorderableHomeMeds()` have a similar filter-ordering assumption that could hide a paused
medication from the Meds-tab reorder controls?** Read the function directly (`index.html:3153-3154`):
```js
function reorderableHomeMeds() {
  return state.meds.filter(med => med.quickLog && !med.groupedMorning && !med.groupedEvening && !med.groupedAfternoon);
}
```
This filter has **no** `paused`/`treatmentOnly`/`treatmentExcludedNow` clause at all — it filters purely
on card *placement* (standalone vs. grouped), not on card *state*. A paused, excluded, or
treatment-only-outside-window medication is therefore never at risk of being filtered out of this list —
there was never a parallel bug class to find here, confirmed both by code reading and live (T6: seeded
one paused standalone medication and one normal one, navigated to the Meds tab, confirmed both names
present in the DOM). Separately, `renderMedicationManager`'s own `sortedMeds` list (`index.html:3454`,
the full alphabetical management list, not just the reorder subsection) is `state.meds.slice().sort(...)`
with **zero** filtering by any state — every medication, paused or not, excluded or not, is always
listed there with visible "Paused"/"Excluded near treatment −N/+M" badges (`index.html:3510-3511`,
confirmed present in source and, per `QA_USER_ZERO_v20_restart.md` Part 5, confirmed live). So even in
the hypothetical worst case where `reorderableHomeMeds()` did hide a card, the medication would still be
reachable and resumable from the Meds tab's main list. No finding here.

**(c) Interaction between the archived-`pausePeriods` restore mechanism and a medication added while the
app is mid first-run tour?** Not tested by either audit pass or by QA (QA's Part 1 first-run walkthrough
added a *brand-new* medication with no prior archive history; nobody constructed an archived-history
medication and then re-added it *during* the guided tour specifically). I built this myself (T7): seeded
`archivedMeds.tourmed` with a real, closed 2-day pause history and an otherwise-fresh, non-onboarded
profile; walked the real first-run flow (name entry → "Get started" → "Show me" → real tap on the Meds
nav tab, which the tour is actively highlighting → real tap on the tour-highlighted `[data-tour="meds-add"]`
button → filled the form, added a medication named "TourMed" through the real submit button). **Result:
PASS** — the medication's `pausePeriods` in `localStorage` after the tour-driven add exactly matched the
pre-seeded archive entry, with zero console/page errors and the tour continuing to function normally
afterward. The restore mechanism (`saveMedicationEditor`'s `archivedMatch` lookup) has no dependency on
tour state (`state.tourStep`) at all — confirmed by code reading (the lookup only reads
`state.archivedMeds` and `editor.sourceId`) as well as by this live run. No finding here, but this was a
genuine, previously-untested combination and is now covered.

## 4. CHECKED — screenshot evidence is real, from the running app, matches the claims

Opened and visually inspected the two screenshots `AUDIT_v20_restart.md` §5/§10 cite:
- `finding_p12_test6_only_mode_paused_standalone_vanishes.png` (the "before" defect state): shows a live
  Home screen with the "MORNING MEDS" grouped card correctly reading "OnlyPausedGrouped — Paused" — and
  **no standalone card at all** for the equivalent `'only'`-mode-paused medication in the Quick Log
  section above it. Exactly what the finding claims.
- `finding_p12b_FIXED_only_mode_paused_standalone_shows_paused.png` (the "after" fix state): the same
  layout now additionally shows a standalone "OnlyPausedStandalone — Paused" card in the Quick Log
  section, alongside the still-correct grouped card. Exactly what the fix re-verification claims.

These are genuine before/after screenshots of the real running build — not fabricated or reused: my own
independent T3 run (different seed data, different medication name, different session) produced a
visually consistent third screenshot showing the same fixed layout **plus** the "Still pausing...?"
daily check-in banner rendering correctly above it, which is additional evidence this is a live,
stateful application response, not a static mock.

## 5. FOUND (process/scope notes for the PM gate — not code defects)

- **N1 — uncommitted working tree.** `git status` shows `index.html`, `sw.js`, and `README.md` modified
  but not committed on top of the last pushed commit (`4ba3beb`, a docs-only commit for the
  schedule-window Dev Brief); the actual v20 restart code changes, plus all the v20/v20-restart chain
  reports and screenshots, are untracked/uncommitted. This is the same class of note
  `LEAD_AUDITOR_SIGNOFF_v17.md` flagged as N1 for that release — not a defect, but the PM gate's
  "confirm files pushed" checklist item (`TEAM.md` §8) will fail until this is committed and pushed.
- **N2 — README's `app-v20` row does not yet describe the restart's fixes.** The existing row
  (`README.md:14`) documents only the three original features (pause, excluded-window, schedule-window
  picker) as originally shipped; it does not mention P1-1, P1-2, P1-2-B, P2-1, or the
  `loadMedicationConfig()` empty-list fix found during the Lead Developer's verification. Both audit
  reports explicitly and correctly note that version/`sw.js`/README bump is deliberately deferred to the
  final push once the whole chain clears (not a gap in this restart's process) — confirmed this is
  consistent with how `DESIGNER_REVIEW_v20_restart.md`/`LEAD_DESIGNER_SIGNOFF_v20_restart.md`/
  `QA_USER_ZERO_v20_restart.md` all treated the unchanged `app-v20` version string as expected, not an
  oversight. Flagging only so the PM gate's own version-discipline check knows to require a **rewritten**
  README row (not just confirmation one exists) before this ships.
- **N3 — History "N doses" miscount (QA's new finding) is correctly out of scope but should not be
  silently forgotten.** `QA_USER_ZERO_v20_restart.md` found `renderHistory()` (`index.html:3723`)
  over-counts non-medication entry types (Blood Pressure, Bowel Movement, Appetite, Symptom) as "doses."
  Confirmed via code read this is genuinely untouched by the restart's diff and does not touch any
  dose-ceiling/gap-timer/missed-dose safety math (those all key off `entriesFor(specificMedId)`, not this
  summary line) — correctly non-blocking per QA's own assessment. Not a Lead Auditor finding; flagging
  only so the PM gate carries it forward as a known, named item for a future Developer brief rather than
  letting it evaporate between chain stages.

No new P0/P1/P2 code defect found. No exaggerated or understated severity found anywhere in either
`AUDIT_v20.md` or `AUDIT_v20_restart.md`.

## 6. STILL OPEN (carried forward from the audit chain, correctly ranked)

- **P3 (id-suffix collision, `AUDIT_v20_restart.md` §6)** — re-confirmed still reproduces per that
  report's own §10 test 5; I did not re-run this myself (it requires a deliberately-contrived
  duplicate-name setup unrelated to the safety-critical paths this review prioritized re-testing), but
  its severity ranking (low, narrow, requires a user to have created two same-named medications, does not
  affect the ordinary single-medication delete/re-add case) is consistent with everything else I verified
  about `nextMedicationId`/`saveMedicationEditor`'s archive-match lookup in §2 above. Correctly flagged as
  a known, accepted, deferred gap — not a blocker.
- **History "N doses" miscount (N3 above)** — real, not blocking, needs its own future Developer brief.
- **N1/N2 above** — process items for the PM gate, not code defects.

## Sign-off

**Both Auditors' work: PASS.** I independently reproduced the four safety-critical findings/fixes
(P1-1 exact repro, P1-2 original combination, P1-2-B the restart's own new finding, P2-1 desync
self-heal) through real UI interaction — a different, arguably stricter mechanism than either audit
script used — and found no discrepancy. I read every cited code location directly against the served
file and found it matches both reports' descriptions exactly. I closed three specific coverage questions
(grouped-card independence for the `'only'`+paused combination, `reorderableHomeMeds()`'s filter shape,
and the archived-restore mechanism's behavior mid-first-run-tour) that neither audit pass nor QA had
fully exercised, and found no defect in any of the three. I confirmed the cited screenshots are real,
on disk, and show exactly what both reports claim, and independently produced a consistent third
screenshot of my own. I confirmed no scope drift against the original two Dev Briefs' explicit
requirements (the Meds-tab manager list's "must not hide anything" requirement is honored via the
Paused/Excluded/Treatment-day badges, confirmed present in source and reachable regardless of any
other filter in the file).

**Clear to proceed to stage 8 (Project Manager)**, with three items the PM gate must account for:
N1 (uncommitted working tree — blocks the "files pushed" checklist item until committed), N2 (the
`app-v20` README row needs to be rewritten to describe the restart's fixes before final push, not just
confirmed to exist), and N3 (the History "N doses" miscount — real, non-blocking, needs a named
follow-up Developer brief so it isn't lost between releases). The P3 id-suffix-collision gap remains
correctly carried forward as a known, deferred, non-blocking item per the restart audit's own
recommendation.
