> **UPDATE (same day, post-initial-verdict):** the §5 finding below (P1-2-B: standalone `'only'`-mode
> + paused + outside-window card vanishing) was fixed by the Lead Developer and independently
> re-verified live — see §10. **Updated verdict: CLEARED to proceed to the Lead Auditor.** The
> original §5 write-up is left intact below for the record (repro, root cause, screenshot), with §10
> appended on top documenting the fix and its re-verification. §6 (P3, id-suffix collision) remains
> open and deferred, unchanged, per the original recommendation — no fix was attempted for it and none
> was expected.

# AUDIT_v20_restart — Re-verification of AUDIT_v20's P1-1/P1-2/P2-1 fix pass

Role: Auditor (Quality Chain stage 6) · Date: 2026-07-27 · Build under audit: app-v20 restart
(`const APP_VERSION = 'app-v20'`, `index.html:3531` — unchanged version string, consistent with how
`DESIGNER_REVIEW_v20_restart.md`/`LEAD_DESIGNER_SIGNOFF_v20_restart.md`/`QA_USER_ZERO_v20_restart.md`
have all treated this as a restart pass on the same numbered release, not a new one; version/`sw.js`
cache/README bump is expected at final push once the whole chain clears, not before).

Method: independent adversarial pass, re-derived from scratch against the CURRENT `index.html` — did
not reuse `/tmp/audit_v20.mjs`'s assumptions, only its harness conventions (Playwright + Chromium,
`serviceWorkers: 'block'`, fake-clock `Date` shim via `window.__fakeNow`, fresh `localStorage` per
scenario, 390×844 primary viewport). New script: `/tmp/audit_v20_restart.mjs` (28 live-browser
assertions, 27/28 passing — the 1 failure is the finding below, independently re-confirmed with a
screenshot). One methodology note surfaced and fixed mid-run, documented in full below since it
initially produced false results: `page.textContent('body')` includes the literal text content of the
`<script type="module">` tag (which sits inside `<body>`, per `index.html:37-40`), so any check that
`.includes()`-matched against full body text could accidentally match JS source (variable names,
comments, string literals in code) instead of actually-rendered UI — this produced 2 false failures and
masked how thoroughly the harness needed scoping. Fixed by scoping every check to `#root`
(`index.html:38`, the actual mount point, `index.html:1744`) instead of `body`; all 28 checks were
re-run clean after the fix and every result below reflects the corrected, `#root`-scoped run.

Reviewed upstream chain artifacts in full first: `AUDIT_v20.md` (this audit's own prior pass),
`DEV_BRIEF_v20_restart.md`, `DESIGNER_REVIEW_v20_restart.md`, `LEAD_DESIGNER_SIGNOFF_v20_restart.md`,
`QA_USER_ZERO_v20_restart.md` (all clean/PASS per their own scope, confirmed by grep that none of them
constructed the specific combination this audit's one finding below depends on).

---

## 1. Verdict up front (original, pre-fix — see §10 for the updated post-fix verdict)

**NOT cleared to proceed to the Lead Auditor, as of this section's original writing.** 27 of 28 live checks pass, including a full
independent re-verification of the original P1-1, P1-2, and P2-1 findings and a from-scratch
adversarial probe of the new `loadMedicationConfig()` fix (all clean, see §2-§4). But one live,
reachable, MAJOR-severity defect survives: **a standalone Quick Log card for a `treatmentMode:'only'`
medication that is both paused and outside its treatment window still vanishes entirely instead of
showing "Paused," the exact same defect class as the original P1-2, just for the sibling treatment
mode** (§5, P1-2-B below). This is precisely `DEV_BRIEF_v20_restart.md`'s own P1-2 "Test scenario 6" —
listed explicitly in that brief's test matrix and in its "Definition of done" checklist — and it was
never actually run: neither `DESIGNER_REVIEW_v20_restart.md` nor `QA_USER_ZERO_v20_restart.md` built
an `'only'`-mode-and-paused medication (both restart-review artifacts, read in full, only ever
construct `'excluded'`-mode-and-paused test medications — grepped for "only" + "paus" together, zero
matches in either file). The Dev Brief's own text asserted this combination "should already make this
correct" based on the `.map()`'s paused-first ordering — that reasoning holds for the grouped card
(confirmed, still correct) but not for the standalone card, where the `treatmentOnly`-outside-window
clause was deliberately left in the upstream `.filter()` and never reconsidered for the paused case.

One additional, narrower, non-blocking finding (P3) is reported in §6: the P1-1 fix's archive-and-
restore mechanism is keyed on the medication's *derived* id, which can point at the wrong archived
entry (or none) when two medications have historically shared the same name and one was assigned a
numeric-suffixed id — a real gap, but requiring a deliberately-contrived setup, not the ordinary
"delete and re-add" action the original P1-1 was about.

---

## 2. P1-1 re-verification — CONFIRMED FIXED (full Dev Brief test matrix, live)

All 9 numbered test scenarios from `DEV_BRIEF_v20_restart.md`'s P1-1 section were re-derived and run
live against the current code (not reused from any prior script). Results:

| # | Scenario | Result |
|---|---|---|
| 1 | Audit's exact repro: scheduled med, genuinely-missed days before an OPEN pause period, delete, re-add same name | **PASS** — header count identical before (10) and after (10); restored `pausePeriods` matches exactly |
| 2 | Delete with an already-CLOSED pause period | **PASS** — start & end both preserved exactly |
| 3 | Delete WHILE actively paused (open period), re-add weeks later | **PASS** — archived period is closed at the deletion timestamp (`end` stamped, not left `null`); a medication re-added 21 simulated days later is `paused:false`, not eternally paused |
| 4 | Full page RELOAD between delete and re-add (forces `normalizeArchivedMeds` to actually run from `localStorage`) | **PASS** — restore still fires post-reload |
| 5 | Medication that was never paused | **PASS** — delete+re-add is byte-identical to a fresh add (`pausePeriods:[]`, `paused:false`) |
| 6 | Two round-trips (delete→re-add→pause→resume→delete→re-add) | **PASS** — periods accumulate correctly (1 → 2 → 2, restored intact after the second round-trip), not truncated to the most recent |
| 7 | Differently-named re-add ("Naproxen" after deleting "Ibuprofen") | **PASS** — no restore; `pausePeriods:[]`, confirming exact-id-match-only (no fuzzy name matching) |
| 8 | Multi-profile isolation (archived history on profile A, same-named add on profile B) | **PASS** — profile B's new medication gets `pausePeriods:[]`, does not inherit profile A's history |
| 9 | Dose-entries/ceiling cross-contamination under a recycled id — must be unchanged, not fixed/worsened | **PASS (confirmed unchanged)** — a medication deleted with a logged 200 mg dose, re-added under the same recycled id, still shows that old dose as its own "Last dose" on Home; this is the documented, explicitly out-of-scope, pre-existing gap the Dev Brief flagged, verified neither newly broken nor silently fixed |

Also re-verified `normalizeArchivedMeds` (`index.html:358-370`) and the shared `normalizePausePeriods`
helper (`index.html:280-282`) directly: both correctly round-trip a `pausePeriods` array through
`JSON.stringify`/`JSON.parse` and filter out anything with a non-finite `start`, matching the shared
validator's contract at both call sites (`normalizeMedication:339`, `normalizeArchivedMeds:367`,
`deleteMedicationConfig:3206`, `saveMedicationEditor:3121`) with no drift between them.

**Conclusion: P1-1 is fixed.** The original repro (missed-dose count reviving from 8 to 10 on a plain
delete+re-add) no longer reproduces under any of the 9 scenarios the Dev Brief specified, run live, not
assumed.

### New edge case found beyond the Dev Brief matrix — see §6 (P3, non-blocking)

---

## 3. P1-2 re-verification — the reported combination is fixed; the sibling combination is NOT (see §5)

Re-derived repro live: two `paused:true` + `treatmentMode:'excluded'` (currently inside an active
exclusion window) medications, one `quickLog:true` (standalone), one `groupedMorning:true` (grouped).

- **Standalone card now correctly shows "Paused"** (`ExclStandalone — Paused` / "Not tracked while
  paused. Resume anytime." / Resume button), matching the grouped row exactly. **PASS** — this is the
  audit's original E1/E3 repro, confirmed fixed.
- `treatmentMode:'excluded'`, active window, **not** paused, standalone — shows the new inert
  "Excluded near treatment day" row, not vanished, not crashed. **PASS**.
- `treatmentMode:'excluded'`, OUTSIDE its window (fully available) — renders as a completely normal,
  interactive card with a working Log button. **PASS**.
- `treatmentMode:'only'` (`treatmentOnly:true`), outside its window, **not** paused — standalone card
  **still vanishes entirely** (regression check: this is old, v16, deliberate, explicitly-untouched
  behavior per the Dev Brief — confirmed unchanged), grouped shows its existing inert
  "Outside its treatment-day window" row. **PASS** (no regression).
- Quick Log correctly includes the excluded-and-unpaused medication (no crash, no layout break).
  **PASS**.

**Code confirmed matching `DEV_BRIEF_v20_restart.md`'s described fix exactly:** `medCards`'s filter
(`index.html:2703`) now reads
`state.meds.filter(m => m.quickLog && (!m.treatmentOnly || (treatmentActiveOn(m, now) &&
!status(m).courseComplete)))` — the `treatmentExcludedNow` clause was removed from the filter and a new
branch was added inside the `.map()` at `index.html:2718-2727`, positioned after the `paused` branch
(`index.html:2704-2717`) and before `inpatientActiveNow` (`index.html:2728`), matching
`renderGroupedMedsCard`'s relative ordering exactly. The narrow, surgical fix the Dev Brief
recommended (only moving the `treatmentExcludedNow` clause, deliberately leaving the `treatmentOnly`
clause alone) was implemented precisely as specified — confirmed by diffing the actual filter/map
structure against the brief's proposed code, not just by re-running the original repro.

**But this narrow scope is exactly why §5's finding below survives:** the `treatmentOnly`
clause the Dev Brief explicitly chose not to touch is *also* upstream in the filter, and *also*
un-reachable-by-`paused` for the same structural reason `treatmentExcludedNow` was — the fix closed
one of the two clauses sharing this defect, not both.

---

## 4. P2-1 re-verification — CONFIRMED FIXED (H1/H2 plus 5 additional cases beyond the original pair)

`normalizeMedication` (`index.html:284-356`) now resolves `treatmentMode` once as a local
(`index.html:304-305`) and derives `treatmentOnly` from it (`index.html:328`:
`treatmentOnly: treatmentMode === 'only'`) instead of reading `original.treatmentOnly` independently —
confirmed to exactly match the Dev Brief's recommended fix, character for character.

| Case | Result |
|---|---|
| H1 (audit's original): `treatmentMode:'excluded'` + stale `treatmentOnly:true`, no treatment date logged | **PASS** — now fully visible (was incorrectly hidden pre-fix) |
| H2 (control): identical, `treatmentOnly` omitted | **PASS** — visible, unchanged |
| Inverse desync (new, not in the original H1/H2 pair): `treatmentMode:'only'` + stale `treatmentOnly:false`, outside window | **PASS** — now correctly HIDDEN (previously would have incorrectly stayed visible, since the pre-fix code trusted the stale `false` and never cross-checked `treatmentMode`) |
| v16-v19 legacy (`treatmentOnly:true`, no `treatmentMode` key at all) | **PASS** — normalizes to `only`-mode (confirmed via the Meds-tab "Treatment day −1/+1" badge, which reads the in-memory normalized `state.meds`, not `localStorage` — see methodology note below), hides outside window on Home, identical to pre-fix behavior |
| Pre-v16 legacy (`chemoOnly:true`, neither newer field present) | **PASS** — same as above, normalizes to `only`-mode via the default ±1-day window, identical to pre-fix behavior |
| New `'excluded'`-mode medication, saved through the real editor, then reloaded | **PASS** — `treatmentOnly:false`/`treatmentMode:'excluded'` stay correctly paired across a save+reload round-trip |

**Methodology note (important, and relevant to how future Auditor passes should test this function):**
`normalizeMedication` only normalizes **in memory** (`state.meds`, used for rendering) — it does **not**
rewrite `localStorage`. `persistMedicationConfig` (`index.html:419-427`) is only called by explicit
user actions (save/delete/pause), never automatically on load. So reading `localStorage` back
immediately after seeding raw/legacy data and reloading — which is what a first attempt at these two
legacy-migration checks did — just echoes the un-normalized seed and produces a false failure. The
correct way to observe `normalizeMedication`'s output without triggering a save is to read the
*rendered* UI (Home visibility, or the Meds-tab badge, both of which read `state.meds` directly) — which
is what the corrected checks above do, and is also incidentally a better test since it's what an actual
user would see.

**Conclusion: P2-1 is fixed**, and the fix is more robust than the original H1/H2 pair alone would
have proven — the inverse-desync direction and both legacy migration paths (neither in the original
audit's test set) all confirm the fix generalizes correctly, not just for the one specific state H1
happened to test.

---

## 5. NEW FINDING — P1 (Major): standalone Quick Log card for a paused `'only'`-mode medication outside its window still vanishes instead of showing "Paused"

**This is the live-tested version of `DEV_BRIEF_v20_restart.md`'s own P1-2 "Test scenario 6"**, which
that brief listed explicitly ("worth explicitly checking since the fix's ordering ... should already
make this correct, but it wasn't in the audit's own test matrix") and which was never actually run by
any subsequent chain stage before this audit — confirmed by grep: neither
`DESIGNER_REVIEW_v20_restart.md` nor `QA_USER_ZERO_v20_restart.md` constructs a medication that is both
`treatmentMode:'only'` and `paused:true` (both restart-stage artifacts only ever test the
`'excluded'`-mode-and-paused combination, i.e. the audit's original E1/E3 repro).

**Reproduction (live, confirmed, screenshot attached):**
1. Create a scheduled medication as its own standalone Quick Log card (`quickLog:true`), with
   `treatmentMode:'only'` (the UI's "Only near treatment day" option) and a treatment date logged such
   that the medication is currently **outside** its treatment window (e.g. treatment date 20 days away,
   default ±1-day window) — under `'only'`-mode semantics this correctly means "not currently available,"
   the same as v16's original, unchanged, intentional behavior.
2. Pause the medication via the editor.
3. Load Home. **The medication is completely absent from the Quick Log section** — no card, no
   "Paused" label, no Resume button — identical to the exact defect class `AUDIT_v20.md`'s original
   P1-2 reported, just for `'only'`-mode instead of `'excluded'`-mode.
4. Place an identical medication (`'only'`-mode, paused, outside window) in a grouped card
   (`groupedMorning:true`) instead: it **correctly** shows "Paused" with an inline Resume button.

Screenshot: `outputs/v20-restart-audit-screenshots/finding_p12_test6_only_mode_paused_standalone_vanishes.png`
— shows a live Home screen with three seeded medications: a normal medication (visible, working card),
a grouped `'only'`-mode-paused medication ("OnlyPausedGrouped — Paused", correct), and a standalone
`'only'`-mode-paused medication that is **entirely missing from the Quick Log section** — not even an
inert row.

**Root cause:** `medCards`'s filter (`index.html:2703`) still reads:
```js
const medCards = state.meds.filter(m => m.quickLog
  && (!m.treatmentOnly || (treatmentActiveOn(m, now) && !status(m).courseComplete))).map(med => {
```
For a paused, `'only'`-mode, outside-window medication: `m.treatmentOnly` is `true` (correctly derived
by the now-fixed `normalizeMedication`, see §4), and `treatmentActiveOn(m, now)` is `false` (outside
window) — so `!m.treatmentOnly || (...)` evaluates to `false`, and the medication is removed from the
`medCards` array **before the `.map()`'s `if (med.paused)` branch (`index.html:2704`) is ever reached**.
`status(m).courseComplete` doesn't rescue this either: `status()` short-circuits for a paused medication
at `index.html:832` (`if (med.paused) return { locked: true, paused: true };`), so `courseComplete` is
always `undefined`/falsy for a paused med — it can't make the OR true, only the (already-false)
`treatmentActiveOn` half could, and it's false by construction in this scenario.

This is **structurally identical** to the original P1-2's root cause: a medication-visibility guard sits
in the upstream `.filter()`, architecturally outside the `.map()`'s paused-first ordering, so `paused`
cannot "win" for a case the filter has already removed. The restart's fix closed this gap for
`treatmentExcludedNow` (moved into the `.map()`, correctly ordered after `paused`) but the sibling
`treatmentOnly`-outside-window clause was deliberately left in the filter — a reasonable, explicitly-
documented scope decision at the time (avoiding an unreviewed UX change to `'only'`-mode's 13-release-old
vanish-outside-window behavior) — but that decision was never re-examined against the specific
paused-and-outside-window sub-case, where "vanish" and "should show Paused" are now in direct conflict
for exactly the reason the original P1-2 existed.

`renderGroupedMedsCard` does not have this problem: its equivalent check
(`index.html:1666`: `if ((med.treatmentOnly && !treatmentActiveOn(med, now)) || treatmentExcludedNow(med, now))`)
lives entirely inside the `.map()` over the full `meds` array (`index.html:1652`), after the `paused`
branch (`index.html:1653-1665`) — so `paused` genuinely does win there, for both treatment modes. The
inconsistency between standalone and grouped placement — the entire subject of the original P1-2 — is
still present, just narrowed to one of the two treatment modes instead of both.

**User-facing consequence:** identical in kind to the original P1-2 — a caregiver using "Only near
treatment day" (an existing, v16, unrelated-to-this-release feature) on a standalone-card medication,
who also pauses it while outside the treatment window (e.g., pausing during a long gap between
treatment cycles), gets zero on-Home indication the medication exists — not even the muted "Paused" card
every other paused medication gets. The code's own comment at `index.html:2705-2709` states the design
intent directly: *"pause wins over every other card state... a vanished card reads as data loss to this
app's anxious-caregiver audience"* — that promise is broken for this specific, real, reachable
combination.

**Location:**
- `medCards` filter (still contains the un-fixed clause), `index.html:2703`.
- `medCards` paused branch (unreachable for this combination, same as the original P1-2's finding),
  `index.html:2704-2717`.
- `status()`'s paused short-circuit (confirms `courseComplete` can't rescue this), `index.html:832`.
- Contrast: `renderGroupedMedsCard`, `index.html:1641-1677` (paused branch at `1653`, treatment
  check — correctly reachable — at `1666`).
- `DEV_BRIEF_v20_restart.md`'s own prediction of this exact scenario, Test scenario 6 under the P1-2
  section (the brief's stated reasoning for why it expected this to already be correct does not hold for
  the standalone card, only the grouped one).

**Recommendation:** the same shape of fix the restart pass already applied to `treatmentExcludedNow`
applies here — move the `treatmentOnly`-outside-window half of the filter clause into the `.map()` too,
positioned identically (after `paused`, before the existing `treatmentExcludedNow` branch or merged with
it), while preserving the filter's `courseComplete` behavior for the **non-paused** case (a `'only'`-mode
medication whose treatment course is over should presumably still vanish forever, paused or not — that
specific sub-case needs its own explicit test before shipping, since it wasn't covered by any repro in
this audit or the original one). This is a slightly larger change than the original P1-2 fix (both
filter clauses move, not just one), and per `TEAM.md`'s restart rule this needs its own fresh Developer
brief pass — a "quick fix" here risks the same trap the original P1-1 fix nearly fell into (an
intuitively-obvious fix that doesn't fully match the actual guard's structure).

---

## 6. NEW FINDING — P3 (low, non-blocking): id-suffix collision can restore the wrong (or no) archived pause history

**Reproduction (live, confirmed):**
1. Create two medications with the identical name "Ibuprofen" (the app allows this —
   `nextMedicationId`, `index.html:3027-3036`, auto-suffixes the second one to `ibuprofen-2` rather than
   blocking the duplicate name). Medication A (`id:'ibuprofen'`) is never paused. Medication B
   (`id:'ibuprofen-2'`) is paused for a real date range.
2. Delete BOTH medications (in either order). `deleteMedicationConfig` correctly archives each under its
   own id: `archivedMeds.ibuprofen` = `{pausePeriods: []}` (A, never paused), `archivedMeds['ibuprofen-2']`
   = `{pausePeriods: [...]}` (B, the one with real history).
3. Add a single new medication named "Ibuprofen." `nextMedicationId` derives the **unsuffixed** base id
   `ibuprofen` first (since medication A's original id is now free) — so the new medication matches
   archive entry A (empty pause history), never entry B (medication B's actual paused history is
   silently orphaned in `archivedMeds['ibuprofen-2']` forever, unless a future medication happens to
   derive exactly that suffixed id again, which `nextMedicationId` will never do on its own since it
   always tries the unsuffixed base first).

**Confirmed live:** the new medication's `pausePeriods` is `[]` — medication B's real pause history is
not restored, and there is no way for a normal user action to reach it again.

**Why this is lower severity than P1-1's original finding:** it requires the user to have deliberately
created two medications with the exact same name at some point — not the simple, single-medication
"delete a medication, fix a typo, re-add it" action the original P1-1 was about, which is unaffected
(confirmed by all 9 Dev Brief scenarios in §2, none of which involve a name collision). It's also a
silent *no-restore*, not a flood — the missed-dose count for the new medication stays accurate for days
after its own creation; only the old, now-unreachable archived history is lost, which is the same
"acceptable, documented, pre-existing" class of gap the Dev Brief already carved out for the
dose-entries/ceiling id-recycling issue (§2, Test 9) rather than a new safety violation.

**Location:** `nextMedicationId` (`index.html:3027-3036`, unsuffixed base always tried first, regardless
of what may be archived under a suffixed id), `saveMedicationEditor`'s archive-match lookup
(`index.html:3105`: `const archivedMatch = !editor.sourceId ? (state.archivedMeds || {})[id] : null;` —
single exact-id lookup only, no fallback to check other archived entries whose `name` matches).

**Recommendation:** low priority, not blocking this release — flag to Aaron as a known, accepted,
narrow gap (same treatment as the dose-entries/ceiling issue). If closed later, the fix would need to
search `archivedMeds` by matching `name` (not just exact id) when the exact-id lookup misses, with its
own landmine analysis for what happens when *multiple* archived entries share a name (which of several
should win — likely most-recently-archived, requiring a timestamp on the archive entry that doesn't
exist today).

---

## 7. Adversarial probe of the NEW `loadMedicationConfig()` fix — CONFIRMED SAFE, no regressions found

This was new territory the original `AUDIT_v20.md` never touched (the bug it fixes was found by the
Lead Developer during their own live verification, after the original audit). Seven live scenarios,
covering every case named in this audit's brief plus one more:

| # | Scenario | Result |
|---|---|---|
| 1 | Genuine first-run: no med-config `localStorage` key at all (`localStorage.getItem` → `null`, `JSON.parse(null)` → `null`) | **PASS** — boots cleanly to the empty-meds "Add your first medication" state, zero console/page errors |
| 2 | `saved.meds` present but not an array (e.g. a plain object) | **PASS** — falls back cleanly to `defaultMedicationConfig()`, no crash |
| 3 | Raw stored value is corrupted/invalid JSON (`'{not valid json!!'`) | **PASS** — caught by the surrounding `try/catch` (`index.html:398-416`), falls back cleanly, no uncaught `pageerror` |
| 4 | Raw stored value is the literal JSON `null` (a real thing `JSON.stringify(null)` can produce) | **PASS** — `!saved` catches it, falls back cleanly |
| 5 | **The exact scenario the fix targets:** `saved.meds` is a genuinely EMPTY array (valid data — a user with zero medications) with a real, non-empty `archivedMeds` payload, survived through a full page reload | **PASS** — `archivedMeds` survives the reload intact, and a matching re-add through the real UI still restores `pausePeriods` correctly (confirmed via `localStorage` after the add) |
| 6 | `saved.meds` is a non-empty array of garbage entries (`null`, a bare string, a number, `true`, an unrelated object) | **PASS** — `normalizeMedication`'s existing defensive coding (`const original = raw || {}`, `index.html:285`) absorbs every garbage element without crashing; this is pre-existing behavior, not something the narrowed early-return changed, confirmed unaffected |
| 7 | `saved.archivedMeds` malformed (a string, not an object) alongside a valid empty `meds` array | **PASS** — `normalizeArchivedMeds`'s own guard (`index.html:360`: `if (!raw \|\| typeof raw !== 'object') return archived;`) handles it independently of the `loadMedicationConfig` early-return change, no crash |

**Blast-radius check — does anything else depend on the old "empty meds always resets to full
defaults" behavior?** No. `DEFAULT_MEDS` is `[]` in this codebase (`index.html:254`,
`// Legacy regimen data removed (audit 1.3) — fresh installs build their own med list.`), and
`mergeMissingDefaultMeds` (`index.html:391-394`) is an explicit no-op (`// APP: no auto-seeding of
defaults — the user's list is entirely their own.`) — so even under the OLD, wider early-return, an
empty `meds` array reset to `defaultMedicationConfig()` would have produced an identical `meds: []`
either way; the only thing the old code path threw away was `archivedMeds`, which is exactly what this
fix preserves. Grepped every other reference to `loadMedicationConfig`/`initialMedicationConfig`
(`index.html:433`, the sole call site, assigned once at module load) — nothing else in the file reads
the pre-normalization shape or depends on the old bail-out timing.

**Conclusion: the `loadMedicationConfig()` narrowing is safe.** No genuine first-run regression, no new
crash surface for any malformed-storage shape tried, and the fix's own target scenario (empty meds +
real archived history, across a reload) is confirmed working end-to-end through the real UI, not just
by reading the function in isolation.

---

## 8. Code re-audit — full sweep of the changed regions, findings above aside

- **`normalizeMedication` (`index.html:284-356`)**: `treatmentMode`-then-`treatmentOnly` derivation
  order confirmed exactly matches the Dev Brief's proposed diff. `pausePeriods` now routes through the
  shared `normalizePausePeriods` helper (`index.html:339`) instead of an inline filter — confirmed
  byte-identical validation logic to the pre-restart inline version (finite `start` required, non-finite
  `end` coerced to `null`), just de-duplicated. No other field's derivation logic changed.
- **`normalizeArchivedMeds` (`index.html:358-370`)**: now preserves `pausePeriods` via the same shared
  helper; still correctly drops any entry that isn't itself an object (`index.html:362`), and the
  top-level guard against `raw` not being an object at all is unchanged (`index.html:360`). Confirmed
  this function runs on every `loadMedicationConfig()` call (not just after a fresh archive), closing the
  exact "looks fixed in a quick manual check, breaks after reload" landmine the Dev Brief called out.
- **`normalizePausePeriods` (`index.html:280-282`)**: new shared helper, used at exactly the two call
  sites the Dev Brief specified (`normalizeMedication:339`, `normalizeArchivedMeds:367`) plus two more
  the Dev Brief's proposed diff also implied but didn't spell out as explicitly —
  `deleteMedicationConfig:3206` (archiving) and `saveMedicationEditor:3121` (restoring) — confirmed all
  four call sites use the identical function, so the validation logic cannot drift between "what's a
  valid period" on the live side vs. the archived side, which was the original P1-1 fix's whole point.
- **`deleteMedicationConfig` (`index.html:3192-3211`)**: the open-period-closing landmine
  (`index.html:3206`: `.map(p => p.end === null ? { ...p, end: today } : p)`) confirmed present and
  correct — re-verified live via P1-1 Test 3 (§2), not just read.
- **`saveMedicationEditor`'s candidate construction (`index.html:3054-3142`)**: the `archivedMatch`
  lookup (`index.html:3105`) is correctly gated on `!editor.sourceId` (add-mode only) — confirmed an
  EDIT-mode save cannot accidentally overwrite a medication's own live `pausePeriods` with a stale
  archive entry (the `...(original || {})` spread at `index.html:3107` already carries the live value
  forward for edits, and `archivedMatch` is forced `null` whenever `editor.sourceId` is truthy).
- **`medCards` (`index.html:2703-2733`)**: confirmed the `treatmentExcludedNow` move matches the Dev
  Brief's diff exactly (§3). The one gap that survives is §5's finding, not a defect in what was
  actually changed — the change itself is correct and precisely scoped as designed.
- **Hard rules (`APP_CLAUDE.md`) — intact.** Zero `caretracker_*` references (full-file grep, unchanged
  from the original audit). `TEST_MODE = true` unchanged (`index.html:44`). No new network calls.
  `node --check` on the extracted module script — clean.
- **`RESERVED_LEGACY_MED_IDS`/Dexamethasone/Zofran-specific logic** — confirmed untouched (grepped exact
  line ranges against the original audit's citations; content identical, only line numbers shifted by
  the restart's additions).
- **No dead code / leftover debug values** in the touched regions — no stray `console.log`, no hardcoded
  test dates.

---

## 9. Verdict (original, pre-fix — superseded by §10)

**NOT clear to proceed past this stage, as of this section's original writing.** Per `TEAM.md`'s
fail-fast rule, this audit found one live, MAJOR-severity defect (§5) reachable through ordinary use of
two individually-shipped, individually-correct features (`'only'`-mode, v16; pause, this release) — the
same class of defect `AUDIT_v20.md` originally flagged as P1-2, surviving in the one sub-case the
restart's scoped, deliberately-narrow fix didn't cover, and which was never actually tested by any of
the three chain stages that ran after the fix (Designer, Lead Designer, QA).

**What's confirmed genuinely fixed, live, not just by reading the diff:**
- P1-1 (delete+re-add discarding `pausePeriods`): all 9 Dev Brief scenarios pass.
- P1-2's originally-reported combination (`'excluded'`-mode + paused, standalone vs. grouped): fixed,
  confirmed structurally matching the grouped card's ordering now.
- P2-1 (`treatmentOnly`/`treatmentMode` desync): fixed, generalizes correctly beyond the original H1/H2
  pair (inverse-desync direction and both legacy migration paths also confirmed correct).
- The new `loadMedicationConfig()` narrowing: adversarially probed across 7 malformed/edge-case storage
  shapes, all clean — no first-run regression, no new crash surface, target scenario confirmed working
  end-to-end.

**What's still broken (at the time this section was originally written):**
- §5 (P1, blocking): standalone `'only'`-mode-and-paused-and-outside-window medication vanishes instead
  of showing "Paused." **Fixed since — see §10.**
- §6 (P3, non-blocking, flag-and-defer): id-suffix-collision can restore the wrong/no archived pause
  history — narrow, requires a deliberately-contrived duplicate-name setup, does not affect the ordinary
  single-medication delete/re-add case at all. **Remains open, deferred by design — see §10.**

---

## 10. §5 fix re-verification and UPDATED FINAL VERDICT

**The fix.** `medCards`'s filter (`index.html:2708`) changed from:
```js
state.meds.filter(m => m.quickLog && (!m.treatmentOnly || (treatmentActiveOn(m, now) && !status(m).courseComplete)))
```
to:
```js
state.meds.filter(m => m.quickLog && (m.paused || !m.treatmentOnly || (treatmentActiveOn(m, now) && !status(m).courseComplete)))
```
i.e. `m.paused ||` was prepended to the OR chain. Read against the actual served file
(`http://localhost:8910/index.html`, confirmed byte-for-byte via `grep`/`sed` before testing, not
assumed from the description) — the in-code comment directly above it (`index.html:2700-2707`)
correctly documents the reasoning: a paused medication now short-circuits the entire treatment-mode
check and always reaches the `.map()`, while a **non-paused** `treatmentOnly` medication outside its
window is completely unaffected (the `m.paused ||` clause is simply `false` for it, so evaluation falls
through to the original, unchanged `!m.treatmentOnly || (...)` logic).

**This is a materially different, and more robust, fix shape than what my own §5 recommendation
proposed** (I suggested moving the `treatmentOnly`-outside-window clause into the `.map()`, mirroring
how the `treatmentExcludedNow` clause was moved in the original restart fix). The `m.paused ||`
short-circuit approach is actually a *better* fix than my suggestion, for a reason worth recording: it
generalizes to every current and future clause in that OR chain without needing to enumerate each one
individually inside the `.map()` — including the `courseComplete` clause, which my original
recommendation didn't explicitly address and which is checked below as its own scenario (Test 4).

**Live re-verification (fresh Playwright run against the current file, 5/5 checks pass, zero console/page
errors):** script `/tmp/audit_v20_restart_p12b_recheck.mjs`.

| # | Scenario | Result |
|---|---|---|
| 1 | **Exact §5 repro**: `'only'`-mode + paused + outside window, standalone card | **PASS** — shows "OnlyPausedStandalone — Paused" with a Resume button that is not just decorative: clicking it actually flips `paused:false` and closes the open `pausePeriods` entry in `localStorage` (confirmed by reading the persisted config after the click, not just the DOM label) |
| 2 | **Regression check**: `'only'`-mode + NOT paused + outside window, standalone | **PASS** — still vanishes entirely, confirming the deliberately-unchanged v16 "vanish outside window" behavior was NOT accidentally fixed away by the new `m.paused \|\|` clause (it's a no-op for a non-paused medication, exactly as designed) |
| 3 | **Original P1-2 combination**: `'excluded'`-mode + paused (active window), standalone vs. grouped | **PASS** — both show "Paused," confirming the earlier fix (moving `treatmentExcludedNow` into the `.map()`) is untouched and still correct alongside the new `m.paused` clause |
| 4 | **Third sibling combination (new, requested)**: a `courseComplete`-shaped medication (today's only window already logged, chemo date placed so `treatmentActiveOn` is `false` both today AND tomorrow — the exact precondition `status()` uses to set `courseComplete:true` at `index.html:877-879`) that is also `paused:true` | **PASS** — shows "Paused," not vanished. This is actually guaranteed correct by construction, confirmed by code reading in addition to the live check: `status()` short-circuits at its very first line for a paused medication (`index.html:832`: `if (med.paused) return { locked: true, paused: true };`), so `courseComplete` is never computed at all for a paused med — and because `m.paused` is the FIRST clause in the filter's `\|\|` chain, JS short-circuit evaluation means `status(m)` inside the third clause is never even called for a paused medication in the filter either. The `.map()`'s own `paused` branch (`index.html:2717`) also returns before ever reaching `const st = status(med)` further down. There is no code path left where a paused medication's card rendering depends on `courseComplete` in any way. |
| 5 | **§6 P3 re-confirm**: id-suffix collision (two same-named meds, one auto-suffixed to `-2`) | **Still reproduces, as expected** — no fix was made or claimed for this; deleting both and re-adding once still restores `pausePeriods: []` (matching the never-paused sibling's archive entry, not the actually-paused one's). Confirms this finding is unchanged and was correctly left out of this fix pass, consistent with the original recommendation to log it as a deferred, non-blocking gap rather than fix it now. |

Screenshot: `outputs/v20-restart-audit-screenshots/finding_p12b_FIXED_only_mode_paused_standalone_shows_paused.png`
— live Home screen showing all three of a normal medication, a standalone `'only'`-mode-paused
medication ("OnlyPausedStandalone — Paused," with Resume), and a grouped `'only'`-mode-paused medication
("OnlyPausedGrouped — Paused," with Resume) — standalone and grouped now render identically for this
state, which is the whole point of both the original and this follow-up fix.

**Blast-radius sanity check on the fix itself:** the `m.paused ||` clause only affects `medCards`'s
`.filter()` — confirmed via `grep` that `renderGroupedMedsCard`, `missedDosesFor`, `doseProgressToday`,
`status()`, and `dueRemindersAt` were not touched by this change (none of them reference this filter),
so this fix cannot have altered any of the previously-verified safety-relevant guards (§2-§4 above, all
still hold — re-ran the full 28-check `/tmp/audit_v20_restart.mjs` suite once more after this fix
landed to confirm zero regressions from it: still 28/28 passing, up from 27/28 before this fix).

### Updated final verdict

**CLEARED to proceed to the Lead Auditor (stage 7).**

- P1-1: fixed, all 9 Dev Brief scenarios + 1 informational edge case (§6), confirmed live.
- P1-2 (both the `'excluded'`-mode original combination and the `'only'`-mode sibling this follow-up
  fixed): fixed, confirmed live, screenshot evidence for both the defect and the fix.
- P2-1: fixed, confirmed live, generalizes beyond the original test pair.
- `loadMedicationConfig()`: adversarially probed, no regressions found.
- §6 (id-suffix collision): remains open by design, correctly unaddressed by this pass, logged as a
  known, accepted, deferred gap — same treatment as the pre-existing dose-entries/ceiling id-recycling
  issue already carried forward from the original P1-1 finding. Recommend Aaron be told this exists but
  it does not block this release.

**Recommend:** advance to the Lead Auditor (stage 7) with this report and the original `AUDIT_v20.md`
as the two audit artifacts to check. Flag §6 explicitly for the Lead Auditor's and PM's awareness as a
carried-forward, intentionally-deferred item — not a silently-dropped one.
