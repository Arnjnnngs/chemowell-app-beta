# Developer Brief — app-v20 restart (fixing AUDIT_v20's P1-1, P1-2, P2-1)

Stage: Developer (investigation only — no code changed). Repo: `chemowell-app-beta`, file: `index.html`
(4,229 lines, single file, no build step). This is the first Developer pass on these three findings —
no prior fix attempt exists to post-mortem, so this brief instead explains why each defect survived
Designer/Lead Designer/QA Tester before the Auditor caught it, so the Lead Developer and the next
Auditor pass target the right kind of verification (combination states, not just the individual
feature paths each earlier stage exercised).

Read fresh against the exact file `AUDIT_v20.md` was written against (`APP_VERSION = 'app-v20'`) — no
changes have been made since the audit. Every line number below was re-verified directly, not carried
over from the audit report.

---

## Why these shipped past three review stages

All three findings are **composition bugs**: each individual feature (pause, excluded-window, the
normalized-field migration) is correct in isolation — the Designer, Lead Designer, and QA Tester all
reviewed the *features as shipped*, each on its own. Nobody's job at those stages was to construct the
specific *cross-feature* state (paused AND excluded-window AND standalone-card; deleted AND re-added
under the same name; a hand-tampered desynced pair of fields). That's exactly the audit's job, and
exactly why it caught these. The fix pass below must not repeat the mistake: every test scenario listed
per finding is a **combination** state, not a restatement of the single-feature happy path that already
passed QA.

---

## P1-1 — Deleting and re-adding a medication under the same name discards `pausePeriods`

### The Auditor's own recommendation needs correcting before implementation starts

The audit offers two options and leans toward (b) ("stop recycling ids... smaller, safer, also closes
the entries-leak issue"). **I verified this against the actual code path and (b) does not fix the
reported defect.** This is the single most important finding in this brief — implementing the
Auditor's stated preference would ship a fix that looks plausible, passes a casual re-read, and still
fails the Auditor's own reproduction script.

**Why (b) doesn't work:** `missedDosesFor` (`index.html:661-697`) has no concept of "when did this
medication object come into existence." It walks every calendar day from the device-wide
`MISSED_TRACK_SINCE` (`index.html:626`, stamped once at first app install, **not per-medication**) to
today, and for each day checks `isPausedOn(med, d0)` (`index.html:612-615`) against whatever
`pausePeriods` the *current* medication object happens to hold. A newly-created medication — whether it
reuses the old id (today's bug) or gets a fresh suffixed id (option b) — starts with `pausePeriods: []`
either way (`normalizeMedication`, `index.html:323`, defaults to `[]` whenever `original.pausePeriods`
isn't already a valid array; a brand-new `candidate` object built in `saveMedicationEditor` for an
add-mode save has no `original` to inherit from at all — `index.html:3049`: `const original =
editor.sourceId ? state.meds.find(...) : null`). Giving the new medication a different id changes
*which* id future dose entries and ceiling math attach to — it does **not** give the new object any
pause history, so `isPausedOn` still returns `false` for the 2 previously-paused days, they still fail
to get excluded, and the header still shows 10, not 8. **Option (b) fixes a different, real, but
lower-severity problem (see "the entries-leak issue" below) — it does not fix P1-1.**

There's also a structural conflict if both were implemented together: option (a)'s restore mechanism
depends on the new medication's *derived id matching* an archived id. If (b) is implemented first
(never recycle a previously-used id), the derived id for a re-added "Ibuprofen" would deliberately never
match `archivedMeds['ibuprofen']` again — so (a)'s match-and-restore trigger could never fire. The two
options are not a smaller/bigger version of the same fix; they solve different problems and are
mutually exclusive as a *matching mechanism*.

### Recommended fix: implement (a) only — archive `pausePeriods`, restore on matching re-add

**1. `deleteMedicationConfig` (`index.html:3136-3145`)** — archive `pausePeriods` alongside
`{name, sub}`, with any still-open period closed at the moment of deletion:

```js
const archivedMeds = { ...(state.archivedMeds || {}), [id]: {
  name: med.name,
  sub: med.sub || '',
  pausePeriods: (med.pausePeriods || []).map(p =>
    p.end === null ? { ...p, end: dayStart(state.now) } : p)
} };
```

**Landmine — closing the open period is not optional.** `isPausedOn` treats `end: null` as "paused
forever, including all future days" (`index.html:614`: `p.end === null || d0 < dayStart(p.end)`). If a
medication is deleted *while actively paused* and the open period is archived as-is, a medication
re-added under the matching id weeks later would inherit an eternally-open pause period and
`missedDosesFor` would silently exclude it from missed-dose tracking forever — a *new*, worse bug in the
opposite direction (silently swallowing real missed doses on a medication the user believes is active
again). Closing the period at the deletion timestamp is what makes "delete" mean "this pause period
ended when the medication went away," which is the only sane semantics.

**2. `saveMedicationEditor` (`index.html:3007-3086`)** — when adding a new medication (`editor.sourceId`
falsy) whose freshly-derived id matches an existing `archivedMeds` entry, carry that entry's
`pausePeriods` into the candidate before `normalizeMedication` runs:

```js
const id = nextMedicationId(name, editor.sourceId);
const archived = !editor.sourceId ? (state.archivedMeds || {})[id] : null;
const candidate = {
  ...(original || {}),
  id,
  ...
  pausePeriods: archived && Array.isArray(archived.pausePeriods) ? archived.pausePeriods
    : (original ? original.pausePeriods : undefined),
  ...
};
```
(insert the `pausePeriods` line into the existing candidate object literal at `index.html:3051-3075`;
`normalizeMedication`'s existing sanitizer at line 323 will validate/filter whatever comes through, so
no new validation logic is needed here).

**3. `normalizeArchivedMeds` (`index.html:342-350`) — this is the landmine a straightforward read of
the Auditor's suggestion would miss entirely.** This function runs on **every load**
(`loadMedicationConfig`, `index.html:376-389`) and currently rebuilds each archived entry as exactly
`{ name, sub }`, discarding any other key:
```js
archived[id] = { name: String(value.name || id), sub: String(value.sub || '') };
```
If step 1 adds `pausePeriods` to the archived object but this function isn't also updated, the fix will
appear to work in the same session (the in-memory `state.archivedMeds` still has it) and then silently
stop working after any reload — `pausePeriods` gets stripped on load, restore-on-matching-id becomes a
no-op, and the exact bug reappears, but only after a reload, which is precisely the kind of thing that
looks fixed in a quick manual check and ships broken. `normalizeArchivedMeds` needs its own
`pausePeriods` filter, ideally factored into a small shared helper (`normalizePausePeriods(raw)`) used
by both this function and `normalizeMedication`'s existing inline filter at line 323, so the validation
logic isn't duplicated and can't drift between the two call sites:
```js
function normalizePausePeriods(raw) {
  return Array.isArray(raw) ? raw.filter(p => p && Number.isFinite(p.start))
    .map(p => ({ start: p.start, end: Number.isFinite(p.end) ? p.end : null })) : [];
}
```

### What this fix must NOT break

- **Medications that were never paused.** `archived.pausePeriods` is `[]` for any medication that never
  used the pause feature, so the restore path is a no-op and behavior is byte-identical to today. This
  is the explicit regression the audit called out — verify it stays true.
- **The dose-entries/ceiling "leak" issue is explicitly NOT fixed by this pass, and id-recycling is
  explicitly NOT changed.** `entriesFor(med.id)` (`index.html:465`), the gap-timer lock (`status()`,
  `index.html:809, 837`), and daily/rolling ceiling math (`dailyDoseMg`/`rollingDoseMg`,
  `index.html:518, 522`) all key off `med.id` and will continue to silently attribute an old, deleted
  medication's logged doses to a new medication that happens to reuse its id — **this was true before
  v20, is unrelated to the pause feature, and is out of scope for this restart.** It is a real,
  independently-scoped problem (a re-added medication with a *different* dosing/ceiling config could
  inherit a same-day dose count from the medication it replaced) and deserves its own Developer brief if
  Aaron wants it closed — do not fold it into this pass by reaching for option (b), since (b) doesn't
  even fully solve it either (it only prevents *future* cross-contamination for medications deleted
  *after* the fix ships; anything already sharing a recycled id today keeps sharing it). Flag it to
  Aaron as a known, accepted, unresolved risk this pass does not touch.
- **RESERVED_LEGACY_MED_IDS / Dexamethasone / Zofran id-gated logic** (`index.html:2979`,
  `dexActiveOn`/`zofranBlockedOn`/`dexWindowsForOffset`) — completely untouched by this fix; the change
  is entirely inside `deleteMedicationConfig`, `saveMedicationEditor`'s candidate construction, and
  `normalizeArchivedMeds`. `nextMedicationId` itself is **not modified** (confirmed only one call site,
  `index.html:3050`).
- **Multi-profile isolation.** `MED_CONFIG_STORAGE_KEY` (`index.html:258`) is already profile-scoped
  (`chemowell-app-p-{profile}-med-v1`), so `archivedMeds` and its restore path are automatically
  per-profile — verify explicitly anyway, since it's an easy thing to assume rather than check.

### Test scenarios (Lead Developer + next Auditor pass)

1. **The audit's exact repro**: pause a scheduled med with genuinely-missed days before the pause plus
   an open pause period; delete it; re-add the identical name. Header must show only the genuinely
   missed count (8), not the flooded count (10) — the 2 previously-paused days must stay excluded from
   both the header count and History.
2. Same as #1 but the pause was already **resumed** (closed period, not open) before deletion — confirm
   the closed period restores and excludes correctly.
3. Same as #1 but the medication is deleted **while still actively paused** (open period) — confirm the
   archived period is closed at the deletion timestamp, and a medication re-added under the matching id
   *weeks* later does **not** show as paused/excluded for any of the days in between (this is the
   dangling-open-period landmine above — it must fail loudly if unfixed, not silently).
4. **Reload in between.** Delete a paused medication, reload the page/app (forces `normalizeArchivedMeds`
   to run), *then* re-add under the same name — confirm the restore still works post-reload. This is the
   scenario that catches a missed `normalizeArchivedMeds` update.
5. A medication that was **never paused** — delete and re-add, confirm zero behavior change from
   pre-fix (empty `pausePeriods` restores to empty, indistinguishable from a fresh add).
6. **Two round-trips**: delete "Ibuprofen" (paused 2 days) → re-add (restored, unpaused) → pause again
   for a different date range → delete again → re-add again — confirm `pausePeriods` accumulates and
   restores correctly across multiple cycles, doesn't get truncated to just the most recent period.
7. Delete "Ibuprofen", then add a **differently-named** medication — confirm no restore happens (exact
   derived-id match only, no fuzzy name matching).
8. Two profiles: pause+delete "Ibuprofen" on Profile A; add "Ibuprofen" on Profile B — confirm Profile
   B's new medication does **not** inherit Profile A's archived pause history.
9. Confirm dose-entry/ceiling behavior is **unchanged** (not fixed, not worsened) — a deleted medication
   with logged entries, re-added under the same recycled id, still shows those old entries in its
   `entriesFor`/ceiling math exactly as it did before this fix (documented as a known pre-existing gap,
   not silently regressed further).

---

## P1-2 — Standalone Quick Log card and grouped-card row disagree on `paused` vs. `treatmentMode:'excluded'` ordering

### Recommended fix: minimal, surgical — move only the `treatmentExcludedNow` clause, not the whole filter

`medCards`'s current filter (`index.html:2666`):
```js
const medCards = state.meds.filter(m => m.quickLog
  && (!m.treatmentOnly || (treatmentActiveOn(m, now) && !status(m).courseComplete))
  && !treatmentExcludedNow(m, now)).map(med => { ... });
```
This is actually **two independent conditions** bundled into one filter clause:
- `!m.treatmentOnly || (treatmentActiveOn(m, now) && !status(m).courseComplete)` — governs `'only'`
  mode's "hidden outside its window, and hidden forever once the treatment course is over" behavior.
  This is old (pre-v20), deliberate, unrelated to the P1-2 finding, and — per the original
  `DEV_BRIEF_pause_treatment_exclusion.md` — an intentional design choice specific to standalone cards
  ("full removal" for `treatmentOnly` outside window, contrasted against the inert-card pattern used for
  in-patient/not-scheduled). **Do not touch this clause.**
- `!treatmentExcludedNow(m, now)` — the new v20 `'excluded'`-mode clause, and the actual root cause of
  P1-2: because it lives upstream in the `.filter()`, it removes a medication from the array
  unconditionally, before the `.map()`'s `if (med.paused)` branch (`index.language:2667`) ever gets a
  chance to run — so a paused-and-excluded medication vanishes instead of showing "Paused."

**The fix is to move only the second clause.** Remove `&& !treatmentExcludedNow(m, now)` from the
filter, and add a `treatmentExcludedNow` branch to the `.map()`, positioned **after** the `paused`
branch (`index.html:2667-2680`) and **before** the `inpatientActiveNow` branch (`index.html:2681`) —
this matches `renderGroupedMedsCard`'s relative order (paused first at `:1625`, treatment-window second
at `:1638`) for the two states this finding is actually about, without re-litigating the unrelated
`'only'`-mode/`courseComplete` design decision:

```js
if (treatmentExcludedNow(med, now)) {
  return h('div', { style: { background: 'rgba(125,105,116,0.06)', border: '1.5px dashed rgba(125,105,116,0.30)', borderRadius: '16px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' } },
    h('div', { style: { ...TYPE.title, color: '#554A52' } }, med.name),
    h('div', { style: { fontSize: '12px', color: '#7A6E76' } }, 'Excluded near treatment day')
  );
}
```
(styling/copy matched to the existing "Not scheduled today" inert-card family already used two branches
below it, and to `renderGroupedMedsCard`'s own "Excluded near treatment day" copy at `index.html:1646`.)

### Why the Auditor's literal wording is a wider change than necessary — and a landmine if followed literally

The audit's recommendation text says: *"move the `treatmentExcludedNow`/`treatmentOnly`-outside-window
exclusion out of `medCards`'s upstream `.filter()` and into the `.map()`"* — grouping **both** clauses
together. Taken literally, this would also change `'only'`-mode's behavior on standalone cards from
"vanishes entirely outside its window" (today's shipped, Designer-reviewed, QA-passed behavior, unchanged
since v16) to "shows an inert row" — a real, visible UX change to a *different* feature than the one that
actually failed the audit, introduced as a side effect of fixing P1-2, without its own Designer/QA pass.
It would also require calling `status(m).courseComplete` inside the `.map()` instead of the `.filter()`
(fine functionally — `status()` already early-returns for paused meds — but it's scope the audit didn't
ask for and the Designer/QA stages never evaluated). **Recommend the narrower fix above**; if Aaron
independently wants standalone cards to show an inert row for `'only'`-mode-outside-window too (for
symmetry with the grouped card, which already does this), that's a legitimate follow-up but is a new,
separate visual-language decision that should get its own Designer review, not ride along inside a P1
bug fix.

### Blast-radius check: is `medCards` (the array) used anywhere else that removing meds from the filter would break?

Grepped every use of the local `medCards` variable: **only two**, both in the same function
(`index.html:2789`: `medCards.length` for the collapsed "(N)" count label; `index.html:2792`: `...medCards`
to spread the rendered nodes into the grid). Neither is a hidden dependency:
- The count already includes paused medications today (the `paused` branch is inside the `.map()`, not
  filtered out), so a treatment-excluded medication newly appearing in the count is consistent with
  existing behavior, not a new class of thing the count has to represent.
- No "Take all" button exists for standalone Quick Log cards (`reorderableHomeMeds`, `index.html:3093`,
  used for the Meds-tab reorder controls, has its own independent filter — `quickLog &&
  !groupedMorning/Evening/Afternoon` — and is untouched by this change since it doesn't reference
  `treatmentExcludedNow` at all).
- `reorderableHomeMeds` and `medCards` are two independently-computed arrays with different filters
  today; this fix does not need to (and should not) unify them.

### What this fix must NOT break

- `'only'`-mode's existing vanish-outside-window + `courseComplete` behavior (explicitly untouched, see
  above).
- The Quick Log count label and grid rendering (confirmed only two consumers, both handled above).
- `renderGroupedMedsCard` itself — not touched by this fix; already correct per the audit
  (`index.html:1613-1649`).
- `missedDosesFor`/`doseProgressToday`/`dueRemindersAt`/`status()` — none of these read `medCards`; they
  each have their own independent `paused`/`treatmentExcludedNow` guards, already confirmed correctly
  ordered (`paused` first) by the audit's own code sweep. Not part of this fix.

### Test scenarios (Lead Developer + next Auditor pass)

1. The audit's exact repro (E1/E3): a `paused:true` + `treatmentMode:'excluded'` (currently inside its
   exclusion window) medication placed as a standalone Quick Log card — must now show the "Paused" card
   with inline Resume, matching the grouped-card row exactly.
2. Same medication placed in a grouped card — confirm still shows "Paused" (no regression to the
   already-correct grouped path).
3. `treatmentMode:'excluded'` + **not** paused, currently inside its exclusion window, standalone card —
   must show the new "Excluded near treatment day" inert row (not vanish, not crash).
4. `treatmentMode:'excluded'`, outside its exclusion window (i.e., currently active/available) — must
   render as a completely normal, interactive card (confirm `treatmentExcludedNow` correctly returns
   `false` outside the window and the branch is skipped).
5. `treatmentOnly:true` (`'only'` mode), outside its window, **not** paused — confirm this **still
   vanishes** from the standalone Quick Log grid (regression check for the "do not touch this clause"
   requirement above) while still showing an inert row in the grouped card (existing, correct, unchanged
   behavior).
6. `treatmentOnly:true`, paused, outside its window — confirm "Paused" wins (shows the Paused card, not
   vanished) on both standalone and grouped placements — this is the `'only'`-mode analog of the
   `'excluded'`-mode bug the audit found; worth explicitly checking since the fix's ordering (paused
   checked first, unconditionally, before either treatment-mode check) should already make this correct,
   but it wasn't in the audit's own test matrix.
7. Quick Log collapsed count — confirm it now includes excluded-and-unpaused medications (expected,
   documented behavior change; verify it's not confusingly larger than the number of *actionable* cards
   without also causing visual/layout issues at 360/390px).

---

## P2-1 — `normalizeMedication` doesn't self-heal a desynced `treatmentOnly`/`treatmentMode` pair

### Confirmed: the Auditor's recommended fix is correct and does not break the legacy migration path

Current code (`index.html:305-315`):
```js
treatmentOnly: typeof original.treatmentOnly === 'boolean' ? original.treatmentOnly : !!original.chemoOnly,
treatmentDaysBefore: ...,
treatmentDaysAfter: ...,
treatmentMode: ['only', 'excluded'].includes(original.treatmentMode) ? original.treatmentMode
  : (typeof original.treatmentOnly === 'boolean' ? (original.treatmentOnly ? 'only' : 'none') : (original.chemoOnly ? 'only' : 'none')),
```
`treatmentOnly` and `treatmentMode` are computed as two independent reads of `original` — a stored pair
that disagrees (e.g. `treatmentMode:'excluded'` + `treatmentOnly:true`, unreachable via the shipped UI
but possible via tampering/a future import feature) passes through with the disagreement intact.

**Fix: compute `treatmentMode` first as a local, then derive `treatmentOnly` from it** — matching the
file's own existing pattern of computing `windows`/`doses` as locals before the returned object literal
(`index.html:280-292`):
```js
const treatmentMode = ['only', 'excluded'].includes(original.treatmentMode) ? original.treatmentMode
  : (typeof original.treatmentOnly === 'boolean' ? (original.treatmentOnly ? 'only' : 'none') : (original.chemoOnly ? 'only' : 'none'));
```
then inside the `medication` object:
```js
treatmentOnly: treatmentMode === 'only',
treatmentMode: treatmentMode,
treatmentDaysBefore: ...,
treatmentDaysAfter: ...,
```

**Verified case-by-case that this changes nothing for any currently-reachable state:**
| Stored state | Old output | New output | Same? |
|---|---|---|---|
| `treatmentMode:'only'\|'excluded'` (valid, self-consistent) | matches | matches | yes |
| No `treatmentMode`, `treatmentOnly:true` (v16–v19 legacy) | `only`/`true` | `only`/`true` | yes |
| No `treatmentMode`, `treatmentOnly:false` | `none`/`false` | `none`/`false` | yes |
| Neither field, `chemoOnly:true` (pre-v16 legacy) | `only`/`true` | `only`/`true` | yes |
| Nothing set (brand new) | `none`/`false` | `none`/`false` | yes |
| `treatmentMode:'excluded'` + stale `treatmentOnly:true` (audit's H1, unreachable via UI) | `excluded`/`true` (**desynced, bug**) | `excluded`/`false` (**self-consistent, fixed**) | **no — this is the fix** |

Only the one previously-unreachable, already-broken case changes, and it changes to the correct value.
No regression risk for any state the shipped UI, or the v16 `chemoOnly` migration, can actually produce.

### Blast radius

Only `normalizeMedication` itself changes. Every consumer that reads `med.treatmentOnly` directly
(`medCards:2666`, `missedDosesFor:668`, `doseProgressToday:709`, `dueRemindersAt:4133`, `status:849`,
`renderGroupedMedsCard:1617,1638`) is unaffected — they keep reading the same field, it's just now
guaranteed self-consistent with `treatmentMode` by construction. `medicationFormFrom` (`index.html:2928`)
has its own independent `treatmentMode`-from-`treatmentOnly` fallback for editor prefill, but by the
time a medication reaches the editor it has already passed through the fixed `normalizeMedication`, so
`base.treatmentMode` is already correct — confirmed no change needed there, but worth a quick look during
implementation review since it's a second site with similar-looking logic and it would be easy to assume
it needs the same fix (it doesn't — it's downstream of the already-normalized object, not a second
source of drift). `saveMedicationEditor`'s own candidate construction (`index.html:3068-3069`) already
writes both fields in lockstep from `form.treatmentMode` and is unaffected.

### Test scenarios

1. Audit's H1: `treatmentMode:'excluded'` + `treatmentOnly:true`, no treatment date logged — medication
   must now be fully visible (previously hidden).
2. Audit's H2 control: same setup, `treatmentOnly` omitted — must remain visible (unchanged).
3. A `treatmentMode:'only'` + stale `treatmentOnly:false` (the inverse desync) — must now correctly hide
   outside its window (previously would have incorrectly stayed visible via the wrong `treatmentOnly`
   value, an equally-real desync direction the audit's H1/H2 pair didn't test).
4. A genuine v16–v19 legacy medication (`treatmentOnly:true`, no `treatmentMode` key at all) — confirm
   identical before/after behavior (window, visibility, badge).
5. A pre-v16 legacy medication (`chemoOnly:true`, neither newer field present) — confirm identical
   before/after behavior.
6. A newly-created `'excluded'`-mode medication saved normally through the current editor — confirm a
   save/reload round-trip keeps `treatmentOnly:false`/`treatmentMode:'excluded'` correctly paired.
7. A newly-created `'only'`-mode medication — same round-trip check, `treatmentOnly:true`.

---

## Definition of done for this restart

- [ ] P1-1: `deleteMedicationConfig` archives `pausePeriods` (open periods closed at deletion time);
  `saveMedicationEditor`'s add-flow restores archived `pausePeriods` on a matching derived id;
  `normalizeArchivedMeds` updated to preserve `pausePeriods` through a reload (verified — not assumed).
  Audit's exact repro (8, not 10) reproduced clean. All 9 test scenarios above pass.
- [ ] P1-1: dose-entries/ceiling cross-contamination under a recycled id explicitly confirmed unchanged
  (not fixed, not worsened) and documented as a known, separate, out-of-scope issue for Aaron.
- [ ] P1-2: `medCards`'s filter loses only the `treatmentExcludedNow` clause; the `'only'`-mode/
  `courseComplete` clause is untouched. `.map()` gets a new `treatmentExcludedNow` branch between
  `paused` and `inpatientActiveNow`. All 7 test scenarios above pass, including the `'only'`+paused
  combination the original audit didn't test.
- [ ] P2-1: `normalizeMedication` derives `treatmentOnly` from a locally-computed `treatmentMode`. All 7
  test scenarios above pass, including the inverse-desync case (#3) the audit's own H1/H2 pair didn't
  cover.
- [ ] `node --check index.html` clean.
- [ ] `TEST_MODE` remains `true` (`APP_CLAUDE.md` rule 4).
- [ ] `RESERVED_LEGACY_MED_IDS`/Dexamethasone/Zofran-specific functions confirmed untouched (grep diff
  against pre-fix file).
- [ ] Mobile-first manual QA at 360×740 and 390×844 for the P1-2 standalone-card visual change
  specifically (new inert "Excluded near treatment day" card — confirm it doesn't overflow/clip at the
  smallest supported width, per `TEAM.md`'s binding MOBILE FIRST rule).
- [ ] Version discipline on push: bump `APP_VERSION`, bump `sw.js` `CACHE`, add a README row describing
  this as a restart/fix pass on top of app-v20 (not a new feature release).
