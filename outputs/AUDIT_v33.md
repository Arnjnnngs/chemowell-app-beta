# AUDIT — ChemoWell v33 (APP BETA)

Auditor: Quality Chain (adversarial, independent). Date: 2026-08-02.
Scope: line-by-line audit of the v33 diff (`git diff` HEAD→working tree, 461 lines in index.html + sw.js + README)
and end-to-end runtime journeys on the live build at `http://localhost:8913/index.html`.
Method: source read of every changed surface + 4 Playwright batches (33 automated journey checks) at 390×844,
Chromium `/opt/pw-browsers/chromium`. Scripts: `/tmp/audit_v33_a.mjs` (radiation), `_b.mjs` (CSV/XSS/male-gate),
`_b2.mjs` (male-gate scoped), `_c.mjs` (erase/reload/switch), `_d.mjs` (focus retention).

## VERDICT: **FAIL** — 1 Major (CSV formula injection in the doctor-facing export). 0 Critical. 3 Minor. Info below.

The v33 feature set is well-built and the prior stages' scope (design, first-run UX, radiation flows) holds up under
adversarial retesting — gating, derived numbering, migration, profile isolation, and print-report XSS are all correct.
The one blocking defect is a code/security issue outside the design & QA lanes: the free CSV export, explicitly sold
"for doctor visits," writes user free-text into spreadsheet cells without neutralizing formula-injection payloads.

---

## MAJOR

### M1 — CSV export is vulnerable to spreadsheet formula (CSV) injection; unmitigated in a doctor-facing medical export
**Location:** `csvField()` index.html:4768; note/detail columns built in `buildExportRows()` index.html:4772-4791;
emitted by `downloadEntriesCSV()` 4792-4806.
**Defect:** `csvField(v)` only wraps a value in quotes when it contains `"`, `,`, `\n`, or `\r`. It never neutralizes a
value that *begins* with a spreadsheet formula trigger (`=`, `+`, `-`, `@`, and tab/CR). Any note, symptom note, or
other free-text field the patient/caregiver typed is exported verbatim into the `Note`/`Detail` column. When the file
is opened in Excel or Google Sheets — the stated use case ("ready for doctor visits", renderExportSection 4796) — a
cell beginning with `=` is evaluated as a formula.
**Reproduction (confirmed live, `/tmp/audit_v33_b.mjs`):** logged two symptom entries with notes `=2+2` and
`@cmd|' /C calc'!A0`, exported CSV from Settings → the raw payloads appear unquoted/unprefixed in the file
(`...,=2+2` and `...,@cmd|' /C calc'!A0`). Both checks FAILED (payload exported un-neutralized).
**Failure scenario:** (a) **Data integrity** — a legitimate note like `-3 lbs overnight`, `+1 episode`, or `=> worse
after dose` renders in the doctor's spreadsheet as `#NAME?`/a wrong number instead of the actual text, silently
corrupting the medical record the export exists to communicate. (b) **Security** — a crafted `=`/`@`-prefixed cell can
trigger DDE/command execution or data exfiltration formulas in Excel; classic OWASP CSV Injection on a health-data
export the brief explicitly flagged as a real attack surface.
**Fix (one line):** in `csvField`, before quoting, prefix any value matching `/^[=+\-@\t\r]/` with a leading apostrophe
(or a space): `if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;`. Then apply the existing quote/escape rule. The printable
report (openPrintReport) is NOT affected — HTML doesn't evaluate formulas, and its escaping is correct (see Info I2).

---

## MINOR

### m1 — The "+" backdate path has no same-day guard, unlike the quick "Log today's session" button
**Location:** quick button guards on `radiationSessionToday(now)` (renderToday 3436-3440 → button hidden, replaced by
the "✓ logged today" pill); the "+" modal (`timeModal.type:'radiation'`, save at confirmTimeAndLog 1270-1276) writes
unconditionally with no same-day check.
**Reproduction (confirmed, `/tmp/audit_v33_a.mjs` J3):** with today already logged, tap "+", accept the default (now),
Confirm → a **second** same-day `radiation_session` is created with no warning (card advances to "Session 2").
**Assessment:** derived numbering absorbs it gracefully (no stale numbers, delete renumbers), and backdating a
forgotten session is the "+" button's purpose — so this is defensible by design. But radiation is one fraction/day;
a user reaching for "+" to add yesterday can silently double-count today and inflate "N of M". Worth a same-day
"already logged today — add anyway?" confirm on the radiation save branch, mirroring the quick-button guard.

### m2 — Planned-total silently rejects out-of-range input with zero feedback
**Location:** `radiationPlannedTotal()` 1322 and the input's onChange 3330 both apply `!isNaN && >0 && <=99`, storing
`null` otherwise.
**Reproduction (confirmed, J5):** typing `0`, `-5`, or `999` stores `null`; the input just blanks to the `—`
placeholder with no message. A user who types `999` (or a real course of, say, `33` fat-fingered to `333`) gets no
explanation for why their number vanished. Minor UX gap; the clamp itself is correct.

### m3 — Backdated radiation sessions have no lower time bound
**Location:** confirmTimeAndLog radiation branch 1270-1276; shared ts validation 1135-1140 only guards the *future*
(`ts > simNow()+60000`), nothing guards the deep past.
**Reproduction (confirmed, J4):** backdated a session 3 months out with no friction; the code path equally accepts a
date 5 years ago. Low impact (corrections-only entry type), but there is no sanity floor, so a mis-set calendar year
lands a session in 2021 and skews the "first session" date in the report/print header.

---

## INFO / verified-safe (adversarial probes that did NOT find a defect)

- **I1 — Double-tap "Log today's session" is safe for real users.** Two trusted rapid clicks and a native dblclick
  each produce exactly **1** entry (`/tmp/dbg_dtap.mjs`): after the first click the button is replaced by the
  "✓ logged today" pill, so the second real tap lands on inert markup. Two entries appear *only* when a captured
  stale DOM node is re-dispatched synthetically (not reachable by a user). Not a defect.
- **I2 — Print report (Plus) XSS is properly escaped.** With patient name `<img src=x onerror=...>`, a skin-reaction
  `site` containing `"><script>...`, and a note `<img onerror=...>`, the opened popup had **0** injected `<img>`,
  **0** injected `<script>`, and the title/`<h1>` rendered the payload as inert text (`/tmp/audit_v33_b.mjs`).
  `escHtml` (4802) escapes `& < >`, and every user-data interpolation in `openPrintReport` (title, h1, meta, table
  cells, day headers) is a **text-node** context — no user data lands in an HTML attribute, so quote-escaping is not
  required. Correct.
- **I3 — Female/male cycle gating and radiation-only chemo gating are fully correct** across Home, Reports menu, and
  Settings for both a Male+Chemo and Female+Both profile (`/tmp/audit_v33_b2.mjs`, scoped to `#root`). A male profile
  with pre-existing `cycle_start`/`cycle_end` entries shows **no** cycle UI anywhere and does not crash; the orphaned
  entries are **preserved in the CSV export** (Period Start/End present). Note: History excludes cycle markers by
  pre-existing design (dmap filter 5041), so on a male profile those entries are viewable only via export — acceptable,
  data is not lost.
- **I4 — 30/30 and 31/30 states render correctly.** Seeded 29 + 1 live → "Session 30 of 30 — course complete";
  a 31st via backdate → "Session 31 of 30", report "31 / 30 sessions completed 🎉", progress bar capped at 100%
  (no width >100%). Derived numbering + `radIds` map are collision-free (ids are `'e'+Date.now()+6 random base36`,
  addEntryDB 191). (`/tmp/audit_v33_a.mjs`.)
- **I5 — Future-date guard works for radiation.** The "+" modal shares confirmTimeAndLog's futureOk arm-then-confirm
  (1135-1140): a future date shows "⚠ This time is in the future. Press Confirm again…" on first Confirm and only
  logs on the armed second Confirm — same as every other time-modal type.
- **I6 — Profile switching has no gating bleed-through.** Female+Both → add Male+Chemo (Plus) → switch back: Alice's
  radiation card returns, no period bleed (`/tmp/dbg_switch.mjs`). `createProfile` seeds `pendingName` (137-152); the
  new profile routes into setup with the name **prefilled** (subscribePrefs 5712-5714) and `pendingName` is cleared in
  the single `setPrefsDB` at completeSetup (2280-2289). No leak into another profile's setup (every switch/create
  path `location.reload()`s, resetting `setupNameDraft`).
- **I7 — Account cross-profile reads are read-only and crash-safe.** `profilePrefsFor`/`profileEntryCountFor`
  (4770-4772) use `loadJSON(...,{}/[])`; a profiles-list entry with a missing prefs key renders "Not set · 0 entries"
  with no throw. No write path touches another profile's keys.
- **I8 — Migration card** writes `setPrefsDB({sex,treatmentType})` merging over existing prefs (patientName preserved);
  `needsProfileCompletion` (1329) requires patientName truthy, so a profile lacking a name goes through the full setup
  screen instead (render gate 2508), not the card — consistent, no half-set state.
- **I9 — completeSetup is a single `setPrefsDB` call** (2285) writing name+sex+treatment+`pendingName:null` atomically;
  subscribePrefs (5711) can't paint a half-set shell (render gate watches patientName, which is written last-in-one).
- **I10 — Erase-all returns to the new 3-question welcome** (name input + Male/Female + Chemo/Radiation/Both chips)
  and a clean second run completes to the app shell (`/tmp/audit_v33_c.mjs`). Reload after logging a session persists
  exactly 1 entry.
- **I11 — Tick-guard membership OK.** The planned-total number input keeps focus and its mid-type draft through 2s of
  ticks and commits on blur (`/tmp/audit_v33_d.mjs`); it's covered by the existing `isEditing` guard (5732). The
  migration-card chips and Account add-input are buttons / module-level-draft inputs (`newProfileNameDraft`,
  `migrateSexDraft`/`migrateTreatDraft`), so ticks never discard them. `state.timeModal` covers the radiation backdate
  sheet for free.
- **I12 — Release mechanics intact.** `APP_VERSION='app-v33'` (4633), `sw.js` `CACHE='chemowell-app-v33'`, README
  version row added, `TEST_MODE=true` (54). No `console.log`/`debugger`/new `TODO` introduced by the diff (the only
  TODO is the pre-existing support-link placeholder, line 65). Support banner stays inert-gated (v29_gate DOM
  assertions pass; the two failing/timeout checks in the old v29 suites are harness artifacts — they require a
  temporary stand-in "ready" link and module-scope access that `page.evaluate` can't reach — not v33 regressions).
- **I13 — v33 regression suites pass:** `/tmp/verify_v33.mjs` 56/56 and `/tmp/verify_v33_support.mjs` 21/21, zero
  console errors.

## Automated tally
Batch A (radiation) 18/1 — the 1 "fail" is the synthetic stale-node double-dispatch (I1), not a user-reachable defect.
Batch B (CSV/XSS) — the 2 CSV "fails" are M1; the 1 XSS-title "fail" was a test false-positive (payload text contains
the literal string "NAME-XSS"; DOM confirms no execution, see I2); male-gate "fails" were `body.textContent`
including the inline `<script>` source, corrected in Batch B2 (8/8 after scoping to `#root`). Batch C 17/1 (the 1 is
expected view-persistence, not a bug — I6). Batch D 4/4.

**Net real defects: 1 Major (M1), 3 Minor (m1–m3).** Verdict **FAIL** on M1.
