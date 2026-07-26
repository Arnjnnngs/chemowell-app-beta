# LEAD_AUDITOR_SIGNOFF_v17 — review of AUDIT_v17 (tour banner/target green attention treatment)

Role: Lead Auditor (Quality Chain stage 7) · Date: 2026-07-26 · Build under review: app-v17
Basis: `outputs/AUDIT_v17.md`, the full upstream chain (`DEV_BRIEF_v17.md`, `DESIGNER_REVIEW_v17.md`
incl. its RE-VERIFICATION section, `LEAD_DESIGNER_SIGNOFF_v17.md`, `QA_USER_ZERO_v17.md`), the current
working tree (`git diff bc52fd4` for `index.html`/`sw.js`/`README.md`), and my own live runs against
`http://localhost:8917/index.html` (Playwright/Chromium, hasTouch/isMobile context, 390×844). **No code
was modified.** My script: `/tmp/lead_audit_v17.mjs` (written from scratch, not adapted from the
Auditor's `/tmp/audit_v17.mjs`).

## Verdict on the Auditor's work: **PASS**

The audit is real and accurate. Every claim I independently reproduced held, using a deliberately
different script, tap mechanism, and sampling strategy than the Auditor used. I found no false positive
and no false negative in `AUDIT_v17.md`. The screenshots the upstream chain cites are real, on disk, and
show what they claim. One informational note below (not a defect) plus confirmation that the
"Blood-Pressure crash is out of scope" claim is actually true, not just asserted.

---

## 1. CHECKED — Auditor's 7 live journeys, 5 independently reproduced (4 required)

I wrote my own Playwright script with different mechanics than the Auditor's to make a false negative
more likely to surface if one existed: raw `dispatchEvent` races instead of `Promise.all(tap, tap)`,
extra intermediate nav taps, a discard-with-partial-form-fill variant, a **double** reload instead of
one, and an ON→OFF→ON reduced-motion sequence instead of a single toggle.

| Auditor's journey | My independent variant | Result |
|---|---|---|
| Double-tap "?" tour restart | Two raw `dispatchEvent(new MouseEvent('click'))` calls on the same tick (harder race than two Playwright taps) | **PASS** — exactly one `#tour-layer`/`#tour-card`/`#tour-banner`, label reads `1/10` |
| Navigate-away-mid-tour | Tapped **three** non-target nav tabs in sequence (`nav-reports` → `nav-symptoms` → `nav-home`) before checking, not one | **PASS** — tour step unchanged (`2/10` before and after), `nav-meds` highlight still `outlineColor` in-range and `animationName: tourPulse` |
| Tour step-back on discarded med editor | Filled a name field (`PartialName`) before tapping Discard, to check `backOn: 'medEditor:closed'` under a "user did real work" condition, not just an empty-editor discard | **PASS** — editor gone, step went `4/10 → 3/10`, `window.__tourHighlighted` correctly re-points at `meds-add` |
| Reload-mid-tour | Reloaded **twice** in a row, then took two `getComputedStyle` samples 400ms apart to confirm the pulse is genuinely animating post-reload (not just present) | **PASS** — step persisted (`3/10` before/after both reloads), outline alpha differed between the two 400ms-apart samples, confirming live animation, not a frozen frame |
| Live reduced-motion toggle, no reload | Toggled reduced-motion **ON → OFF → ON** (not just ON) mid-tour, 1.3s dwell each | **PASS** — `tourPulse → none → tourPulse → none`, tracking every transition correctly with no reload |

All 5 reproduce as PASS, matching the Auditor's report exactly — no discrepancy found. (I did not
re-run the rapid-viewport-resize or missing-target-in-DOM journeys myself; the Auditor's evidence for
those was internally consistent with the rest of their report and with the code I read directly in §3
below, and 5/7 independently reproduced from scratch is well past this stage's bar.)

I also ran one journey of my own, outside the Auditor's 7, as a coverage probe (see §3): confirming
`checkNotifications()` doesn't disturb an active tour highlight. My script couldn't call it directly
(it's module-scoped, not exposed on `window` — the same limitation the Auditor's report notes for
`state`), so I fell back to source verification instead (§3), which is conclusive on its own.

## 2. CHECKED — README.md fix, cross-checked against what actually shipped

`README.md`'s version-history table now has an `app-v17` row (top row, 2026-07-26) — confirmed via
direct read, not `grep -c` alone. I cross-checked its prose claims against the actual diff rather than
trusting the text:

- **"green (`#2E7D4F`)... replacing the old translucent rose"** — confirmed in source (`index.html:33`,
  `1815-1816`) and live (`getComputedStyle`).
- **"phase-synced negative `animation-delay`... `Date.now()`... resumes mid-cycle"** — confirmed:
  `tourPulseDelay()` uses `Date.now()`, not `state.now`/`simNow()`.
- **"pulse's contrast floor (0.3 alpha)... raised to 0.75"** — confirmed via `git diff bc52fd4 --
  index.html`: line 33's keyframe literally reads `0%{...1}50%{...0.75}100%{...1}` in the working tree
  now, vs. `0.3` in the first WIP commit (`1f90479`). The README's stated before/after values are
  byte-accurate to the actual code change, not a paraphrase.
- **"`prefers-reduced-motion` didn't actually stop the glow... JS-level check"** — confirmed:
  `prefersReducedMotion()` (new function, uncommitted-but-present in the working tree) is called from
  both `tourGlowAnim()` and `applyTourHighlight()`, exactly as described.
- **"QA independently found... Reports → Blood Pressure crashes"** — confirmed present and accurately
  summarized (see §4).

No drift between the README's claims and reality. I additionally confirmed via `git diff bc52fd4 --
index.html` that the **entire** code diff for this release touches exactly three regions: line 30
(keyframes comment context)/33 (the `tourPulse` keyframe), lines ~1776–1900 (the tour subsystem), and
line 3174 (`APP_VERSION`) — 50 insertions, 9 deletions, nothing else in the file changed. This
independently confirms the Auditor's "blast radius clean" claim at the diff level, not just by reading
the final state.

## 3. CHECKED — coverage probes outside the Auditor's stated scope

**`checkNotifications()` vs. the tour — fully independent, confirmed at the source level.** Read
`checkNotifications()` in full (`index.html:3855-3867`, now shifted a few lines by the uncommitted
diff): it references `TEST_MODE`, `isNativeApp()`, `Notification`, `state.loaded`, `state.entries`,
`state.demo`, `resetNotifTracking()`, `dueRemindersAt()`, `sendNotif()` — **zero references** to
`state.tourStep`, `tourPulse`, `applyTourHighlight`, `tourClearHighlight`, `tourGlowAnim`,
`window.__tourHighlighted`, or any `data-tour` element. Grepped the whole file for any code path
connecting the two subsystems: none exists. My live attempt to call `checkNotifications()` from
`page.evaluate()` while a tour highlight was mid-pulse threw `checkNotifications is not defined`
because it's scoped inside the `<script type="module">` and never attached to `window` — this is not a
bug, it's the same module-privacy the Auditor's report already flags for `state`, and it is itself
confirming evidence that nothing outside the module (including any future code) can reach in and touch
tour internals through this function. Source-level independence is conclusive here even without a live
call succeeding.

**`data-tour="med-editor"` collision risk — checked, none found.** Grepped every `data-tour=` occurrence
in the file (4 total: `nav-*` dynamic, `meds-add`, `med-editor`, `quick-log`) and every
`[data-tour...]` selector anywhere in the file, CSS or JS: the **only** two readers are
`positionTour()`'s two `document.querySelector('[data-tour="' + step.target + '"]')` calls
(`index.html:1878`, `1884`). No CSS rule in the `<style>` block targets `[data-tour]`. No other JS
function queries by that attribute. The medication editor's save path (`saveMedicationEditor`, its
button, its form fields) has no knowledge of the `data-tour` attribute at all — it's inert metadata on
the enclosing `<section>` as far as the save logic is concerned. No collision, direct or indirect.

**Every `.style.outline`/`.style.animation` writer in the file — checked, only one owner.** Grepped the
whole file: the only four inline `.style.outline*`/`.style.animation*` writes are
`tourClearHighlight()`'s reset (2 lines) and `applyTourHighlight()`'s set (2-4 lines depending on
reduced-motion branch) — a single matched reader/writer pair, exactly as the Auditor's report states.
The only other `outline:`/`outline-offset:` in the whole file are the pre-existing, untouched
stylesheet rules for `input:focus` and `:focus-visible` (`index.html:27-28`) — genuinely unrelated
(keyboard focus indicators, not tour state) and non-conflicting: an inline `el.style.outline` always
wins the cascade over any stylesheet selector regardless of specificity, so a focused element that also
happens to be the tour target would show the tour's outline, not fight over it. Confirmed `tourPulse`
is still the file's only `@keyframes … infinite` rule.

## 4. CHECKED — the Blood Pressure crash really is out of scope for v17, not just asserted

I did not re-audit the bug itself (per instructions), only whether it's genuinely disconnected from this
release's diff:

- `git show bc52fd4:index.html | grep -n "function renderBloodPressureReport"` → present at v16,
  **before** this release's work started.
- `git diff bc52fd4 1f90479 -- index.html | grep -n "BloodPressure\|renderReportDetail"` → **zero
  matches**. The v16→v17 diff touches nothing in `renderBloodPressureReport()` or `renderReportDetail()`.
- Read `renderBloodPressureReport()` (`index.html:3278-3291`) directly: it references `state.entries`,
  `removeEntryDB`, `fmtTime` — no `state.tourStep`, no tour function, no shared mutable state with
  anything this release touched.
- The crash mechanism itself (single DOM node returned instead of an array, then spread with `...content`
  in `renderReportDetail`) is a pre-existing structural bug unrelated to styling/animation in any way.

**Confirmed: genuinely pre-existing, genuinely out of scope for the tour/highlight diff, not merely
asserted by the audit.**

## 5. CHECKED — screenshot evidence is real, from the running app, not a thought experiment

Confirmed file existence and non-trivial sizes on disk (not placeholders): `outputs/v17-screenshots/`
(80 PNGs) and `outputs/v17-screenshots/qa/` (85 PNGs, including the 7 `BUG-bp-*` files). Opened and
visually inspected 4:

- `w390-11a-navmeds-pulse-PEAK-alpha0.95.png` vs. `w390-11b-navmeds-pulse-TROUGH-alpha0.33.png` — these
  are real, and they show exactly what `DESIGNER_REVIEW_v17.md` Item 2 claims: a bold, saturated green
  ring around the Meds tab at peak, and a washed-out pale-sage ring that's genuinely hard to see against
  the white nav bar at trough. This is not something you'd get from a mocked-up or copy-pasted
  screenshot — it's a real before/after of the pre-fix contrast problem.
- `qa/037-report-blood-pressure.png` — shows the Reports **hub** (menu of report tiles, Blood Pressure
  tile visible with "No readings yet"), not a crash screen — consistent with the QA report's own
  description that the tap produces **zero visible navigation**, so a screenshot taken at that moment
  legitimately looks like the untouched hub.
- `qa/BUG-bp-02-after-tap-empty-state.png` — taken from a fresh "BugRepro" profile, still showing the
  Reports hub after a real tap on the Blood Pressure tile (header reads "BugRepro's Meds," Reports tab
  active), with a "Welcome to ChemoWell" toast overlapping the Bowel Movement card — this independently
  corroborates **two** separate QA claims in one image: the silent no-op crash (Part 4) and the unrelated
  toast-overlap observation (Part 8).
- `qa/049-tour-replay-step1-navmeds.png` — real screenshot of the "?" replay flow: green double-ring
  banner reading "GUIDE · 2 OF 10 / Tap Meds at the bottom of the screen," green ring around the Meds
  tab. Matches the QA report's tour-replay claim and also visibly corroborates the still-open, non-
  blocking double-ring aesthetic note (P3-1) from an entirely different angle than the Designer's own
  screenshots.

All four screenshots show exactly what their respective reports claim. This evidence came from a
running build, not a description of one.

---

## 6. FOUND (new, informational only — does not block)

- **N1:** The working tree currently has the Item 2/Item 4 pulse fixes, the `APP_VERSION` bump, the
  `sw.js` cache bump, and the README row all as **uncommitted** changes on top of the `1f90479` "WIP
  app-v17" commit. Nothing is lost or inconsistent — I verified via `git diff` that the uncommitted
  state matches every claim in `DESIGNER_REVIEW_v17.md`'s RE-VERIFICATION section and `AUDIT_v17.md`
  exactly — but this is worth flagging for whoever runs the PM gate next: the release isn't committed
  yet, so "confirm files pushed" (a PM-gate checklist item per `TEAM.md` §8) will currently fail until a
  commit happens. Not a code defect, a process-sequencing note.

No new P0/P1/P2 found. No exaggerated or understated severity found anywhere in `AUDIT_v17.md`.

## 7. STILL OPEN (carried forward, correctly ranked)

- **P2-1 (Auditor's finding): README app-v17 row — now RESOLVED**, verified in §2 above (was open when
  the Auditor filed it; fixed since).
- **P3-1: double-ring banner/card aesthetic** — non-blocking, re-confirmed visually in my own screenshot
  review (§5, `049-tour-replay-step1-navmeds.png`). Queued polish, correctly not blocking.
- **P3-2: "med-manager Active badge" doc mislabel** — doc-only, no code defect, correctly not blocking.
- **Separately tracked, not this audit's scope: Reports → Blood Pressure crash** — confirmed genuinely
  unrelated to the v17 diff (§4). Still an open HIGH-severity item per `QA_USER_ZERO_v17.md` that must
  be fixed before this release closes out, per the chain's fail-fast rule.
- **N1 above:** uncommitted working tree — needs a commit + push before the PM gate's "files pushed"
  check can pass.

## Sign-off

**Auditor's work: PASS.** Findings are real and correctly severity-ranked — I reproduced 5 of the 7
claimed live journeys independently from scratch with a different script and found identical results
(no false positives, no false negatives), verified the README fix is both present and factually accurate
against the real diff, probed three coverage gaps outside the Auditor's stated scope
(`checkNotifications()` independence, `data-tour` collision risk, every `.style.outline`/`.style.animation`
writer in the file) and found the code clean on all three, confirmed the Blood-Pressure crash is
genuinely pre-existing and outside this diff's blast radius (not just asserted), and confirmed the
screenshot evidence cited by both QA and the Designer is real, on disk, and shows what it claims.

**Clear to proceed to stage 8 (Project Manager)**, with two items the PM gate must account for: the
still-open, separately-tracked Blood Pressure crash (HIGH, blocks release closure per fail-fast), and the
uncommitted working tree (N1, process step, not a defect).
